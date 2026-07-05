import { ExpenseService } from '../../src/services/ExpenseService.js';
import { AppError } from '../../src/middlewares/error.js';

jest.mock('../../src/models/index.js', () => ({
  Expense: { create: jest.fn(), findById: jest.fn() },
  AuditLog: { create: jest.fn() },
}));

import { Expense, AuditLog } from '../../src/models/index.js';

describe('ExpenseService', () => {
  let service: ExpenseService;

  beforeEach(() => {
    service = new ExpenseService();
    jest.clearAllMocks();
    (AuditLog.create as jest.Mock).mockResolvedValue({});
  });

  const validUserId1 = '507f1f77bcf86cd799439012';
  const validUserId2 = '507f1f77bcf86cd799439013';
  const validExpenseId = '507f1f77bcf86cd799439014';
  const validGroupId = '507f1f77bcf86cd799439011';

  const baseExpense = {
    groupId: validGroupId,
    title: 'Dinner',
    amount: 120,
    currency: 'USD',
    category: 'food' as const,
    splitType: 'equal' as const,
    paidBy: [{ userId: validUserId1, amount: 120 }],
    participants: [
      { userId: validUserId1 },
      { userId: validUserId2 },
    ],
    isRecurring: false,
  };

  describe('createExpense', () => {
    it('should create an expense with valid equal split', async () => {
      const mockExpense = { ...baseExpense, _id: validExpenseId };
      (Expense.create as jest.Mock).mockResolvedValue(mockExpense);

      const result = await service.createExpense(baseExpense as any, validUserId1);
      expect(Expense.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockExpense);
    });

    it('should throw if exact amounts do not add up to total', async () => {
      const bad = {
        ...baseExpense,
        splitType: 'exact' as const,
        participants: [
          { userId: validUserId1, amount: 50 },
          { userId: validUserId2, amount: 50 },
        ],
      };
      await expect(service.createExpense(bad as any, validUserId1)).rejects.toThrow(AppError);
    });

    it('should throw if percentage does not total 100', async () => {
      const bad = {
        ...baseExpense,
        splitType: 'percentage' as const,
        participants: [
          { userId: validUserId1, percentage: 60 },
          { userId: validUserId2, percentage: 30 },
        ],
      };
      await expect(service.createExpense(bad as any, validUserId1)).rejects.toThrow(AppError);
    });

    it('should throw if paidBy total does not equal expense amount', async () => {
      const bad = {
        ...baseExpense,
        amount: 120,
        paidBy: [{ userId: validUserId1, amount: 80 }],
      };
      await expect(service.createExpense(bad as any, validUserId1)).rejects.toThrow(AppError);
    });
  });

  describe('deleteExpense', () => {
    it('should soft-delete an expense', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      (Expense.findById as jest.Mock).mockResolvedValue({
        isDeleted: false,
        save: mockSave,
        title: 'Dinner',
        _id: validExpenseId,
      });

      await service.deleteExpense(validExpenseId, validUserId1);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw if expense does not exist', async () => {
      (Expense.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteExpense(validExpenseId, validUserId1)).rejects.toThrow(AppError);
    });
  });
});
