const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;

  // 1. Reset all users to 'user' role
  await db.collection('users').updateMany(
    {}, 
    { $set: { role: 'user' } }
  );

  // 2. Set admin to 'admin' role
  await db.collection('users').updateOne(
    { email: 'admin@busflux.com' }, 
    { $set: { role: 'admin' } }
  );

  // 3. Set conductors to 'conductor' role
  await db.collection('users').updateMany(
    { email: { $in: ['conductorgolden@busflux.com', 'conductormecy@busflux.com'] } },
    { $set: { role: 'conductor' } }
  );

  console.log('Roles properly restored!');
  process.exit();
});
