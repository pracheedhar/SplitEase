import { Router } from 'express';
import * as groupController from '../controllers/groupController.js';
import { protect, requireGroupMember, requireGroupAdmin } from '../middlewares/auth.js';

const router = Router();

// All group routes require authentication
router.use(protect);

router.post('/', groupController.createGroup);
router.get('/', groupController.getMyGroups);
router.post('/join', groupController.joinGroupByCode);

router.get('/:groupId', requireGroupMember, groupController.getGroup);
router.patch('/:groupId', requireGroupMember, requireGroupAdmin, groupController.updateGroup);
router.delete('/:groupId', requireGroupMember, requireGroupAdmin, groupController.deleteGroup);
router.post('/:groupId/leave', requireGroupMember, groupController.leaveGroup);
router.patch('/:groupId/invite-code', requireGroupMember, requireGroupAdmin, groupController.regenerateInviteCode);
router.delete('/:groupId/members/:memberId', requireGroupMember, requireGroupAdmin, groupController.removeMember);

export default router;
