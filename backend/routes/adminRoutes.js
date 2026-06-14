const express = require("express");
const router  = express.Router();
const User    = require("../models/User");
const Bus     = require("../models/Bus");
const Booking = require("../models/Booking");
const jwt     = require("jsonwebtoken");
const bcrypt  = require("bcryptjs");

// ── Admin Auth Middleware ──
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ================= ADMIN LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: "admin" });
    if (!user) return res.status(400).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.status(200).json({ message: "Admin login successful", token, name: user.name });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= DASHBOARD STATS =================
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalUsers      = await User.countDocuments({ role: "user" });
    const totalBuses      = await Bus.countDocuments();
    const totalBookings   = await Booking.countDocuments({ status: { $ne: "failed" } });
    const activeBuses     = await Bus.countDocuments({ isActive: true });
    const totalConductors = await User.countDocuments({ role: "conductor" });

    // Revenue
    const bookings = await Booking.find({ status: { $ne: "failed" } });
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Users by age group
    const ageGroups = await User.aggregate([
      { $match: { role: "user", ageGroup: { $ne: "" } } },
      { $group: { _id: "$ageGroup", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({ totalUsers, totalBuses, totalBookings, activeBuses, totalRevenue, ageGroups, totalConductors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET ALL USERS (grouped by age) =================
router.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("-password -otp -resetOtp")
      .sort({ ageGroup: 1, createdAt: -1 });

    // Group by ageGroup
    const grouped = {};
    users.forEach(u => {
      const group = u.ageGroup || "Unknown";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(u);
    });

    res.status(200).json({ users, grouped });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET SINGLE USER =================
router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -otp -resetOtp");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= DELETE USER =================
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET ALL BOOKINGS =================
router.get("/bookings", adminAuth, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("userId", "name email ageGroup userPhoto")
      .populate("busId", "busName busNumber from to")
      .populate("scannedBy", "name email role userPhoto")
      .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const Transaction = require("../models/Transaction");

// ================= CREATE ADMIN (setup route) =================
router.post("/create", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const admin = await User.create({ name, email, password: hashed, role: "admin", isVerified: true });
    res.status(201).json({ message: "Admin created", admin: { name: admin.name, email: admin.email } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET ALL TRANSACTIONS =================
router.get("/transactions", adminAuth, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("userId", "name email ageGroup")
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const upload = require("../middleware/upload");

// ================= GET ALL CONDUCTORS =================
router.get("/conductors", adminAuth, async (req, res) => {
  try {
    const conductors = await User.find({ role: "conductor" }).sort({ createdAt: -1 });
    res.status(200).json(conductors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= ADD CONDUCTOR =================
router.post("/conductors/add", adminAuth, upload.single("userPhoto"), async (req, res) => {
  try {
    const { name, email, password, phone, experience } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Conductor email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const data = {
      name,
      email,
      password: hashed,
      phone,
      experience: experience ? parseInt(experience) : 0,
      role: "conductor",
      isVerified: true
    };
    if (req.file) {
      data.userPhoto = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const conductor = await User.create(data);
    res.status(201).json({ message: "Conductor created successfully", conductor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= DELETE CONDUCTOR =================
router.delete("/conductors/:id", adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Conductor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= EDIT CONDUCTOR =================
router.put("/conductors/:id", adminAuth, upload.single("userPhoto"), async (req, res) => {
  try {
    const { name, email, password, phone, experience } = req.body;
    const conductor = await User.findById(req.params.id);
    if (!conductor) return res.status(404).json({ message: "Conductor not found" });

    // If email is changing, check if it's already used
    if (email && email.toLowerCase() !== conductor.email.toLowerCase()) {
      const exists = await User.findOne({ email: email.trim().toLowerCase() });
      if (exists) return res.status(400).json({ message: "Email already exists" });
      conductor.email = email.trim().toLowerCase();
    }

    if (name) conductor.name = name.trim();
    if (phone !== undefined) conductor.phone = phone.trim();
    if (experience !== undefined) conductor.experience = experience ? parseInt(experience) : 0;

    if (password) {
      conductor.password = await bcrypt.hash(password, 10);
    }

    if (req.file) {
      conductor.userPhoto = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await conductor.save();
    res.status(200).json({ message: "Conductor updated successfully", conductor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const Notification = require("../models/Notification");

// ================= GET NOTIFICATIONS =================
router.get("/notifications", adminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ targetRole: "admin" })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= MARK NOTIFICATION AS READ =================
router.put("/notifications/read", adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (id === 'all') {
      await Notification.updateMany({ targetRole: "admin", read: false }, { read: true });
    } else if (id) {
      await Notification.findByIdAndUpdate(id, { read: true });
    }
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
