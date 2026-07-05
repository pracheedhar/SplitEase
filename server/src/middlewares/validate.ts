import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Generic Zod validation middleware factory.
 * Usage: router.post('/register', validate(registerSchema), authController.register)
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ status: 'fail', message: 'Validation failed', errors });
      return;
    }
    // Replace body with parsed/coerced data
    req.body = result.data;
    next();
  };
