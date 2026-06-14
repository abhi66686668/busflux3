require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Bus = require('./models/Bus');
  const User = require('./models/User');
  const Booking = require('./models/Booking');
  
  // Find user "abhi"
  const user = await User.findOne({ email: 'abhishekpoojary225@gmail.com' });
  console.log("User:", user._id);
  
  const b = await Booking.find({ userId: user._id }).sort({ createdAt: -1 }).populate('busId').populate('scannedBy', 'name email');
  console.log("Total bookings:", b.length);
  if(b.length > 0) {
    console.log("Latest booking:");
    console.log(JSON.stringify(b[0], null, 2));
  }
  process.exit(0);
});
