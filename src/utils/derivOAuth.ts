export interface DerivOAuthAccount {
  account: string;
  token: string;
  currency: string;
  type: 'REAL' | 'DEMO';
}

export function parseDerivOAuthInput(rawInput: string): DerivOAuthAccount[] {
  if (!rawInput || !rawInput.trim()) return [];

  const str = rawInput.trim();
  const accounts: DerivOAuthAccount[] = [];

  // Attempt to parse as URL or query/hash params
  let queryString = str;
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      queryString = url.search + (url.hash ? '&' + url.hash.substring(1) : '');
    } catch (e) {
      queryString = str;
    }
  }

  // Remove leading ? or #
  queryString = queryString.replace(/^[?#]/, '');
  const params = new URLSearchParams(queryString);

  // Check indexed accounts acct1..n, token1..n, cur1..n
  let i = 1;
  while (params.has(`token${i}`) || params.has(`acct${i}`)) {
    const token = params.get(`token${i}`);
    const acct = params.get(`acct${i}`) || `Account_${i}`;
    const cur = params.get(`cur${i}`) || 'USD';

    if (token) {
      const isVirtual = acct.toUpperCase().startsWith('V');
      accounts.push({
        account: acct,
        token: token.trim(),
        currency: cur,
        type: isVirtual ? 'DEMO' : 'REAL',
      });
    }
    i++;
  }

  // Fallback if no indexed tokens found, check single token or access_token or raw token string
  if (accounts.length === 0) {
    const singleToken =
      params.get('access_token') ||
      params.get('token1') ||
      params.get('token') ||
      params.get('pat_token') ||
      params.get('pat') ||
      (str.length >= 4 && !str.includes('=') && !str.includes('&') ? str : null);

    if (singleToken) {
      let cleanToken = singleToken.trim();
      cleanToken = cleanToken.replace(/^bearer\s+/i, '').replace(/['"\r\n\t\s]/g, '');
      const singleAcct =
        params.get('acct1') ||
        params.get('acct') ||
        (cleanToken.startsWith('pat_') ? 'PAT_Account' : cleanToken.length > 10 ? 'Account' : 'Manual_Token');
      const singleCur = params.get('cur1') || params.get('cur') || 'USD';
      const isVirtual = singleAcct.toUpperCase().startsWith('V');

      accounts.push({
        account: singleAcct,
        token: cleanToken,
        currency: singleCur,
        type: isVirtual ? 'DEMO' : 'REAL',
      });
    }
  }

  return accounts;
}

export function getStoredAccounts(): DerivOAuthAccount[] {
  try {
    const stored = localStorage.getItem('deriv_accounts');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveStoredAccounts(accounts: DerivOAuthAccount[]) {
  try {
    localStorage.setItem('deriv_accounts', JSON.stringify(accounts));
  } catch (e) {}
}
