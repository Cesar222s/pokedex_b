const mongoose = require('mongoose');
require('dotenv').config();
const { User } = require('./src/models/User');

async function updateExistingUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const users = await User.find({ friendCode: { $exists: false } });
    console.log(`Found ${users.length} users without a friend code.`);

    for (const user of users) {
      let friendCode;
      let exists = true;
      while (exists) {
        friendCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const check = await User.findOne({ friendCode });
        if (!check) exists = false;
      }
      user.friendCode = friendCode;
      await user.save();
      console.log(`Updated user ${user.username} with code ${friendCode}`);
    }

    console.log('All users updated successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

updateExistingUsers();
