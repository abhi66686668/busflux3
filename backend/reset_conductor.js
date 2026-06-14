const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash('conductor123', 10);
  
  await db.collection('users').updateMany(
    { email: { $in: ['conductorgolden@busflux.com', 'conductormecy@busflux.com'] } },
    { $set: { password: hash } }
  );

  console.log('Conductor passwords updated!');
  process.exit();
});
