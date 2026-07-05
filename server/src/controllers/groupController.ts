import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { Group } from '../models/index.js';
import { AppError } from '../middlewares/error.js';

const generateInviteCode = (): string =>
  crypto.randomBytes(5).toString('hex').toUpperCase(); // e.g. "A3F9B2"

export const createGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, currency, avatar } = req.body;
    const userId = req.user!._id;

    const inviteCode = generateInviteCode();

    const group = await Group.create({
      name,
      description,
      currency: currency || 'USD',
      avatar,
      inviteCode,
      createdBy: new Types.ObjectId(userId),
      members: [{ userId: new Types.ObjectId(userId), role: 'admin' }],
    });

    res.status(201).json({ status: 'success', data: { group } });
  } catch (err) {
    next(err);
  }
};

export const getMyGroups = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const groups = await Group.find({
      'members.userId': new Types.ObjectId(userId),
      isActive: true,
    }).populate('members.userId', 'name email avatar');

    res.status(200).json({ status: 'success', data: { groups } });
  } catch (err) {
    next(err);
  }
};

export const getGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = (req as any).group;
    await group.populate('members.userId', 'name email avatar');
    res.status(200).json({ status: 'success', data: { group } });
  } catch (err) {
    next(err);
  }
};

export const updateGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = (req as any).group;
    const { name, description, currency, avatar } = req.body;

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (currency) group.currency = currency;
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();
    res.status(200).json({ status: 'success', data: { group } });
  } catch (err) {
    next(err);
  }
};

export const deleteGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = (req as any).group;
    group.isActive = false;
    await group.save();
    res.status(200).json({ status: 'success', message: 'Group deactivated.' });
  } catch (err) {
    next(err);
  }
};

export const joinGroupByCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user!._id;

    const group = await Group.findOne({ inviteCode: inviteCode.toUpperCase(), isActive: true });
    if (!group) return next(new AppError('Invalid or expired invite code.', 404));

    const alreadyMember = group.members.some(
      (m) => m.userId.toString() === userId
    );
    if (alreadyMember) {
      return next(new AppError('You are already a member of this group.', 409));
    }

    group.members.push({ userId: new Types.ObjectId(userId), role: 'member', joinedAt: new Date() });
    await group.save();

    res.status(200).json({ status: 'success', data: { group } });
  } catch (err) {
    next(err);
  }
};

export const regenerateInviteCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = (req as any).group;
    group.inviteCode = generateInviteCode();
    await group.save();
    res.status(200).json({ status: 'success', data: { inviteCode: group.inviteCode } });
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = (req as any).group;
    const { memberId } = req.params;
    const requesterId = req.user!._id;

    if (memberId === requesterId) {
      return next(new AppError('Use /leave to remove yourself from a group.', 400));
    }

    group.members = group.members.filter(
      (m: any) => m.userId.toString() !== memberId
    );
    await group.save();
    res.status(200).json({ status: 'success', message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
};

export const leaveGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = (req as any).group;
    const userId = req.user!._id;

    const member = group.members.find((m: any) => m.userId.toString() === userId);
    if (member?.role === 'admin' && group.members.length > 1) {
      return next(new AppError('Transfer admin role before leaving.', 400));
    }

    group.members = group.members.filter(
      (m: any) => m.userId.toString() !== userId
    );
    await group.save();
    res.status(200).json({ status: 'success', message: 'You have left the group.' });
  } catch (err) {
    next(err);
  }
};
