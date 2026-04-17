export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RFQ_NOT_FOUND"
  | "QUOTE_REVISION_NOT_FOUND"
  | "REVISION_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "USER_EMAIL_EXISTS"
  | "WEAK_PASSWORD"
  | "PASSWORD_MISMATCH"
  | "INVALID_RESET_TOKEN"
  | "ATTACHMENT_NOT_FOUND"
  | "ATTACHMENT_TOO_LARGE"
  | "ATTACHMENT_UNSUPPORTED"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
