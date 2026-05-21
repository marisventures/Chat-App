import Status from '../models/Status.js';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { io } from '../server.js';

// Create a new status
export const createStatus = async (req, res) => {
  try {
    const { mediaType, caption, contactInfo } = req.body;
    const userId = req.user.id;

    const statusData = {
      userId,
      mediaType,
      caption
    };

    // Add media URL if file was uploaded
    if (req.file) {
      statusData.mediaUrl = `/uploads/status/${req.file.filename}`;
    }

    // Add contact info if media type is contact
    if (mediaType === 'contact' && contactInfo) {
      statusData.contactInfo = JSON.parse(contactInfo);
    }

    const status = new Status(statusData);
    await status.save();

    // Populate user info
    await status.populate('userId', 'username fullName avatar');

    // Get user's contacts who can view this status
    const userChats = await Chat.find({
      users: userId,
      isGroupChat: false
    }).populate('users', '_id username fullName avatar online lastSeen');

    // Extract contact user IDs (excluding the status creator)
    const contactIds = [];
    userChats.forEach(chat => {
      chat.users.forEach(user => {
        if (user._id.toString() !== userId.toString()) {
          contactIds.push(user._id.toString());
        }
      });
    });

    // Remove duplicates
    const uniqueContactIds = [...new Set(contactIds)];

    // Emit real-time update to contacts
    if (uniqueContactIds.length > 0) {
      uniqueContactIds.forEach(contactId => {
        io.to(contactId.toString()).emit('new-status', {
          status,
          hasUnviewed: true
        });
      });
    }

    res.status(201).json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error creating status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create status'
    });
  }
};

// Get all statuses from user's contacts
export const getContactStatuses = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's chats to find contacts
    const userChats = await Chat.find({
      users: userId,
      isGroupChat: false
    });

    // Extract contact IDs
    const contactIds = [];
    userChats.forEach(chat => {
      chat.users.forEach(user => {
        if (user.toString() !== userId) {
          contactIds.push(user.toString());
        }
      });
    });

    // Remove duplicates
    const uniqueContactIds = [...new Set(contactIds)];

    // Find active statuses from contacts (not expired)
    const statuses = await Status.find({
      userId: { $in: uniqueContactIds },
      expiresAt: { $gt: new Date() }
    })
      .populate('userId', 'username fullName avatar')
      .sort({ createdAt: -1 });

    // Group statuses by user
    const groupedStatuses = {};
    statuses.forEach(status => {
      const userId = status.userId._id.toString();
      if (!groupedStatuses[userId]) {
        groupedStatuses[userId] = {
          user: status.userId,
          statuses: [],
          hasUnviewed: false
        };
      }
      
      const hasCurrentUserViewed = status.viewers.some(
        v => v.userId.toString() === userId.toString()
      );
      
      if (!hasCurrentUserViewed) {
        groupedStatuses[userId].hasUnviewed = true;
      }
      
      groupedStatuses[userId].statuses.push({
        _id: status._id,
        mediaUrl: status.mediaUrl,
        mediaType: status.mediaType,
        caption: status.caption,
        contactInfo: status.contactInfo,
        viewers: status.viewers,
        createdAt: status.createdAt,
        expiresAt: status.expiresAt,
        hasCurrentUserViewed
      });
    });

    // Get user's own active statuses
    const myStatuses = await Status.find({
      userId: userId,
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        myStatuses,
        contacts: Object.values(groupedStatuses)
      }
    });
  } catch (error) {
    console.error('Error fetching contact statuses:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contact statuses'
    });
  }
};

// Mark status as viewed
export const markStatusViewed = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user.id;

    const status = await Status.findById(statusId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Status not found'
      });
    }

    // Check if status is expired
    if (status.isExpired) {
      return res.status(400).json({
        success: false,
        error: 'Status has expired'
      });
    }

    // Check if already viewed
    const alreadyViewed = status.hasBeenViewedBy(userId);

    if (!alreadyViewed) {
      status.viewers.push({
        userId: userId
      });
      await status.save();
    }

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error marking status as viewed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark status as viewed'
    });
  }
};

// Delete a status
export const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user.id;

    const status = await Status.findOne({
      _id: statusId,
      userId: userId
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Status not found or unauthorized'
      });
    }

    await Status.deleteOne({ _id: statusId });

    res.json({
      success: true,
      message: 'Status deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete status'
    });
  }
};

// Get status viewers
export const getStatusViewers = async (req, res) => {
  try {
    const { statusId } = req.params;

    const status = await Status.findById(statusId)
      .populate('viewers.userId', 'username fullName avatar');

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Status not found'
      });
    }

    res.json({
      success: true,
      viewers: status.viewers
    });
  } catch (error) {
    console.error('Error fetching status viewers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch status viewers'
    });
  }
};