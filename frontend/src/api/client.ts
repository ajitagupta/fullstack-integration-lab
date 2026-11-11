import { ApiError, NetworkError, InvalidResponseError, type ApiFieldError, RequestCancelledError } from "./api-error";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);   // 10 seconds, in milliseconds

  // if the caller cancels, cancel our request too
  options.signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(API_URL + path, { ...options, signal: controller.signal });
  } catch {
    if (options.signal?.aborted) {
      throw new RequestCancelledError("Request was cancelled.");
    }
    if (controller.signal.aborted) {
      throw new NetworkError("Server is taking too long to respond.");
    }
    throw new NetworkError("Can't reach the server.");
  } finally {
    clearTimeout(timeoutId);
  }


  if (!response.ok) {
    const body = await response.json().catch(() => null);   // the body may not be JSON
    const errors: ApiFieldError[] = body?.errors ?? [];     // body.errors if it exists, otherwise []
    throw new ApiError(response.status, errors);            // the status code
  }

  try {
    return await response.json();
  } catch {
    throw new InvalidResponseError("The server's response is not valid JSON.");
  }
}