// Message model
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String
    // Not required - can be text, voice, or file
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Voice message fields
  isVoice: {
    type: Boolean,
    default: false
  },
  voiceData: {
    type: String,  // Base64 encoded audio data
    required: function() {
      return this.isVoice;
    }
  },
  voiceDuration: {
    type: Number,  // Duration in seconds
    required: function() {
      return this.isVoice;
    }
  },
  voiceMimeType: {
    type: String,  // e.g., 'audio/webm', 'audio/mp3'
    default: 'audio/webm'
  },
  // File attachment fields
  isFile: {
    type: Boolean,
    default: false
  },
  fileData: {
    type: String,  // Base64 encoded file data
    required: function() {
      return this.isFile;
    }
  },
  fileName: {
    type: String,
    required: function() {
      return this.isFile;
    }
  },
  fileType: {
    type: String,  // MIME type: 'image/jpeg', 'application/pdf', etc.
    required: function() {
      return this.isFile;
    }
  },
  fileSize: {
    type: Number,  // Size in bytes
    required: function() {
      return this.isFile;
    }
  }
}, {
  timestamps: true
});

export default mongoose.model('Message', messageSchema);