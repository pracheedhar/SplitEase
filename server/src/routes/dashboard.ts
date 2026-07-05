import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { protect, requireGroupMember } from '../middlewares/auth.js';

const router = Router({ mergeParams: true });

router.use(protect);
router.use(requireGroupMember);

router.get('/', dashboardController.getDashboard);
router.get('/activity', dashboardController.getActivityTimeline);

export default router;
