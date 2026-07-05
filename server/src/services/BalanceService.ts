import { Types } from 'mongoose';
import { Expense, IExpense, Settlement } from '../models/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserBalance {
  userId: string;
  netBalance: number; // positive = owed money, negative = owes money
}

export interface DebtEntry {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface BalanceSheet {
  balances: UserBalance[];
  suggestedSettlements: DebtEntry[];
}

// ─── Balance Service ──────────────────────────────────────────────────────────
export class BalanceService {
  /**
   * Calculates the full balance sheet for a group.
   * Steps:
   *   1. Fetch all non-deleted expenses
   *   2. For each expense, compute how much each participant owes each payer
   *   3. Also subtract any completed settlements
   *   4. Run min-cash-flow algorithm to get optimised settlement suggestions
   */
  async calculateGroupBalances(groupId: string): Promise<BalanceSheet> {
    const expenses = await Expense.find({
      groupId: new Types.ObjectId(groupId),
      isDeleted: false,
    }).lean();

    // Map: debtor → creditor → amount
    const debtMap: Map<string, Map<string, number>> = new Map();

    const addDebt = (from: string, to: string, amount: number) => {
      if (from === to || amount <= 0) return;
      if (!debtMap.has(from)) debtMap.set(from, new Map());
      const inner = debtMap.get(from)!;
      inner.set(to, (inner.get(to) || 0) + amount);
    };

    for (const expense of expenses) {
      const splitAmounts = this.computeSplitAmounts(expense as unknown as IExpense);
      const totalPaid = expense.paidBy.reduce((s, p) => s + p.amount, 0);

      // Distribute payer credit proportionally if multi-payer
      for (const participant of splitAmounts) {
        const participantOwes = participant.owedAmount;

        // Determine how much this participant owes each payer
        let remaining = participantOwes;
        for (const payer of expense.paidBy) {
          if (remaining <= 0) break;
          const payerShare = (payer.amount / totalPaid) * participantOwes;
          const toCharge = Math.min(remaining, payerShare);
          if (Math.round(toCharge * 100) > 0) {
            addDebt(
              participant.userId.toString(),
              payer.userId.toString(),
              toCharge
            );
          }
          remaining -= toCharge;
        }
      }
    }

    // Subtract completed settlements
    const completedSettlements = await Settlement.find({
      groupId: new Types.ObjectId(groupId),
      status: 'completed',
    }).lean();

    for (const s of completedSettlements) {
      const from = s.fromUser.toString();
      const to = s.toUser.toString();
      const amt = s.amount;

      // Reduce from→to debt
      if (debtMap.has(from) && debtMap.get(from)!.has(to)) {
        const current = debtMap.get(from)!.get(to)! - amt;
        if (current <= 0.009) {
          debtMap.get(from)!.delete(to);
        } else {
          debtMap.get(from)!.set(to, current);
        }
      }
      // If overpaid, add reverse debt
      if (amt > (debtMap.get(from)?.get(to) || 0)) {
        const excess = amt - (debtMap.get(from)?.get(to) || 0);
        addDebt(to, from, excess);
      }
    }

    // Net balance per user
    const netMap: Map<string, number> = new Map();
    for (const [from, toMap] of debtMap) {
      for (const [to, amount] of toMap) {
        netMap.set(from, (netMap.get(from) || 0) - amount);
        netMap.set(to, (netMap.get(to) || 0) + amount);
      }
    }

    const balances: UserBalance[] = Array.from(netMap.entries()).map(
      ([userId, netBalance]) => ({
        userId,
        netBalance: Math.round(netBalance * 100) / 100,
      })
    );

    const suggestedSettlements = this.minCashFlow(balances);

    return { balances, suggestedSettlements };
  }

  /**
   * Min-cash-flow algorithm.
   * Reduces the number of transactions needed to settle all debts in a group.
   * Example: A→B $100, B→C $100 becomes A→C $100 (1 transaction instead of 2).
   */
  minCashFlow(balances: UserBalance[]): DebtEntry[] {
    const result: DebtEntry[] = [];
    // Work on a mutable copy
    const amounts = balances.map((b) => ({
      userId: b.userId,
      net: b.netBalance,
    }));

    const maxIterations = amounts.length * amounts.length;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      // Find the max debtor (most negative) and max creditor (most positive)
      let minIdx = 0;
      let maxIdx = 0;
      for (let i = 1; i < amounts.length; i++) {
        if (amounts[i].net < amounts[minIdx].net) minIdx = i;
        if (amounts[i].net > amounts[maxIdx].net) maxIdx = i;
      }

      const minNet = amounts[minIdx].net;
      const maxNet = amounts[maxIdx].net;

      if (Math.abs(minNet) < 0.01 && Math.abs(maxNet) < 0.01) break;

      const settleAmount = Math.min(Math.abs(minNet), Math.abs(maxNet));

      if (settleAmount < 0.01) break;

      result.push({
        fromUserId: amounts[minIdx].userId,
        toUserId: amounts[maxIdx].userId,
        amount: Math.round(settleAmount * 100) / 100,
      });

      amounts[minIdx].net += settleAmount;
      amounts[maxIdx].net -= settleAmount;
    }

    return result;
  }

  /**
   * Computes how much each participant owes based on the split type.
   * Returns array of { userId, owedAmount } — does NOT include payer's own contribution.
   */
  computeSplitAmounts(
    expense: IExpense
  ): { userId: Types.ObjectId; owedAmount: number }[] {
    const { splitType, amount, participants, paidBy } = expense;
    const payerIds = new Set(paidBy.map((p) => p.userId.toString()));

    switch (splitType) {
      case 'equal': {
        const share = amount / participants.length;
        return participants.map((p) => ({
          userId: p.userId,
          owedAmount:
            payerIds.has(p.userId.toString())
              ? Math.max(0, share - (paidBy.find((pay) => pay.userId.toString() === p.userId.toString())?.amount || 0))
              : Math.round(share * 100) / 100,
        })).filter((p) => {
          // Each participant owes their share
          return true;
        }).map((p) => ({
          userId: p.userId,
          owedAmount: Math.round((amount / participants.length) * 100) / 100,
        }));
      }

      case 'exact': {
        return participants.map((p) => ({
          userId: p.userId,
          owedAmount: Math.round((p.amount || 0) * 100) / 100,
        }));
      }

      case 'percentage': {
        return participants.map((p) => ({
          userId: p.userId,
          owedAmount: Math.round(((p.percentage || 0) / 100) * amount * 100) / 100,
        }));
      }

      case 'shares': {
        const totalShares = participants.reduce((s, p) => s + (p.share || 0), 0);
        return participants.map((p) => ({
          userId: p.userId,
          owedAmount:
            totalShares > 0
              ? Math.round(((p.share || 0) / totalShares) * amount * 100) / 100
              : 0,
        }));
      }

      default:
        return [];
    }
  }
}

export const balanceService = new BalanceService();
