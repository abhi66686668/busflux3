const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const email = "conductor@busflux.com";
        const exists = await User.findOne({ email });
        if(exists) {
            exists.password = await bcrypt.hash("conductor123", 10);
            exists.role = "conductor";
            exists.isVerified = true;
            await exists.save();
            console.log("Conductor updated successfully");
        } else {
            const hashed = await bcrypt.hash("conductor123", 10);
            await User.create({ name: "Conductor", email, password: hashed, role: "conductor", isVerified: true });
            console.log("Conductor created successfully");
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
