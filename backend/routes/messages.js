/**
 * Message routes
 */

import express from 'express';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';

const router = express.Router();

// Get all messages for a chat
router.get('/:chatId', async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'username fullName avatar')
      .populate('chat')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a new message (text, voice, or file)
router.post('/', async (req, res) => {
  const {
    content,
    chatId,
    isVoice,
    voiceData,
    voiceDuration,
    voiceMimeType,
    isFile,
    fileData,
    fileName,
    fileType,
    fileSize
  } = req.body;

  // Validate: at least one of content, voiceData, or fileData is required
  const hasContent = !!content;
  const hasVoice = isVoice && !!voiceData;
  const hasFile = isFile && !!fileData;

  if (!hasContent && !hasVoice && !hasFile) {
    return res.status(400).json({ error: 'Message must have text, voice, or file content' });
  }

  if (!chatId) {
    return res.status(400).json({ error: 'Chat ID is required' });
  }

  // Validate exclusive types - only one type allowed
  const typeCount = [isVoice, isFile].filter(Boolean).length;
  if (typeCount > 1) {
    return res.status(400).json({ error: 'Cannot combine voice and file attachments' });
  }

  // Voice message validation
  if (isVoice) {
    if (!voiceData) {
      return res.status(400).json({ error: 'Voice data is required for voice messages' });
    }
    if (!voiceDuration || typeof voiceDuration !== 'number') {
      return res.status(400).json({ error: 'Valid voice duration is required for voice messages' });
    }
  }

  // File attachment validation
  if (isFile) {
    if (!fileData) {
      return res.status(400).json({ error: 'File data is required for file attachments' });
    }
    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'File name and type are required for file attachments' });
    }
    if (!fileSize || typeof fileSize !== 'number') {
      return res.status(400).json({ error: 'Valid file size is required for file attachments' });
    }
  }

   try {
     const chat = await Chat.findById(chatId);

     if (!chat) {
       return res.status(404).json({ error: 'Chat not found' });
     }

     if (!chat.users.includes(req.user.id)) {
       return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
     }

     const newMessage = new Message({
       sender: req.user.id,
       chat: chatId,
       isVoice: isVoice || false,
       voiceData: isVoice ? voiceData : undefined,
       voiceDuration: isVoice ? voiceDuration : undefined,
       voiceMimeType: isVoice ? voiceMimeType || 'audio/webm' : undefined,
       isFile: isFile || false,
       fileData: isFile ? fileData : undefined,
       fileName: isFile ? fileName : undefined,
       fileType: isFile ? fileType : undefined,
       fileSize: isFile ? fileSize : undefined,
       content: (!isVoice && !isFile) ? content : undefined,
       status: 'sent'
     });

     await newMessage.save();

     const populatedMessage = await Message.findById(newMessage._id)
       .populate('sender', 'username fullName avatar')
       .populate('chat');

     // Update latest message in chat
     chat.latestMessage = newMessage._id;
     await chat.save();

     // Emit message to all chat participants (including sender) via socket
     const io = req.app.get('io');
     if (io) {
       const chatWithUsers = await Chat.findById(chatId).populate('users', '_id');
 if (chatWithUsers) {
             chatWithUsers.users.forEach(function(u) {
               io.to(u._id.toString()).emit('receive-message', populatedMessage);
             });
        }
     }

     res.status(201).json(populatedMessage);
   } catch (error) {
     console.error('Error sending message:', error);
     res.status(500).json({ error: 'Internal server error' });
   }
});

// Update message status (sent, delivered, read)
router.put('/:messageId/status', async (req, res) => {
  const { status } = req.body;

  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Validate status
    if (!['sent', 'delivered', 'read'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update status
    message.status = status;

    // Add to readBy if status is read and not already in array
    if (status === 'read' && !message.readBy.includes(req.user.id)) {
      message.readBy.push(req.user.id);
    }

    await message.save();

    // Populate message for broadcast
    const updatedMessage = await Message.findById(message._id)
      .populate('sender', 'username fullName avatar')
      .populate('chat');

    // Broadcast status update to all users in the chat room
    const io = req.app.get('io');
    if (io && message.chat) {
      const Chat = require('../models/Chat.js').default;
      const chat = await Chat.findById(message.chat);
      if (chat) {
        chat.users.forEach(function(userId) {
          io.to(userId.toString()).emit('message-status-updated', {
            messageId: message._id,
            status,
            readBy: message.readBy
          });
        });
      }
    }

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message
router.delete('/:messageId', async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(req.params.messageId);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;