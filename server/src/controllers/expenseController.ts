import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Expense } from '../models/index.js';
import { expenseService, createExpenseSchema } from '../services/ExpenseService.js';
import { balanceService } from '../services/BalanceService.js';
import { AppError } from '../middlewares/error.js';

export const createExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user!._id;

    const parsed = createExpenseSchema.safeParse({ ...req.body, groupId });
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ status: 'fail', message: 'Validation failed', errors });
      return;
    }

    const expense = await expenseService.createExpense(parsed.data, userId);
    res.status(201).json({ status: 'success', data: { expense } });
  } catch (err) {
    next(err);
  }
};

export const getGroupExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { page = '1', limit = '20', category, search } = req.query;

    const filter: any = {
      groupId: new Types.ObjectId(groupId),
      isDeleted: false,
    };
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('paidBy.userId', 'name email avatar')
        .populate('participants.userId', 'name email avatar')
        .populate('createdBy', 'name email'),
      Expense.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        expenses,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { expenseId } = req.params;
    const expense = await Expense.findOne({ _id: expenseId, isDeleted: false })
      .populate('paidBy.userId', 'name email avatar')
      .populate('participants.userId', 'name email avatar')
      .populate('createdBy', 'name email');

    if (!expense) return next(new AppError('Expense not found.', 404));
    res.status(200).json({ status: 'success', data: { expense } });
  } catch (err) {
    next(err);
  }
};

export const updateExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { expenseId } = req.params;
    const userId = req.user!._id;
    const expense = await expenseService.editExpense(expenseId, req.body, userId);
    res.status(200).json({ status: 'success', data: { expense } });
  } catch (err) {
    next(err);
  }
};

export const deleteExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { expenseId } = req.params;
    const userId = req.user!._id;
    await expenseService.deleteExpense(expenseId, userId);
    res.status(200).json({ status: 'success', message: 'Expense deleted.' });
  } catch (err) {
    next(err);
  }
};

export const getGroupBalances = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const balanceSheet = await balanceService.calculateGroupBalances(groupId);
    res.status(200).json({ status: 'success', data: balanceSheet });
  } catch (err) {
    next(err);
  }
};
