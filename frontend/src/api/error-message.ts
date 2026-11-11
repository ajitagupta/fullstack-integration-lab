// frontend/src/api/error-message.ts
import { ApiError, InvalidResponseError, NetworkError } from "./api-error";

export function errorMessage(err: unknown): string {
  if (err instanceof NetworkError) return err.message;
  if (err instanceof ApiError) return err.message;
  if (err instanceof InvalidResponseError) return "The server sent unexpected data.";
  return "Something went wrong.";
}