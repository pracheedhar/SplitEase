import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let status = 'error';
  let message = 'Something went wrong';
  let stack: string | undefined = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    status = err.status;
    message = err.message;
  } else {
    logger.error(`Unexpected Error: ${err.message}\nStack: ${err.stack}`);
  }

  if (process.env.NODE_ENV === 'development') {
    stack = err.stack;
    if (!(err instanceof AppError)) {
      message = err.message;
    }
  }

  res.status(statusCode).json({
    status,
    message,
    ...(stack && { stack }),
  });
};
