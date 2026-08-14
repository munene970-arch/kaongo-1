/**
 * Deriv application configuration.
 *
 * The public WebSocket API can use App ID 1089 for token-based account
 * connections. OAuth continues to use the registered application ID.
 */
export const DERIV_WEBSOCKET_APP_ID = '1089';

export const REGISTERED_DERIV_APP_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_APP_ID)
    ? (import.meta as any).env.VITE_DERIV_APP_ID
    : '346xeCzB8LRqcf9T9FDBt';

export const STING_REDIRECT_URI =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_REDIRECT_URI)
    ? (import.meta as any).env.VITE_DERIV_REDIRECT_URI
    : 'https://munene970-arch.github.io/kaongo-1/';

export const DERIV_OAUTH_SCOPE = 'trade';
