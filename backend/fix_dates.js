require('mongoose').connect(require('dotenv').config().parsed.MONGO_URI || 'mongodb://127.0.0.1:27017/busflux').then(async () => {
  const Booking = require('./models/Booking');
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const result = await Booking.updateMany(
    { _id: { $ne: '6a2e039428197cee1de7c831' } },
    { $set: { createdAt: d } }
  );
  console.log('Updated bookings:', result);
  process.exit(0);
}).catch(console.error);
