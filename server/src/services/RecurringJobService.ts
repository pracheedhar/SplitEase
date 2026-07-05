import cron from 'node-cron';
import { Expense } from '../models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Runs daily at midnight UTC.
 * For each recurring expense, check if it's due today and create a new expense document.
 */
export const startRecurringExpensesJob = (): void => {
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running recurring expenses job...');
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const recurringExpenses = await Expense.find({
        isRecurring: true,
        isDeleted: false,
      }).lean();

      let created = 0;

      for (const expense of recurringExpenses) {
        const lastDate = new Date(expense.date);
        let isDue = false;

        switch (expense.recurringInterval) {
          case 'daily':
            isDue = true;
            break;
          case 'weekly': {
            const daysSince = Math.floor(
              (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            isDue = daysSince >= 7;
            break;
          }
          case 'monthly':
            isDue = today.getDate() === lastDate.getDate();
            break;
        }

        if (isDue) {
          // Create new expense for today
          const { _id, createdAt, updatedAt, date, ...rest } = expense as any;
          await Expense.create({ ...rest, date: today });
          created++;
        }
      }

      logger.info(`Recurring expenses job completed: ${created} expense(s) created`);
    } catch (err: any) {
      logger.error(`Recurring expenses job failed: ${err.message}`);
    }
  });

  logger.info('Recurring expenses cron job registered (daily at midnight UTC)');
};
