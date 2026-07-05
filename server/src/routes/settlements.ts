import { Router } from 'express';
import * as settlementController from '../controllers/settlementController.js';
import { protect, requireGroupMember } from '../middlewares/auth.js';

const router = Router({ mergeParams: true });

router.use(protect);
router.use(requireGroupMember);

router.get('/', settlementController.getGroupSettlements);
router.post('/', settlementController.requestSettlement);
router.patch('/:settlementId', settlementController.updateSettlementStatus);

export default router;
