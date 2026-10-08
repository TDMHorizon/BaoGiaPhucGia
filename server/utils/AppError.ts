export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  /** Dữ liệu bổ sung trả về cho client (vd: currentRevision khi 409). */
  public details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}
