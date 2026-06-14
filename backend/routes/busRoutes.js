const express = require("express");
const router  = express.Router();
const Bus     = require("../models/Bus");
const upload  = require("../middleware/upload");
const jwt     = require("jsonwebtoken");
const User    = require("../models/User");

// ── Admin Auth Middleware ──
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ── File upload fields for bus ──
const busUpload = upload.fields([
  { name: "busPhoto",       maxCount: 1 },
  { name: "driverPhoto",    maxCount: 1 },
  { name: "conductorPhoto", maxCount: 1 },
]);

// ================= ADD BUS (Admin) =================
router.post("/add", adminAuth, busUpload, async (req, res) => {
  try {
    const data = { ...req.body };
    const getBase64 = f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
    if (req.files?.busPhoto)       data.busPhoto       = getBase64(req.files.busPhoto[0]);
    if (req.files?.driverPhoto)    data.driverPhoto    = getBase64(req.files.driverPhoto[0]);
    if (req.files?.conductorPhoto) data.conductorPhoto = getBase64(req.files.conductorPhoto[0]);

    // Parse stops array
    if (data.stops && typeof data.stops === "string") {
      data.stops = data.stops.split(",").map(s => s.trim()).filter(Boolean);
    }

    const bus = await Bus.create(data);
    res.status(201).json({ message: "Bus added successfully", bus });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET ALL BUSES =================
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find({ isActive: true });
    res.status(200).json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET ALL BUSES (Admin — includes inactive) =================
router.get("/admin/all", adminAuth, async (req, res) => {
  try {
    const buses = await Bus.find().sort({ createdAt: -1 });
    res.status(200).json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET SINGLE BUS =================
router.get("/:id", async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.status(200).json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= UPDATE BUS (Admin) =================
router.put("/:id", adminAuth, busUpload, async (req, res) => {
  try {
    const data = { ...req.body };
    const getBase64 = f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
    if (req.files?.busPhoto)       data.busPhoto       = getBase64(req.files.busPhoto[0]);
    if (req.files?.driverPhoto)    data.driverPhoto    = getBase64(req.files.driverPhoto[0]);
    if (req.files?.conductorPhoto) data.conductorPhoto = getBase64(req.files.conductorPhoto[0]);

    if (data.stops && typeof data.stops === "string") {
      data.stops = data.stops.split(",").map(s => s.trim()).filter(Boolean);
    }

    const bus = await Bus.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.status(200).json({ message: "Bus updated successfully", bus });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= DELETE BUS (Admin) =================
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.status(200).json({ message: "Bus deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
