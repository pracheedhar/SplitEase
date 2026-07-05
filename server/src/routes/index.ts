import { Router } from 'express';
import authRoutes from './auth.js';
import groupRoutes from './groups.js';
import expenseRoutes from './expenses.js';
import settlementRoutes from './settlements.js';
import dashboardRoutes from './dashboard.js';
import exportRoutes from './export.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/groups', groupRoutes);

// Nested routes under /groups/:groupId
router.use('/groups/:groupId/expenses', expenseRoutes);
router.use('/groups/:groupId/settlements', settlementRoutes);
router.use('/groups/:groupId/dashboard', dashboardRoutes);
router.use('/groups/:groupId/export', exportRoutes);

export default router;
