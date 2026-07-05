import { Router } from 'express';
import * as expenseController from '../controllers/expenseController.js';
import { protect, requireGroupMember } from '../middlewares/auth.js';

const router = Router({ mergeParams: true }); // Inherit groupId from parent route

router.use(protect);
router.use(requireGroupMember);

router.get('/', expenseController.getGroupExpenses);
router.post('/', expenseController.createExpense);
router.get('/balances', expenseController.getGroupBalances);
router.get('/:expenseId', expenseController.getExpense);
router.patch('/:expenseId', expenseController.updateExpense);
router.delete('/:expenseId', expenseController.deleteExpense);

export default router;
