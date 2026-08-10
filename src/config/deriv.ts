/**
 * Deriv API Application Configuration
 * App ID registered for this application.
 */
export const REGISTERED_DERIV_APP_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_APP_ID)
    ? (import.meta as any).env.VITE_DERIV_APP_ID
    : '340mh9Kwzb9IINrqS379p';

// This must exactly match the Redirect URI configured for the Deriv OAuth application.
// Netlify deployment used by this repository.
export const STING_REDIRECT_URI =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_REDIRECT_URI)
    ? (import.meta as any).env.VITE_DERIV_REDIRECT_URI
    : 'https://mbokono.netlify.app/';

export const DERIV_OAUTH_SCOPE = 'trade';
