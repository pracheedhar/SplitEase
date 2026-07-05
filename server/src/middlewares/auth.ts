import { Request, Response, NextFunction } from 'express';
import { tokenService, TokenPayload } from '../services/TokenService.js';
import { User } from '../models/index.js';
import { AppError } from './error.js';
import { Group } from '../models/index.js';
import { Types } from 'mongoose';

// Extend Express Request to attach decoded user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { _id: string };
    }
  }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No token provided. Please log in.', 401));
    }

    const token = authHeader.split(' ')[1];
    const decoded = tokenService.verifyAccessToken(token);

    // Ensure user still exists (not deleted after token was issued)
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(new AppError('User no longer exists.', 401));
    }

    req.user = { ...decoded, _id: user._id.toString() };
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
};

// ─── Group RBAC Middleware ────────────────────────────────────────────────────
/**
 * Check that the authenticated user is a member of the group (from req.params.groupId).
 * Attaches the group to req for downstream use.
 */
export const requireGroupMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user?._id;

    if (!userId) return next(new AppError('Unauthorized.', 401));

    const group = await Group.findById(groupId);
    if (!group) return next(new AppError('Group not found.', 404));
    if (!group.isActive) return next(new AppError('Group is inactive.', 403));

    const isMember = group.members.some(
      (m) => m.userId.toString() === userId
    );
    if (!isMember) {
      return next(new AppError('You are not a member of this group.', 403));
    }

    // Attach group to request for downstream controllers
    (req as any).group = group;
    next();
  } catch {
    next(new AppError('Failed to verify group membership.', 500));
  }
};

/**
 * Check that the authenticated user is an admin of the group.
 * Must be used after requireGroupMember.
 */
export const requireGroupAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user?._id;

    if (!userId) return next(new AppError('Unauthorized.', 401));

    const group = (req as any).group || (await Group.findById(groupId));
    if (!group) return next(new AppError('Group not found.', 404));

    const member = group.members.find(
      (m: any) => m.userId.toString() === userId
    );
    if (!member || member.role !== 'admin') {
      return next(
        new AppError('This action requires group admin privileges.', 403)
      );
    }

    next();
  } catch {
    next(new AppError('Failed to verify admin privileges.', 500));
  }
};
