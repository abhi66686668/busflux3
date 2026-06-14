require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Bus = require('./models/Bus');
  const Booking = require('./models/Booking');
  const b = await Booking.find().sort({ _id: -1 }).limit(1).populate('busId');
  console.log(b[0]);
  process.exit(0);
});
