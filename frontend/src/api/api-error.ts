export type ApiFieldError = {
  error: string;
  field?: string;   // the ? means: optional, may be missing
  row?: number;
};

export class ApiError extends Error {
  status: number;
  errors: ApiFieldError[];

  constructor(status: number, errors: ApiFieldError[]) {
    super(errors[0]?.error ?? `Request failed with status ${status}`);
    this.status = status;
    this.errors = errors;
  }
}

export class InvalidResponseError extends Error {}

export class NetworkError extends Error {}

export class RequestCancelledError extends Error {}