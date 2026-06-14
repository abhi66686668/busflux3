const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    const admins = await User.find({ role: "admin" });
    console.log("Admins found:", admins.map(a => ({ name: a.name, email: a.email })));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
