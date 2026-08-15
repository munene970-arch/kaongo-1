function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function cleanToken(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^bearer\s+/i, '')
    .replace(/[\s'"\r\n\t]/g, '');
}

function findAccountId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAccountId(item);
      if (found) return found;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  const directKeys = [
    'account_id',
    'accountId',
    'account_id_value',
    'loginid',
    'login_id',
  ];

  for (const key of directKeys) {
    const candidate = object[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  // New wallet/account responses can nest the account identifier.
  for (const key of ['account', 'wallet', 'wallets', 'accounts', 'data', 'result']) {
    const found = findAccountId(object[key]);
    if (found) return found;
  }

  return null;
}

async function getJson(url: string, appId: string, token: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Deriv-App-ID': appId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch {}
  return { response, data };
}

async function discoverAccountId(appId: string, token: string): Promise<{ accountId: string | null; details: string[] }> {
  const details: string[] = [];

  // The new wallet API is the preferred safe account-discovery route.
  const endpoints = [
    'https://api.derivws.com/wallet/v1/wallets',
    'https://api.derivws.com/trading/v1/options/accounts',
    'https://api.derivws.com/account/v1/accounts',
  ];

  for (const endpoint of endpoints) {
    try {
      const { response, data } = await getJson(endpoint, appId, token);
      if (!response.ok) {
        details.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }

      const accountId = findAccountId(data);
      if (accountId) return { accountId, details };
      details.push(`${endpoint}: no account identifier in response`);
    } catch (error) {
      details.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { accountId: null, details };
}

function findWebSocketUrl(value: unknown): string | null {
  if (typeof value === 'string') return value.startsWith('wss://') ? value : null;
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWebSocketUrl(item);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findWebSocketUrl(item);
    if (found) return found;
  }
  return null;
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  let body: { appId?: string; token?: string; accountId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  const appId = String(body.appId || '').trim();
  const token = cleanToken(body.token);
  if (!appId || !token) return json({ error: 'App ID and Deriv token are required.' }, 400);

  let accountId = String(body.accountId || '').trim();
  let discoveryDetails: string[] = [];

  // Do not blindly treat a legacy login ID as the new trading account ID.
  if (!accountId) {
    const discovered = await discoverAccountId(appId, token);
    accountId = discovered.accountId || '';
    discoveryDetails = discovered.details;
  }

  if (!accountId) {
    return json({
      error: 'Unable to discover the Deriv account.',
      details: discoveryDetails,
      hint: 'The token was received, but none of the supported Deriv account/wallet endpoints returned an account ID.',
    }, 400);
  }

  const otpResponse = await fetch(
    `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
    {
      method: 'POST',
      headers: {
        'Deriv-App-ID': appId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  const otpText = await otpResponse.text();
  let parsed: unknown = otpText;
  try { parsed = JSON.parse(otpText); } catch {}

  if (!otpResponse.ok) {
    return json({
      error: 'Deriv OTP request failed.',
      accountId,
      details: parsed,
    }, otpResponse.status);
  }

  const wsUrl = findWebSocketUrl(parsed);
  if (!wsUrl) {
    return json({
      error: 'Deriv OTP response did not contain a wss:// URL.',
      accountId,
      response: parsed,
    }, 502);
  }

  return json({ url: wsUrl, accountId });
};
