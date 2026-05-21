import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: function() {
      return this.mediaType !== 'text' && this.mediaType !== 'contact';
    }
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'text', 'contact'],
    required: true
  },
  caption: {
    type: String,
    maxlength: 500
  },
  contactInfo: {
    name: String,
    email: String,
    phone: String,
    avatar: String
  },
  viewers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },
    viewDuration: {
      type: Number,
      default: 0
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
    }
  }
}, {
  timestamps: true
});

// Index for automatic cleanup of expired statuses
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual to check if status is expired
statusSchema.virtual('isExpired').get(function() {
  return Date.now() > this.expiresAt;
});

// Method to check if user has viewed this status
statusSchema.methods.hasBeenViewedBy = function(userId) {
  return this.viewers.some(v => v.userId.toString() === userId.toString());
};

const Status = mongoose.model('Status', statusSchema);

export default Status;