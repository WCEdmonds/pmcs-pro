/** App version from package.json (injected by Vite's `define`). */
export const APP_VERSION: string = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev';
