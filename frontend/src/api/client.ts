import { ApiError, type ApiFieldError } from "./api-error";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(API_URL+path, options);      // the full URL: API_URL + path

  if (!response.ok) {
    const body = await response.json().catch(() => null);   // the body may not be JSON
    const errors: ApiFieldError[] = body?.errors ?? [];     // body.errors if it exists, otherwise []
    throw new ApiError(response.status, errors);            // the status code
  }

  return response.json();
}