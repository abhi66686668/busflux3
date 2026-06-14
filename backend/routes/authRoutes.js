
const express = require("express");

const router = express.Router();

const User =
  require("../models/User");

const Transaction = require("../models/Transaction");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");

const bcrypt =
  require("bcryptjs");

const jwt =
  require("jsonwebtoken");

const nodemailer =
  require("nodemailer");

const upload =
  require("../middleware/upload");

const auth = require("../middleware/auth");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_SwpXpk7KNwdCU7",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dAW3H935TAk4XwTHo0x7fs0a"
});



// ================= NODEMAILER =================

const transporter =
  nodemailer.createTransport({

    service: "gmail",

    auth: {

      user:
        process.env.EMAIL_USER,

      pass:
        process.env.EMAIL_PASS

    }

});



// ================= CHECK USER =================
router.post("/check-user", async (req, res) => {
  try {
    const { email, phone, aadhaarNumber } = req.body;
    
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ error: "Email is already registered" });
      }
    }
    
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ error: "Phone number is already in use" });
      }
    }
    
    if (aadhaarNumber) {
      const existingAadhaar = await User.findOne({ aadhaarNumber });
      if (existingAadhaar) {
        return res.status(400).json({ error: "Aadhaar Card is already registered" });
      }
    }
    
    res.json({ message: "User available" });
  } catch (error) {
    console.error("Check user error:", error);
    res.status(500).json({ error: "Server error checking user" });
  }
});

// ================= SEND OTP =================

router.post(

  "/send-otp",

  async (req, res) => {

    try {

      const { email } =
        req.body;

      const otp =
        Math.floor(
          100000 +
          Math.random() * 900000
        ).toString();

      console.log(`[OTP Service] Generated OTP for ${email}: ${otp}`);



      let user =
        await User.findOne({

          email

        });



      if(!user){

        user =
          new User({

            email

          });

      }



      user.otp = otp;

      await user.save();



      // SEND EMAIL
      let emailSent = true;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "BusFlux OTP Verification",
          text: `Your BusFlux OTP is ${otp}`
        });
      } catch (mailError) {
        console.error("[OTP Service] Nodemailer failed to send email:", mailError.message);
        emailSent = false;
      }

      return res.status(200).json({
        message: emailSent ? "OTP sent successfully" : `OTP simulated! (Dev Fallback: Code is ${otp})`
      });

    } catch (error) {

      return res.status(500).json({

        message:
          error.message

      });

    }

});



// ================= VERIFY OTP =================

router.post(

  "/verify-otp",

  async (req, res) => {

    try {

      const {

        email,
        otp

      } = req.body;



      const user =
        await User.findOne({

          email

        });



      if(!user){

        return res.status(400).json({

          message:
            "User not found"

        });

      }



      if(user.otp !== otp){

        return res.status(400).json({

          message:
            "Invalid OTP"

        });

      }



      user.isVerified = true;

      user.otp = "";

      await user.save();



      return res.status(200).json({

        message:
          "Email verified successfully"

      });

    } catch (error) {

      return res.status(500).json({

        message:
          error.message

      });

    }

});



// ================= REGISTER =================

