const express = require("express");
const router  = express.Router();
const nodemailer = require("nodemailer");
const Booking = require("../models/Booking");
const Bus     = require("../models/Bus");
const User    = require("../models/User");
const auth    = require("../middleware/auth");


// ── Helper: get age-group price from bus ──
function getAgeGroupPrice(bus, ageGroup) {
  const map = {
    "Children":     bus.childPrice,
    "Youth":        bus.youthPrice,
    "Young Adults": bus.youngAdultPrice,
    "Middle Age":   bus.middleAgePrice,
    "Elderly":      bus.elderlyPrice,
    "Seniors":      bus.seniorPrice,
  };
  const p = map[ageGroup];
  return p && p > 0 ? p : bus.price; // fallback to base price
}

// ── Helper: calculate price ratio based on stop segment ──
function getStopRatio(bus, boardingPoint, droppingPoint) {
  // Full route array: [from, ...stops, to]
  const allStops = [bus.from, ...(bus.stops || []), bus.to];
  const total    = allStops.length - 1; // total segments
  if (total === 0) return 1;

  const bIdx = allStops.findIndex(s => s.toLowerCase() === boardingPoint.toLowerCase());
  const dIdx = allStops.findIndex(s => s.toLowerCase() === droppingPoint.toLowerCase());

  if (bIdx === -1 || dIdx === -1 || dIdx <= bIdx) return 1;

  const segments = dIdx - bIdx;
  return segments / total;
}


// ================= BOOK TICKET =================
router.post("/book/:busId", auth, async (req, res) => {
  try {
    const { seatsBooked, boardingPoint, droppingPoint } = req.body;

    const bus  = await Bus.findById(req.params.busId);
    if (!bus)  return res.status(404).json({ message: "Bus not found" });

    if (bus.availableSeats < seatsBooked)
      return res.status(400).json({ message: "Not enough seats available" });

    // Get user's age group for pricing
    const user     = await User.findById(req.user.id);
    const ageGroup = user?.ageGroup || "";

    // Age-group base price per seat
    const basePrice = getAgeGroupPrice(bus, ageGroup);

    // Scale by route segment ratio
    const ratio      = getStopRatio(bus, boardingPoint || bus.from, droppingPoint || bus.to);
    const pricePerSeat = Math.round(basePrice * ratio);
    const totalPrice   = pricePerSeat * seatsBooked;

    // Check wallet balance
    if ((user.balance || 0) < totalPrice) {
      return res.status(400).json({ message: `Insufficient wallet balance (Current: ₹${user.balance || 0}). Please recharge.` });
    }

    const Notification = require("../models/Notification");
    
    // Create booking
    const booking = await Booking.create({
      userId:        req.user.id,
      busId:         bus._id,
      seatsBooked,
      totalPrice,
      boardingPoint: boardingPoint || bus.from,
      droppingPoint: droppingPoint || bus.to,
      paymentMethod: "wallet",
      paymentStatus: "paid"
    });

    // Notify admin
    try {
      const notif = await Notification.create({
        title: "New Wallet Booking",
        message: `${user.name} booked ${seatsBooked} seat(s) on ${bus.busName} using wallet balance (₹${totalPrice}).`,
        type: "success",
        targetRole: "admin"
      });
      const io = req.app.get('io');
      if (io) {
        io.emit('new_admin_notification', notif);
        io.emit('admin_data_updated');
      }
      
      const userNotif = await Notification.create({
        title: "Ticket Confirmed",
        message: `Your ticket for ${bus.busName} from ${booking.boardingPoint} to ${booking.droppingPoint} is confirmed.`,
        type: "success",
        targetRole: "user",
        targetUser: req.user.id
      });
      
      if (io) {
        io.to(req.user.id.toString()).emit('new_notification', userNotif);
        io.to(req.user.id.toString()).emit('user_data_updated');
      }
    } catch(err) { console.error(err); }

    // Deduct from wallet
    user.balance -= totalPrice;
    await user.save();

    // Reduce seats
    bus.availableSeats -= seatsBooked;
    await bus.save();

    // Generate QR code
    const ticketId = booking._id.toString().substring(booking._id.toString().length - 8).toUpperCase();
    const qrcode = require("qrcode");
    const qrDataUrl = await qrcode.toDataURL(ticketId);

    // Send email confirmation containing the booking details and ticket number
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `BusFlux Ticket Confirmation - #${ticketId}`,
        html: `Hello ${user.name || "Customer"},<br><br>Your bus ticket has been successfully booked! 🚍<br><br>Here are your booking details:<br>------------------------------------------<br>Ticket Number: #${ticketId}<br>Booking ID: ${booking._id}<br>Bus Name: ${bus.busName}<br>Departure: ${bus.departureTime || "N/A"}<br>Arrival: ${bus.arrivalTime || "N/A"}<br>Boarding Point: ${booking.boardingPoint}<br>Dropping Point: ${booking.droppingPoint}<br>Seats Booked: ${booking.seatsBooked}<br>Total Price: ₹${booking.totalPrice}<br>------------------------------------------<br><br><img src="cid:qrCodeImage" /><br><br>Thank you for choosing BusFlux! Have a safe journey! 🚍`,
        attachments: [{ filename: "ticket-qr.png", path: qrDataUrl, cid: "qrCodeImage" }]
      }).then(() => {
        console.log(`[Email Service] Booking confirmation email sent successfully to ${user.email} for ticket #${ticketId}`);
      }).catch(err => {
        console.error("Booking email sending failed:", err.message);
      });
    } catch (emailErr) {
      console.error("Email transporter setup failed:", emailErr.message);
    }

    res.status(201).json({ message: "Ticket booked successfully", booking, totalPrice, qrCode: qrDataUrl });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ================= CALCULATE PRICE (preview) =================
router.post("/calculate-price/:busId", auth, async (req, res) => {
  try {
    const { seatsBooked = 1, boardingPoint, droppingPoint } = req.body;

    const bus  = await Bus.findById(req.params.busId);
    if (!bus)  return res.status(404).json({ message: "Bus not found" });

    const user     = await User.findById(req.user.id);
    const ageGroup = user?.ageGroup || "";

    const basePrice    = getAgeGroupPrice(bus, ageGroup);
    const ratio        = getStopRatio(bus, boardingPoint || bus.from, droppingPoint || bus.to);
    const pricePerSeat = Math.round(basePrice * ratio);
    const totalPrice   = pricePerSeat * seatsBooked;

    res.json({ ageGroup, basePrice, pricePerSeat, totalPrice, ratio });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ================= USER BOOKINGS =================
router.get("/my-bookings", auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 }).populate("busId").populate("scannedBy", "name email");
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
