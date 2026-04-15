const express = require('express');
const router = express.Router();
const PrayerLog = require('../models/PrayerLog');
const { auth, adminOnly } = require('../middleware/auth');

// @route   POST /api/prayer-logs
// @desc    Mark prayer attendance (admin only)
// @access  Private/Admin
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { userId, date, prayer, prayed } = req.body;
    
    // Prevent future dating
    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      return res.status(400).json({ message: 'Cannot mark attendance for future dates.' });
    }

    // Check if attendance already marked for this user/date/prayer
    let prayerLog = await PrayerLog.findOne({ userId, date, prayer });

    if (prayerLog) {
      return res.status(400).json({ message: 'Attendance for this prayer has already been saved and cannot be changed.' });
    }

    // Create new log
    prayerLog = new PrayerLog({
      userId,
      date,
      prayer,
      prayed,
      markedBy: req.user.userId
    });
    await prayerLog.save();

    res.json({
      message: 'Prayer attendance marked successfully',
      prayerLog
    });
  } catch (error) {
    console.error('Mark prayer error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate entry detected' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/prayer-logs/bulk
// @desc    Mark multiple prayer attendances at once (admin only)
// @access  Private/Admin
router.post('/bulk', auth, adminOnly, async (req, res) => {
  try {
    const { date, prayer, attendances } = req.body;
    
    // Prevent future dating
    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      return res.status(400).json({ message: 'Cannot mark attendance for future dates.' });
    }

    // attendances should be an array of { userId, prayed }

    const results = [];
    const errors = [];

    for (const attendance of attendances) {
      try {
        // Use findOneAndUpdate with upsert to either update existing or create new
        const prayerLog = await PrayerLog.findOneAndUpdate(
          { 
            userId: attendance.userId, 
            date: date, 
            prayer: prayer 
          },
          { 
            prayed: attendance.prayed,
            markedBy: req.user.userId
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );
        results.push(prayerLog);
      } catch (err) {
        console.error(`Error processing attendance for user ${attendance.userId}:`, err);
        errors.push({ userId: attendance.userId, error: err.message });
      }
    }

    res.json({
      message: `Successfully marked ${results.length} prayer attendances`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk mark prayer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/prayer-logs/user/:userId
// @desc    Get all prayer logs for a user
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
  try {
    // Check if user is requesting their own data or is admin
    if (req.user.userId !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate } = req.query;
    let query = { userId: req.params.userId };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const prayerLogs = await PrayerLog.find(query)
      .populate('markedBy', 'name')
      .sort({ date: -1, prayer: 1 });

    res.json(prayerLogs);
  } catch (error) {
    console.error('Get prayer logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/prayer-logs/today
// @desc    Get today's prayer logs for all users (admin only)
// @access  Private/Admin
router.get('/today', auth, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const prayerLogs = await PrayerLog.find({ date: today })
      .populate('userId', 'name email profileImage')
      .populate('markedBy', 'name');

    // Group by prayer
    const groupedByPrayer = {
      Fajr: [],
      Dhuhr: [],
      Asr: [],
      Maghrib: [],
      Isha: []
    };

    prayerLogs.forEach(log => {
      if (groupedByPrayer[log.prayer]) {
        groupedByPrayer[log.prayer].push(log);
      }
    });

    res.json({
      date: today,
      logs: groupedByPrayer
    });
  } catch (error) {
    console.error('Get today prayer logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/prayer-logs/by-date/:date
// @desc    Get prayer logs for a specific date (admin only)
// @access  Private/Admin
router.get('/by-date/:date', auth, adminOnly, async (req, res) => {
  try {
    const { date } = req.params;
    
    const prayerLogs = await PrayerLog.find({ date })
      .populate('userId', 'name email profileImage')
      .populate('markedBy', 'name');

    // Group by prayer
    const groupedByPrayer = {
      Fajr: [],
      Dhuhr: [],
      Asr: [],
      Maghrib: [],
      Isha: []
    };

    prayerLogs.forEach(log => {
      if (groupedByPrayer[log.prayer]) {
        groupedByPrayer[log.prayer].push(log);
      }
    });

    res.json({
      date,
      logs: groupedByPrayer
    });
  } catch (error) {
    console.error('Get date prayer logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