router.post(

  "/register",

  upload.fields([

    {

      name: "userPhoto",

      maxCount: 1

    },

    {
      name: "idCardPhoto",
      maxCount: 1
    },
    {
      name: "studentIdPhoto",
      maxCount: 1
    }
  ]),

  async (req, res) => {

  console.log("BODY:", req.body);

  console.log("FILES:", req.files);

  try {

    const {
      name,
      email,
      password,
      phone,
      age,
      aadhaarNumber,
      collegeId,
      gender,
      institutionType,
      institutionName,
      course,
      studentIdNumber,
      dob,
      passingYear
    } = req.body;


      let user = await User.findOne({ email });

      if (user && user.password) {
        return res.status(400).json({
          message: "Email already registered"
        });
      }

      if (aadhaarNumber) {
        const existingAadhaar = await User.findOne({ aadhaarNumber });
        if (existingAadhaar && (!user || existingAadhaar._id.toString() !== user._id.toString())) {
          return res.status(400).json({
            message: "Aadhaar card already registered"
          });
        }
      }

      if (studentIdNumber) {
        const existingStudentId = await User.findOne({ studentIdNumber });
        if (existingStudentId && (!user || existingStudentId._id.toString() !== user._id.toString())) {
          return res.status(400).json({
            message: "Student ID card already registered"
          });
        }
      }

      if (!user) {
        user = new User({ email, isVerified: true });
      } else {
        user.isVerified = true;
      }



      // ================= AGE GROUP =================

      let ageGroup = "";

      if(age >= 5 && age <= 14){

        ageGroup = "Children";

      }

      else if(age >= 15 && age <= 24){

        ageGroup = "Youth";

      }

      else if(age >= 25 && age <= 44){

        ageGroup = "Young Adults";

      }

      else if(age >= 45 && age <= 59){

        ageGroup = "Middle Age";

      }

      else if(age >= 60 && age <= 74){

        ageGroup = "Elderly";

      }

      else {

        ageGroup = "Seniors";

      }



      // HASH PASSWORD
      const hashedPassword =
        await bcrypt.hash(

          password,

          10

        );



      // SAVE DATA
      user.name = name;

      user.phone = phone;

      user.age = age;

      user.ageGroup = ageGroup;

      user.aadhaarNumber =
        aadhaarNumber;
        
      user.gender = gender;
      if (dob) user.dob = dob;

      let isStudentExpired = false;
      if (passingYear) {
        user.passingYear = Number(passingYear);
        if (new Date().getFullYear() > user.passingYear) {
          isStudentExpired = true;
        }
      }

      if (isStudentExpired && passingYear) {
        return res.status(400).json({
          message: "Your passing year has expired. You cannot register as a student."
        });
      }

      if (!isStudentExpired) {
        user.collegeId = collegeId;
        if (institutionType) user.institutionType = institutionType;
        if (institutionName) user.institutionName = institutionName;
        if (course) user.course = course;
        if (studentIdNumber) user.studentIdNumber = studentIdNumber;
      } else {
        user.collegeId = "";
        user.institutionType = "";
        user.institutionName = "";
        user.course = "";
        user.studentIdNumber = "";
      }

      user.password =
        hashedPassword;



      // PROFILE PHOTO
      if(req.files && req.files.userPhoto){
        const f = req.files.userPhoto[0];
        user.userPhoto = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
      }



      // ID CARD PHOTO
      if(req.files && req.files.idCardPhoto){
        const f = req.files.idCardPhoto[0];
        user.idCardPhoto = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
      }
      
      // STUDENT ID PHOTO
      if(!isStudentExpired && req.files && req.files.studentIdPhoto){
        const f = req.files.studentIdPhoto[0];
        user.studentIdPhoto = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
      }



await user.save();

console.log("Registration completed");

// CREATE ADMIN NOTIFICATION
try {
  const notif = await Notification.create({
    title: "New User Registered",
    message: `${user.name} (${user.email}) just joined BusFlux.`,
    type: "info",
    targetRole: "admin"
  });
  
  await Notification.create({
    title: "Welcome to BusFlux!",
    message: `Hello ${user.name}, your account has been successfully created.`,
    type: "success",
    targetRole: "user",
    targetUser: user._id
  });

  const io = req.app.get('io');
  if (io) {
    io.emit('new_admin_notification', notif);
  }
} catch (err) {
  console.error("Failed to create notifications:", err.message);
}



// WELCOME EMAIL (fire-and-forget — do NOT await so registration always succeeds)
transporter.sendMail({

  from: process.env.EMAIL_USER,

  to: email,

  subject: "Welcome to BusFlux 🚍",

  text: `Hello ${name},

Your registration was successful 🚍`

}).catch(err => console.error("Welcome email failed:", err.message));



      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "defaultsecret",
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        success: true,
        message: "Registration successful",
        token: token,
        role: user.role
      });




    } catch (error) {

      return res.status(500).json({

        message:
          error.message

      });

    }

});



// ================= LOGIN =================

