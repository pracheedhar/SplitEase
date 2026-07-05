import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/index.js';
import { logger } from '../utils/logger.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Middleware that records all write operations (POST/PUT/PATCH/DELETE)
 * to the AuditLog collection if the user is authenticated.
 */
export const auditLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!WRITE_METHODS.has(req.method)) return next();

  const originalSend = res.json.bind(res);

  res.json = (body: any) => {
    // Only log if the response was successful (2xx) and user is authenticated
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const entity = deriveEntity(req.path);
      const entityId = deriveEntityId(req.path, body);

      if (entity && entityId) {
        AuditLog.create({
          userId: req.user._id,
          action: methodToAction(req.method),
          entity,
          entityId,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch((err: Error) =>
          logger.warn(`Audit log write failed: ${err.message}`)
        );
      }
    }
    return originalSend(body);
  };

  next();
};

const methodToAction = (method: string): string => {
  switch (method) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'create';
  }
};

const deriveEntity = (path: string): string | null => {
  if (path.includes('/expenses')) return 'Expense';
  if (path.includes('/settlements')) return 'Settlement';
  if (path.includes('/groups')) return 'Group';
  if (path.includes('/auth')) return 'User';
  return null;
};

const deriveEntityId = (path: string, body: any): string | null => {
  // Try to get the entity ID from the response body
  return (
    body?.data?.expense?._id ||
    body?.data?.settlement?._id ||
    body?.data?.group?._id ||
    body?.data?.user?.id ||
    null
  );
};
