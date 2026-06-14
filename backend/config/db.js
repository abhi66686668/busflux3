const mongoose = require("mongoose");
const dns = require("dns");

// Conditionally override DNS servers locally to fix MongoDB SRV resolution issues on some local networks
if (process.env.NODE_ENV !== "production" && !process.env.RENDER) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (dnsErr) {
    console.warn("DNS override warning:", dnsErr.message);
  }
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      family: 4
    });

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Error on startup:", error.message);
    process.exit(1); // Exit process so Render logs show the startup failure clearly
  }
};

module.exports = connectDB;
