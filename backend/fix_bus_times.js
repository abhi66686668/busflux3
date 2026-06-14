require('mongoose').connect(require('dotenv').config().parsed.MONGO_URI || 'mongodb://127.0.0.1:27017/busflux').then(async () => {
  const Bus = require('./models/Bus');
  await Bus.updateOne({ busName: 'GOLDEN' }, { $set: { departureTime: '08:30', arrivalTime: '09:15' } });
  await Bus.updateOne({ busName: 'MERCY' }, { $set: { departureTime: '09:00', arrivalTime: '10:00' } });
  await Bus.updateOne({ busName: 'SHARADA' }, { $set: { departureTime: '10:00', arrivalTime: '10:45' } });
  console.log('Updated buses successfully');
  process.exit(0);
}).catch(console.error);
