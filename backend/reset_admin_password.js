const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const admin = await User.findOne({ email: "admin@busflux.com" });
    if(admin) {
        admin.password = await bcrypt.hash("admin123", 10);
        await admin.save();
        console.log("Password reset successfully to admin123");
    } else {
        console.log("Admin not found");
    }
    process.exit(0);
});
