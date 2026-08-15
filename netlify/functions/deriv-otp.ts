function findWebSocketUrl(value: unknown): string | null {
  if (typeof value === 'string') return value.startsWith('wss://') ? value : null;
  if (!value || typeof value !== 'object') return null;
  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findWebSocketUrl(item);
    if (found) return found;
  }
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const appId = process.env.DERIV_APP_ID;
  const token = process.env.DERIV_TOKEN;
  if (!appId || !token) {
    return json({ error: 'Missing DERIV_APP_ID or DERIV_TOKEN' }, 500);
  }

  let body: { accountId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty request body is allowed; the account will be discovered below.
  }

  let accountId = body.accountId?.trim() || '';

  if (!accountId) {
    const accountsResponse = await fetch('https://api.derivws.com/account/v1/accounts', {
      method: 'GET',
      headers: {
        'Deriv-App-ID': appId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const accountsText = await accountsResponse.text();
    if (!accountsResponse.ok) {
      return json({ error: 'Unable to discover the Deriv account.', details: accountsText }, accountsResponse.status);
    }

    try {
      const parsed = JSON.parse(accountsText);
      const accounts = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.accounts)
          ? parsed.accounts
          : Array.isArray(parsed?.data)
            ? parsed.data
            : [];

      const first = accounts[0];
      accountId = String(first?.account_id || first?.accountId || first?.loginid || first?.account || first?.id || '');
    } catch {
      return json({ error: 'Deriv account discovery returned invalid JSON.' }, 502);
    }
  }

  if (!accountId) {
    return json({ error: 'No Deriv account ID was found for this token.' }, 400);
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
  try {
    parsed = JSON.parse(otpText);
  } catch {
    // Keep the raw response for diagnostics below.
  }

  if (!otpResponse.ok) {
    return json({ error: 'Deriv OTP request failed.', details: parsed }, otpResponse.status);
  }

  const wsUrl = findWebSocketUrl(parsed) || (typeof parsed === 'string' && parsed.startsWith('wss://') ? parsed : null);
  if (!wsUrl) {
    return json({ error: 'Deriv OTP response did not contain a wss:// URL.', response: parsed }, 502);
  }

  return json({ url: wsUrl, accountId });
};
