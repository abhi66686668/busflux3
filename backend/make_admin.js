const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const res = await db.collection('users').updateMany(
    {}, 
    { $set: { role: 'admin' } }
  );
  console.log(`Updated ${res.modifiedCount} users to admin`);
  process.exit();
});
