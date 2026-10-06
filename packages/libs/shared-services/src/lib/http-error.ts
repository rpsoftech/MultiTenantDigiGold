import { HttpErrorResponse } from '@angular/common/http';

// MainServer's error body ({ success, message, code, name }) from a failed HttpClient call,
// or undefined for anything that isn't an HTTP error response.
export function apiErrorBody(
  error: unknown,
): { message?: string; code?: string | number; name?: string } | undefined {
  if (!(error instanceof HttpErrorResponse)) return undefined;
  const body: unknown = error.error;
  return typeof body === 'object' && body !== null ? body : undefined;
}
