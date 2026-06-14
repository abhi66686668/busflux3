const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const res = await db.collection('users').updateMany(
    {}, 
    { $set: { role: 'conductor' } }
  );
  console.log(`Updated ${res.modifiedCount} users to conductor`);
  process.exit();
});
