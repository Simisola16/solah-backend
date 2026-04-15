const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PrayerLog = require('../models/PrayerLog');
const { auth, adminOnly } = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all users (for markers, viewers, and admins)
// @access  Private/View
router.get('/', auth, async (req, res) => {
  try {
    const viewerRoles = ['admin', 'marker', 'viewer'];
    if (!viewerRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const users = await User.find({ role: { $ne: 'admin' } }).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/users/:id/role
// @desc    Update user role (admin only)
// @access  Private/Admin
router.patch('/:id/role', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'marker', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot change admin role' });
    }

    user.role = role;
    await user.save();

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user with prayer logs
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    // Check if user is requesting their own data or is admin
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's prayer logs
    const prayerLogs = await PrayerLog.find({ userId: req.params.id })
      .populate('markedBy', 'name')
      .sort({ date: -1, prayer: 1 });

    res.json({
      user,
      prayerLogs
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/stats
// @desc    Get user prayer statistics
// @access  Private
router.get('/:id/stats', auth, async (req, res) => {
  try {
    // Check if user is requesting their own data or is admin
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || currentDate.getFullYear().toString();

    // Get all prayer logs for the month
    const prayerLogs = await PrayerLog.find({
      userId: req.params.id,
      date: { $regex: `^${targetYear}-${targetMonth}` }
    });

    // Calculate stats
    const totalPrayers = prayerLogs.length;
    const prayedCount = prayerLogs.filter(log => log.prayed).length;
    const missedCount = totalPrayers - prayedCount;
    const percentage = totalPrayers > 0 ? Math.round((prayedCount / totalPrayers) * 100) : 0;

    // Calculate streak (consecutive days with all 5 prayers)
    const dateMap = {};
    prayerLogs.forEach(log => {
      if (!dateMap[log.date]) {
        dateMap[log.date] = { total: 0, prayed: 0 };
      }
      dateMap[log.date].total++;
      if (log.prayed) {
        dateMap[log.date].prayed++;
      }
    });

    let currentStreak = 0;
    let maxStreak = 0;
    const sortedDates = Object.keys(dateMap).sort();
    
    for (const date of sortedDates) {
      if (dateMap[date].prayed === 5) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    res.json({
      month: `${targetYear}-${targetMonth}`,
      totalPrayers,
      prayedCount,
      missedCount,
      percentage,
      streak: maxStreak
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/global/stats
// @desc    Get global statistics for all users
// @access  Private
router.get('/global/stats', auth, async (req, res) => {
  try {
    const allLogs = await PrayerLog.find();
    
    const totalPrayers = allLogs.length;
    const prayedCount = allLogs.filter(log => log.prayed).length;
    const missedCount = totalPrayers - prayedCount;
    const percentage = totalPrayers > 0 ? Math.round((prayedCount / totalPrayers) * 100) : 0;

    // Get total number of users
    const totalUsers = await User.countDocuments({ role: 'user' });

    res.json({
      totalPrayers,
      prayedCount,
      missedCount,
      percentage,
      totalUsers
    });
  } catch (error) {
    console.error('Get global stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user and their prayer logs (admin only)
// @access  Private/Admin
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting admins
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }

    // Delete user's prayer logs
    await PrayerLog.deleteMany({ userId: req.params.id });

    // Delete user
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User and associated data deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error during user deletion' });
  }
});

module.exports = router;
