import express from 'express';
import { uploadStatusMedia } from '../middleware/upload.js';
import {
  createStatus,
  getContactStatuses,
  markStatusViewed,
  deleteStatus,
  getStatusViewers
} from '../controllers/statusController.js';

const router = express.Router();

// Create a new status
router.post(
  '/',
  uploadStatusMedia.single('media'),
  createStatus
);

// Get all contact statuses
router.get('/', getContactStatuses);

// Mark status as viewed
router.put('/:statusId/view', markStatusViewed);

// Delete a status
router.delete('/:statusId', deleteStatus);

// Get status viewers
router.get('/:statusId/viewers', getStatusViewers);

export default router;