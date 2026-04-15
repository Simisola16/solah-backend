const mongoose = require('mongoose');

const prayerLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String,
    required: true
  },
  prayer: {
    type: String,
    enum: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    required: true
  },
  prayed: {
    type: Boolean,
    default: false
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate entries for same user, date, and prayer
prayerLogSchema.index({ userId: 1, date: 1, prayer: 1 }, { unique: true });

module.exports = mongoose.model('PrayerLog', prayerLogSchema);
