import { BalanceService } from '../../src/services/BalanceService.js';

// Mock Expense and Settlement models for unit testing
jest.mock('../../src/models/index.js', () => ({
  Expense: { find: jest.fn() },
  Settlement: { find: jest.fn() },
}));

import { Expense, Settlement } from '../../src/models/index.js';

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(() => {
    service = new BalanceService();
    jest.clearAllMocks();
  });

  // ─── computeSplitAmounts ────────────────────────────────────────────────────
  describe('computeSplitAmounts', () => {
    const makeExpense = (overrides: any) => ({
      amount: 100,
      splitType: 'equal',
      participants: [],
      paidBy: [],
      attachments: [],
      ...overrides,
    });

    it('should split equally among participants', () => {
      const expense = makeExpense({
        splitType: 'equal',
        amount: 90,
        participants: [
          { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }
        ],
        paidBy: [{ userId: 'u1', amount: 90 }],
      });

      const result = service.computeSplitAmounts(expense as any);
      expect(result).toHaveLength(3);
      expect(result[0].owedAmount).toBeCloseTo(30);
      expect(result[1].owedAmount).toBeCloseTo(30);
      expect(result[2].owedAmount).toBeCloseTo(30);
    });

    it('should split by exact amounts', () => {
      const expense = makeExpense({
        splitType: 'exact',
        amount: 100,
        participants: [
          { userId: 'u1', amount: 60 },
          { userId: 'u2', amount: 40 },
        ],
        paidBy: [{ userId: 'u1', amount: 100 }],
      });

      const result = service.computeSplitAmounts(expense as any);
      expect(result[0].owedAmount).toBe(60);
      expect(result[1].owedAmount).toBe(40);
    });

    it('should split by percentage', () => {
      const expense = makeExpense({
        splitType: 'percentage',
        amount: 200,
        participants: [
          { userId: 'u1', percentage: 70 },
          { userId: 'u2', percentage: 30 },
        ],
        paidBy: [{ userId: 'u1', amount: 200 }],
      });

      const result = service.computeSplitAmounts(expense as any);
      expect(result[0].owedAmount).toBeCloseTo(140);
      expect(result[1].owedAmount).toBeCloseTo(60);
    });

    it('should split by shares', () => {
      const expense = makeExpense({
        splitType: 'shares',
        amount: 120,
        participants: [
          { userId: 'u1', share: 2 },
          { userId: 'u2', share: 1 },
          { userId: 'u3', share: 1 },
        ],
        paidBy: [{ userId: 'u1', amount: 120 }],
      });

      const result = service.computeSplitAmounts(expense as any);
      expect(result[0].owedAmount).toBeCloseTo(60);   // 2/4 * 120
      expect(result[1].owedAmount).toBeCloseTo(30);   // 1/4 * 120
      expect(result[2].owedAmount).toBeCloseTo(30);   // 1/4 * 120
    });
  });

  // ─── minCashFlow ────────────────────────────────────────────────────────────
  describe('minCashFlow', () => {
    it('should return empty array for balanced balances', () => {
      const balances = [{ userId: 'u1', netBalance: 0 }, { userId: 'u2', netBalance: 0 }];
      const result = service.minCashFlow(balances);
      expect(result).toHaveLength(0);
    });

    it('should create single transaction for A→B→C chain', () => {
      // A owes B $100, B owes C $100 → A should pay C $100 directly
      const balances = [
        { userId: 'A', netBalance: -100 }, // A owes
        { userId: 'B', netBalance: 0 },    // B breaks even
        { userId: 'C', netBalance: 100 },  // C is owed
      ];
      const result = service.minCashFlow(balances);
      expect(result).toHaveLength(1);
      expect(result[0].fromUserId).toBe('A');
      expect(result[0].toUserId).toBe('C');
      expect(result[0].amount).toBeCloseTo(100);
    });

    it('should handle multiple creditors and debtors', () => {
      const balances = [
        { userId: 'u1', netBalance: -50 },
        { userId: 'u2', netBalance: -30 },
        { userId: 'u3', netBalance: 80 },
      ];
      const result = service.minCashFlow(balances);
      const totalSettled = result.reduce((s, r) => s + r.amount, 0);
      expect(totalSettled).toBeCloseTo(80);
    });

    it('should reduce transactions vs naive approach', () => {
      // 4 people, complex debts
      const balances = [
        { userId: 'A', netBalance: -200 },
        { userId: 'B', netBalance: 100 },
        { userId: 'C', netBalance: 50 },
        { userId: 'D', netBalance: 50 },
      ];
      const result = service.minCashFlow(balances);
      // Should optimise to 3 or fewer transactions
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });
});