router.post(

  "/login",

  async (req, res) => {

    try {

      const { email, phone, password } = req.body;

      if (!password || (!email && !phone)) {
        return res.status(400).json({ message: "Email/Phone and password are required" });
      }

      let query = {};
      if (email) query.email = email;
      if (phone) query.phone = phone;

      const user = await User.findOne(query);

      if(!user){

        return res.status(400).json({

          message:
            "User not found"

        });

      }



      const isMatch =
        await bcrypt.compare(

          password,

          user.password

        );



      if(!isMatch){

        return res.status(400).json({

          message:
            "Invalid password"

        });

      }



      // LOGIN EMAIL (asynchronous, non-blocking)
      transporter.sendMail({

        from:
          process.env.EMAIL_USER,

        to:
          user.email,

        subject:
          "BusFlux Login Alert",

        text:

`Hello ${user.name},

You have successfully logged into BusFlux 🚍`

      }).catch(err => console.error("Login email alert failed to send:", err.message));



      // JWT TOKEN
      const token =
        jwt.sign(
          {
            id: user._id,
            role: user.role
          },
          process.env.JWT_SECRET,

          {

            expiresIn: "1d"

          }

        );



      return res.status(200).json({

        message:
          "Login successful",

        token,

        role:
          user.role

      });

    } catch (error) {

      return res.status(500).json({

        message:
          error.message

      });

    }

});



// ================= FORGOT PASSWORD =================

router.post(

  "/forgot-password",

  async (req, res) => {

    try {

      const { email } =
        req.body;



      const user =
        await User.findOne({

          email

        });



      if(!user){

        return res.status(400).json({

          message:
            "User not found"

        });

      }



      const otp =
        Math.floor(
          100000 +
          Math.random() * 900000
        ).toString();



      user.resetOtp = otp;

      await user.save();



      // SEND RESET EMAIL
      let emailSent = true;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "BusFlux Password Reset OTP",
          text: `Your password reset OTP is ${otp}`
        });
      } catch (mailError) {
        console.error("[OTP Service] Nodemailer failed to send reset email:", mailError.message);
        emailSent = false;
      }

      return res.status(200).json({
        message: emailSent ? "Reset OTP sent" : `Reset OTP simulated! (Dev Fallback: Code is ${otp})`
      });

    } catch (error) {

      return res.status(500).json({

        message:
          error.message

      });

    }

});



// ================= RESET PASSWORD =================

router.post(

  "/reset-password",

  async (req, res) => {

    try {

      const {

        email,
        otp,
        newPassword

      } = req.body;



      const user =
        await User.findOne({

          email

        });



      if(!user){

        return res.status(400).json({

          message:
            "User not found"

        });

      }



      if(user.resetOtp !== otp){

        return res.status(400).json({

          message:
            "Invalid OTP"

        });

      }



      // HASH NEW PASSWORD
      const hashedPassword =
        await bcrypt.hash(

          newPassword,

          10

        );



      user.password =
        hashedPassword;

      user.resetOtp = "";

      await user.save();



      return res.status(200).json({

        message:
          "Password reset successful"

      });

    } catch (error) {

      return res.status(500).json({

        message:
          error.message

      });

    }

});



// ================= GET PROFILE (/me) =================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -otp -resetOtp");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Generate permanent profile QR code (based on email)
    const qrcode = require("qrcode");
    const qrDataUrl = await qrcode.toDataURL(user.email);
    
    const userObj = user.toObject();
    userObj.profileQr = qrDataUrl;

    // Dynamically calculate actual age from dob so it never becomes outdated
    if (userObj.dob) {
      const dateStr = userObj.dob;
      let calculatedAge = userObj.age || 0;
      const currentYear = new Date().getFullYear();
      if (dateStr.length === 4) {
        calculatedAge = currentYear - parseInt(dateStr);
      } else {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const dobDate = new Date(parts[2], parts[1] - 1, parts[0]);
          const today = new Date();
          calculatedAge = today.getFullYear() - dobDate.getFullYear();
          const m = today.getMonth() - dobDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
              calculatedAge--;
          }
        }
      }
      userObj.age = calculatedAge;
      
      // Update DB in background if age has progressed
      if (calculatedAge > 0 && calculatedAge !== user.age) {
          user.age = calculatedAge;
          user.save().catch(e => console.error(e));
      }
    }

    // Downgrade student to young adult if passingYear is elapsed
    if (user.passingYear && new Date().getFullYear() > user.passingYear) {
      if (user.collegeId || user.institutionType) {
        user.collegeId = "";
        user.institutionType = "";
        user.institutionName = "";
        user.course = "";
        user.studentIdNumber = "";
        userObj.collegeId = "";
        userObj.institutionType = "";
        userObj.institutionName = "";
        userObj.course = "";
        userObj.studentIdNumber = "";
        user.save().catch(e => console.error("Downgrade save error:", e));
      }
    }

    return res.status(200).json(userObj);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});


