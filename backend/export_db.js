const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/busflux";

mongoose.connect(dbUri)
  .then(async () => {
    console.log('Connected to DB');
    const dumpDir = path.join(__dirname, '../database_dump');
    if (!fs.existsSync(dumpDir)) {
      fs.mkdirSync(dumpDir);
    }
    
    // Load all models
    const Booking = require('./models/Booking');
    const Bus = require('./models/Bus');
    const Notification = require('./models/Notification');
    const Transaction = require('./models/Transaction');
    const User = require('./models/User');

    const models = {
      'bookings': Booking,
      'buses': Bus,
      'notifications': Notification,
      'transactions': Transaction,
      'users': User
    };

    for (const [name, model] of Object.entries(models)) {
      const data = await model.find().lean();
      fs.writeFileSync(path.join(dumpDir, `${name}.json`), JSON.stringify(data, null, 2));
      console.log(`Exported ${data.length} records to ${name}.json`);
    }

    console.log('Database export complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('DB Connection error:', err);
    process.exit(1);
  });
