const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({

  // ── Basic Info ──
  busName: { type: String, required: true },
  busNumber: { type: String, required: true, unique: true },
  busPhoto: { type: String, default: "" },

  // ── Route ──
  from: { type: String, required: true },
  to: { type: String, required: true },
  departureTime: { type: String, default: "" },
  arrivalTime: { type: String, default: "" },
  stops: [{ type: String }],          // intermediate stops

  // ── Pricing ──
  price: { type: Number, required: true },
  childPrice:      { type: Number, default: 0 },
  youthPrice:      { type: Number, default: 0 },
  youngAdultPrice: { type: Number, default: 0 },
  middleAgePrice:  { type: Number, default: 0 },
  elderlyPrice:    { type: Number, default: 0 },
  seniorPrice:     { type: Number, default: 0 },

  // ── Seats ──
  totalSeats:     { type: Number, default: 40 },
  availableSeats: { type: Number, default: 40 },

  // ── Driver ──
  driverName:       { type: String, default: "" },
  driverPhone:      { type: String, default: "" },
  driverPhoto:      { type: String, default: "" },
  driverAddress:    { type: String, default: "" },
  driverExperience: { type: String, default: "" },

  // ── Conductor ──
  conductorName:       { type: String, default: "" },
  conductorPhone:      { type: String, default: "" },
  conductorPhoto:      { type: String, default: "" },
  conductorAddress:    { type: String, default: "" },
  conductorExperience: { type: String, default: "" },

  // ── Status ──
  isActive: { type: Boolean, default: true },
  isExpress: { type: Boolean, default: false },
  busType: { type: String, default: "Ordinary" }

}, { timestamps: true });

module.exports = mongoose.models.Bus || mongoose.model("Bus", busSchema);