// ================= UPDATE PROFILE (/me) =================
router.put("/me", auth, upload.fields([{ name: "userPhoto", maxCount: 1 }]), async (req, res) => {
  try {
    console.log("PUT /me headers:", req.headers["content-type"]);
    console.log("PUT /me body:", req.body);
    const { name, phone, age, experience } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (age !== undefined) {
      user.age = Number(age) || 0;
      if(user.age >= 5 && user.age <= 14) user.ageGroup = "Children";
      else if(user.age >= 15 && user.age <= 24) user.ageGroup = "Youth";
      else if(user.age >= 25 && user.age <= 44) user.ageGroup = "Young Adults";
      else if(user.age >= 45 && user.age <= 59) user.ageGroup = "Middle Age";
      else if(user.age >= 60 && user.age <= 74) user.ageGroup = "Elderly";
      else user.ageGroup = "Seniors";
    }
    if (experience !== undefined) {
      user.experience = Number(experience) || 0;
    }

    if (req.files && req.files.userPhoto) {
      const f = req.files.userPhoto[0];
      user.userPhoto = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
    }

    await user.save();
    return res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});




// ================= RAZORPAY CREATE ORDER =================
router.post("/wallet/create-order", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const rechargeAmount = Number(amount);
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      return res.status(400).json({ message: "Invalid recharge amount" });
    }

    const options = {
      amount: rechargeAmount * 100, // Razorpay works in paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };

    const order = await razorpayInstance.orders.create(options);
    if (!order) return res.status(500).json({ message: "Error creating order" });

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= RAZORPAY VERIFY PAYMENT =================
router.post("/wallet/verify-payment", auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, method } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dAW3H935TAk4XwTHo0x7fs0a")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const rechargeAmount = Number(amount);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let bonusPercent = 0.05;
    let passName = "Standard Pass";
    const age = user.age;
    if ((age >= 5 && age <= 14) || age >= 60) {
      bonusPercent = 0.30;
      passName = "Golden Pass";
    } else if (age >= 15 && age <= 24) {
      bonusPercent = 0.20;
      passName = "Youth Express Pass";
    }

    const bonus = Math.round(rechargeAmount * bonusPercent);
    const totalCredit = rechargeAmount + bonus;

    user.balance = (user.balance || 0) + totalCredit;
    await user.save();

    await Transaction.create({
      userId: user._id,
      amount: rechargeAmount,
      bonus: bonus,
      totalCredit: totalCredit,
      method: method || "Razorpay",
      status: "Completed"
    });

    return res.status(200).json({
      message: "Payment successful and wallet recharged!",
      rechargeAmount,
      bonus,
      totalCredit,
      newBalance: user.balance,
      passName,
      bonusPercent: bonusPercent * 100
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ================= GET WALLET TRANSACTIONS =================
router.get("/wallet/transactions", auth, async (req, res) => {
  try {
    const recharges = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const bookings = await Booking.find({ userId: req.user.id }).populate("busId").sort({ createdAt: -1 });
    
    // Combine them
    const combined = [];
    
    recharges.forEach(r => {
      combined.push({
        _id: r._id,
        type: "recharge",
        amount: r.amount,
        bonus: r.bonus,
        totalCredit: r.totalCredit,
        method: r.method,
        status: r.status,
        createdAt: r.createdAt
      });
    });
    
    bookings.forEach(b => {
      if (b.status === "failed") return;
      combined.push({
        _id: b._id,
        type: "booking",
        amount: -b.totalPrice,
        busName: b.busId?.busName || "BusFlux Ride",
        busNumber: b.busId?.busNumber || "",
        route: b.busId ? `${b.boardingPoint || b.busId.from} → ${b.droppingPoint || b.busId.to}` : "Ride",
        seatsBooked: b.seatsBooked,
        status: b.status === "paid" ? "Paid" : b.status,
        paymentMethod: b.paymentMethod,
        createdAt: b.createdAt
      });
    });
    
    // Sort combined by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.status(200).json(combined);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= GET USER NOTIFICATIONS =================
router.get("/notifications", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ targetUser: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= MARK NOTIFICATIONS AS READ =================
router.put("/notifications/read", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { targetUser: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

