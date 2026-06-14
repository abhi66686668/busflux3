const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const user = await User.findOne({ email: "conductor@busflux.com" });
    if(user) {
        console.log("User role in DB:", user.role);
        const token = jwt.sign(
          {
            id: user._id,
            role: user.role
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "1d"
          }
        );
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token payload:", decoded);
    } else {
        console.log("User not found");
    }
    process.exit(0);
});
