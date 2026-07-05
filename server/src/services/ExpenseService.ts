import { Types } from 'mongoose';
import { Expense, IExpense, AuditLog } from '../models/index.js';
import { balanceService } from './BalanceService.js';
import { AppError } from '../middlewares/error.js';
import { z } from 'zod';

// ─── Validation Schema ────────────────────────────────────────────────────────
export const createExpenseSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  category: z
    .enum(['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'education', 'other'])
    .default('other'),
  paidBy: z
    .array(z.object({ userId: z.string(), amount: z.number().positive() }))
    .min(1),
  splitType: z.enum(['equal', 'exact', 'percentage', 'shares']),
  participants: z
    .array(
      z.object({
        userId: z.string(),
        share: z.number().optional(),
        amount: z.number().optional(),
        percentage: z.number().optional(),
      })
    )
    .min(1),
  notes: z.string().max(1000).optional(),
  date: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ─── Expense Service ──────────────────────────────────────────────────────────
export class ExpenseService {
  /**
   * Validates split consistency then creates the expense.
   */
  async createExpense(
    data: CreateExpenseInput,
    createdByUserId: string
  ): Promise<IExpense> {
    this.validateSplit(data);

    const expense = await Expense.create({
      ...data,
      groupId: new Types.ObjectId(data.groupId),
      paidBy: data.paidBy.map((p) => ({
        ...p,
        userId: new Types.ObjectId(p.userId),
      })),
      participants: data.participants.map((p) => ({
        ...p,
        userId: new Types.ObjectId(p.userId),
      })),
      createdBy: new Types.ObjectId(createdByUserId),
      date: data.date ? new Date(data.date) : new Date(),
    });

    await AuditLog.create({
      userId: new Types.ObjectId(createdByUserId),
      action: 'create',
      entity: 'Expense',
      entityId: expense._id,
      metadata: { title: data.title, amount: data.amount },
    });

    return expense;
  }

  async editExpense(
    expenseId: string,
    updates: Partial<CreateExpenseInput>,
    userId: string
  ): Promise<IExpense> {
    const expense = await Expense.findById(expenseId);
    if (!expense || expense.isDeleted) {
      throw new AppError('Expense not found.', 404);
    }

    if (updates.splitType || updates.participants || updates.amount) {
      const merged = { ...expense.toObject(), ...updates } as any;
      this.validateSplit(merged);
    }

    // Apply updates
    Object.assign(expense, updates);
    if (updates.paidBy) {
      expense.paidBy = updates.paidBy.map((p) => ({
        userId: new Types.ObjectId(p.userId),
        amount: p.amount,
      }));
    }
    if (updates.participants) {
      expense.participants = updates.participants.map((p) => ({
        userId: new Types.ObjectId(p.userId),
        share: p.share,
        amount: p.amount,
        percentage: p.percentage,
      }));
    }

    await expense.save();

    await AuditLog.create({
      userId: new Types.ObjectId(userId),
      action: 'update',
      entity: 'Expense',
      entityId: expense._id,
      metadata: { updates },
    });

    return expense;
  }

  async deleteExpense(expenseId: string, userId: string): Promise<void> {
    const expense = await Expense.findById(expenseId);
    if (!expense || expense.isDeleted) {
      throw new AppError('Expense not found.', 404);
    }

    expense.isDeleted = true;
    await expense.save();

    await AuditLog.create({
      userId: new Types.ObjectId(userId),
      action: 'delete',
      entity: 'Expense',
      entityId: expense._id,
      metadata: { title: expense.title },
    });
  }

  /**
   * Validates that split amounts/percentages/shares are consistent with the total.
   */
  private validateSplit(data: {
    splitType: string;
    amount: number;
    participants: Array<{
      userId: string;
      share?: number;
      amount?: number;
      percentage?: number;
    }>;
    paidBy: Array<{ userId: string; amount: number }>;
  }): void {
    const { splitType, amount, participants, paidBy } = data;

    // Validate paidBy total matches expense amount
    const paidTotal = paidBy.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paidTotal - amount) > 0.01) {
      throw new AppError(
        `paidBy total (${paidTotal}) must equal expense amount (${amount}).`,
        400
      );
    }

    if (splitType === 'exact') {
      const exactTotal = participants.reduce((s, p) => s + (p.amount || 0), 0);
      if (Math.abs(exactTotal - amount) > 0.01) {
        throw new AppError(
          `Exact split amounts total (${exactTotal}) must equal expense amount (${amount}).`,
          400
        );
      }
    }

    if (splitType === 'percentage') {
      const percentTotal = participants.reduce(
        (s, p) => s + (p.percentage || 0),
        0
      );
      if (Math.abs(percentTotal - 100) > 0.01) {
        throw new AppError(
          `Percentage split must total 100%. Got ${percentTotal}%.`,
          400
        );
      }
    }

    if (splitType === 'shares') {
      const hasShares = participants.every((p) => (p.share || 0) > 0);
      if (!hasShares) {
        throw new AppError(
          'All participants must have a share value greater than 0.',
          400
        );
      }
    }
  }
}

export const expenseService = new ExpenseService();
