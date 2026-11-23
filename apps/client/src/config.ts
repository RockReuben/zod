/** Client configuration read from Vite environment variables. */
export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8081';
}

export function getToken(): string {
  return import.meta.env.VITE_TOKEN || 'zod-control-center-token';
}