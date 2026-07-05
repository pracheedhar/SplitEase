import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Expense } from '../models/index.js';
import { balanceService } from '../services/BalanceService.js';

export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const gId = new Types.ObjectId(groupId);

    const [balanceSheet, totalSpend, categoryBreakdown, monthlyTrend] =
      await Promise.all([
        balanceService.calculateGroupBalances(groupId),

        // Total group spend (non-deleted)
        Expense.aggregate([
          { $match: { groupId: gId, isDeleted: false } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),

        // Spending by category
        Expense.aggregate([
          { $match: { groupId: gId, isDeleted: false } },
          {
            $group: {
              _id: '$category',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]),

        // Monthly trend (last 6 months)
        Expense.aggregate([
          {
            $match: {
              groupId: gId,
              isDeleted: false,
              date: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
              },
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
      ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalGroupSpend: totalSpend[0]?.total || 0,
        balanceSheet,
        categoryBreakdown,
        monthlyTrend,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getActivityTimeline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { page = '1', limit = '30' } = req.query;
    const gId = new Types.ObjectId(groupId);

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const expenses = await Expense.find({ groupId: gId })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('createdBy', 'name email avatar')
      .select('title amount currency category createdAt isDeleted createdBy');

    res.status(200).json({ status: 'success', data: { activities: expenses } });
  } catch (err) {
    next(err);
  }
};
