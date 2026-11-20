export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthenticated = () => new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
export const forbidden = (msg = "You do not have permission to do this.") => new AppError(403, "FORBIDDEN", msg);
// Records outside the caller's scope are reported as missing so their existence is not revealed.
export const notFound = (what = "Record") => new AppError(404, "NOT_FOUND", `${what} not found.`);
export const badRequest = (msg: string, details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details);
export const conflict = (msg: string) => new AppError(409, "CONFLICT", msg);
export const unprocessable = (code: string, msg: string, details?: unknown) => new AppError(422, code, msg, details);
