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
      content: (!isVoice && !isFile) ? content : undefined
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'username fullName avatar')
      .populate('chat');

    // Update latest message in chat
    chat.latestMessage = newMessage._id;
    await chat.save();

    // Emit message to other chat participants via socket
    const io = req.app.get('io');
    if (io) {
      // Get other user IDs (exclude sender)
      const chatWithUsers = await Chat.findById(chatId).populate('users', '_id');
      if (chatWithUsers) {
        const otherUserIds = chatWithUsers.users
          .map((u) => u._id.toString())
          .filter((id) => id !== req.user.id.toString());

        otherUserIds.forEach(userId => {
          io.to(userId).emit('receive-message', populatedMessage);
        });
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update message status (read, delivered)
router.put('/:messageId/status', async (req, res) => {
  const { status } = req.body;

  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!message.readBy.includes(req.user.id)) {
      message.readBy.push(req.user.id);
      await message.save();
    }

    res.json(message);
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