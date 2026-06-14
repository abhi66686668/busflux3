const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash('admin123', 10);
  await db.collection('users').updateOne(
    { email: 'admin@busflux.com' }, 
    { $set: { password: hash } }
  );
  console.log('Password updated for admin@busflux.com');
  process.exit();
});
