const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus",
    required: true
  },

  seatsBooked: {
    type: Number,
    required: true
  },

  totalPrice: {
    type: Number,
    required: true
  },

  boardingPoint: {
    type: String,
    default: ""
  },

  droppingPoint: {
    type: String,
    default: ""
  },

  paymentId: { type: String, default: "" },
  orderId: { type: String, default: "" },
  paymentMethod: { type: String, default: "wallet" },
  paymentStatus: { type: String, default: "pending" },
  status: { type: String, default: "booked" },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  scannedAt: { type: Date }

}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
