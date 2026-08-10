/**
 * Deriv API Application Configuration.
 * The app uses the registered Deriv OAuth application and the public
 * WebSocket API. Users still authorize their own Deriv account in OAuth
 * or paste their own API token; no token is stored in the source code.
 */
export const REGISTERED_DERIV_APP_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_APP_ID)
    ? (import.meta as any).env.VITE_DERIV_APP_ID
    : '340mh9Kwzb9IINrqS379p';

// GitHub Pages deployment. Add this exact URL to the Redirect URI list
// of the same Deriv OAuth application before testing the OAuth button.
export const STING_REDIRECT_URI =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_REDIRECT_URI)
    ? (import.meta as any).env.VITE_DERIV_REDIRECT_URI
    : 'https://munene970-arch.github.io/kaongo-1/';

export const DERIV_OAUTH_SCOPE = 'trade';
