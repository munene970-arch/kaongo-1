/**
 * Deriv API Application Configuration
 * Built-in App ID registered for Sting application: 340mh9Kwzb9IINrqS379p
 * Reference: Deriv API Documentation (https://developers.deriv.com/)
 */
export const REGISTERED_DERIV_APP_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_APP_ID)
    ? (import.meta as any).env.VITE_DERIV_APP_ID
    : '340mh9Kwzb9IINrqS379p';

export const STING_REDIRECT_URI = 'https://mboko-mboko1.vercel.app';

