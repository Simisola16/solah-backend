const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@solah.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email: admin@solah.com');
      console.log('Password: Admin1234');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin1234', salt);

    // Create admin user
    const admin = new User({
      name: 'Administrator',
      email: 'admin@solah.com',
      password: hashedPassword,
      profileImage: null,
      role: 'admin'
    });

    await admin.save();

    console.log('Admin user created successfully!');
    console.log('Email: admin@solah.com');
    console.log('Password: Admin1234');
    console.log('Please change the password after first login for security.');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
