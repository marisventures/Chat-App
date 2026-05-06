/**
 * Chat routes
 */

import express from 'express';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

const router = express.Router();

// Get all chats for user
router.get('/', async (req, res) => {
  try {
    const chats = await Chat.find({
      users: req.user.id
    })
      .populate('users', 'username fullName avatar online lastSeen')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get or create chat with another user
router.post('/accessChat', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'UserId not provided' });
  }

  try {
    // Check if chat already exists
    let chat = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user.id } } },
        { users: { $elemMatch: { $eq: userId } } }
      ]
    })
      .populate('users', 'username fullName avatar online lastSeen')
      .populate('latestMessage');

    if (chat) {
      return res.json(chat);
    }

    // Get other user's name for 1-on-1 chat
    const otherUser = await User.findById(userId).select('username fullName');
    const chatName = otherUser ? (otherUser.fullName || otherUser.username) : 'Chat';

    // Create new chat
    const chatData = {
      chatName,
      isGroupChat: false,
      users: [req.user.id, userId]
    };

    chat = new Chat(chatData);
    await chat.save();

    const fullChat = await Chat.findById(chat._id)
      .populate('users', 'username fullName avatar online lastSeen');

    res.status(201).json(fullChat);
  } catch (error) {
    console.error('Error accessing chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create group chat
router.post('/group', async (req, res) => {
  const { users, name, avatar } = req.body;

  if (!users || !name) {
    return res.status(400).json({ error: 'Please fill all fields' });
  }

  try {
    const parsedUsers = JSON.parse(users);

    if (parsedUsers.length < 2) {
      return res.status(400).json({ error: 'At least 2 users required for group chat' });
    }

    parsedUsers.push(req.user.id);

    const groupChat = new Chat({
      chatName: name,
      isGroupChat: true,
      users: parsedUsers,
      groupAdmin: req.user.id,
      avatar
    });

    await groupChat.save();

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate('users', 'username fullName avatar online lastSeen')
      .populate('groupAdmin', 'username fullName avatar');

    res.status(201).json(fullGroupChat);
  } catch (error) {
    console.error('Error creating group chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rename group chat
router.put('/rename', async (req, res) => {
  const { chatId, chatName } = req.body;

  try {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName },
      { new: true }
    )
      .populate('users', 'username fullName avatar online lastSeen')
      .populate('groupAdmin', 'username fullName avatar');

    if (!updatedChat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(updatedChat);
  } catch (error) {
    console.error('Error renaming chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add user to group
router.put('/addToGroup', async (req, res) => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.groupAdmin.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only admin can add users' });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { users: userId } },
      { new: true }
    )
      .populate('users', 'username fullName avatar online lastSeen')
      .populate('groupAdmin', 'username fullName avatar');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error adding user to group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove user from group
router.put('/removeFromGroup', async (req, res) => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.groupAdmin.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only admin can remove users' });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } },
      { new: true }
    )
      .populate('users', 'username fullName avatar online lastSeen')
      .populate('groupAdmin', 'username fullName avatar');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error removing user from group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete chat
router.delete('/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is part of the chat
    if (!chat.users.includes(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to delete this chat' });
    }

    await Chat.findByIdAndDelete(req.params.chatId);

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;