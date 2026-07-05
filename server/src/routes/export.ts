import { Router } from 'express';
import { exportGroupCSV, uploadAttachment } from '../controllers/exportController.js';
import { protect, requireGroupMember } from '../middlewares/auth.js';

const router = Router({ mergeParams: true });

router.use(protect);
router.use(requireGroupMember);

/** GET /api/v1/groups/:groupId/export/csv */
router.get('/csv', exportGroupCSV);

/** POST /api/v1/groups/:groupId/expenses/:expenseId/attachment */
router.post('/expenses/:expenseId/attachment', uploadAttachment);

export default router;
