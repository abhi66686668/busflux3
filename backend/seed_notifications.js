const mongoose = require("mongoose");
const Notification = require("./models/Notification");
const User = require("./models/User");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find({ role: "user" });
  for (let user of users) {
    await Notification.create({
      title: "System Update",
      message: `Hello ${user.name}, the new notification system is now active! You will receive updates here for your bookings and wallet recharges.`,
      type: "info",
      targetRole: "user",
      targetUser: user._id
    });
  }
  console.log(`Seeded notifications for ${users.length} users.`);
  process.exit();
}).catch(console.error);
