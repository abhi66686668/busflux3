require('mongoose').connect(require('dotenv').config().parsed.MONGO_URI || 'mongodb://127.0.0.1:27017/busflux').then(async () => {
  const mongoose = require('mongoose');
  
  const d = new Date();
  d.setDate(d.getDate() - 2); // Put them 2 days back to be safe
  
  // Use raw collection to bypass Mongoose timestamp protection
  const db = mongoose.connection.db;
  
  // Update Bookings
  const bRes = await db.collection('bookings').updateMany(
    { _id: { $ne: new mongoose.Types.ObjectId('6a2e039428197cee1de7c831') } },
    { $set: { createdAt: d } }
  );
  
  // Update Transactions
  const tRes = await db.collection('transactions').updateMany(
    {},
    { $set: { createdAt: d } }
  );
  
  console.log('Raw DB Bookings updated:', bRes.modifiedCount);
  console.log('Raw DB Transactions updated:', tRes.modifiedCount);
  process.exit(0);
}).catch(console.error);
