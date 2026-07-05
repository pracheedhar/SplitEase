import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Settlement } from '../models/index.js';
import { balanceService } from '../services/BalanceService.js';
import { AppError } from '../middlewares/error.js';

export const requestSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount, currency, notes } = req.body;
    const fromUserId = req.user!._id;

    const settlement = await Settlement.create({
      groupId: new Types.ObjectId(groupId),
      fromUser: new Types.ObjectId(fromUserId),
      toUser: new Types.ObjectId(toUserId),
      amount,
      currency: currency || 'USD',
      notes,
      status: 'pending',
    });

    res.status(201).json({ status: 'success', data: { settlement } });
  } catch (err) {
    next(err);
  }
};

export const getGroupSettlements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { status } = req.query;

    const filter: any = { groupId: new Types.ObjectId(groupId) };
    if (status) filter.status = status;

    const settlements = await Settlement.find(filter)
      .sort({ createdAt: -1 })
      .populate('fromUser', 'name email avatar')
      .populate('toUser', 'name email avatar');

    res.status(200).json({ status: 'success', data: { settlements } });
  } catch (err) {
    next(err);
  }
};

export const updateSettlementStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { settlementId } = req.params;
    const { status } = req.body;
    const userId = req.user!._id;

    const settlement = await Settlement.findById(settlementId);
    if (!settlement) return next(new AppError('Settlement not found.', 404));

    // Only the recipient (toUser) can approve/reject
    if (settlement.toUser.toString() !== userId) {
      return next(new AppError('Only the recipient can approve or reject a settlement.', 403));
    }

    if (!['completed', 'rejected'].includes(status)) {
      return next(new AppError('Status must be completed or rejected.', 400));
    }

    settlement.status = status;
    if (status === 'completed') settlement.settledAt = new Date();
    await settlement.save();

    res.status(200).json({ status: 'success', data: { settlement } });
  } catch (err) {
    next(err);
  }
};
