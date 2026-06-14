
const express =
  require("express");

const cors =
  require("cors");

const dotenv =
  require("dotenv");

const path =
  require("path");



// ================= ENV =================

dotenv.config();



// ================= DATABASE =================

const connectDB =
  require("./config/db");



// ================= ROUTES =================

const authRoutes =
  require("./routes/authRoutes");

const busRoutes =
  require("./routes/busRoutes");

const bookingRoutes =
  require("./routes/bookingRoutes");

const adminRoutes =
  require("./routes/adminRoutes");

const paymentRoutes = require("./routes/paymentRoutes");



// ================= CONNECT DATABASE =================

connectDB();



// ================= EXPRESS APP & SOCKET.IO =================

const app = express();
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.set('io', io); // Make io available in routes via req.app.get('io')

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  
  socket.on('join_room', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`Socket ${socket.id} joined room: ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});



// ================= MIDDLEWARE =================

app.use(cors());

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl || req.url}`);
  next();
});



// ================= STATIC UPLOADS =================

app.use(

  "/uploads",

  express.static(path.join(__dirname, "uploads"))

);



// ================= API ROUTES =================

// AUTH
app.use(

  "/api/auth",

  authRoutes

);


// BUSES
app.use(

  "/api/buses",

  busRoutes

);


// BOOKINGS
app.use(

  "/api/bookings",

  bookingRoutes

);



// ADMIN
app.use(

  "/api/admin",

  adminRoutes

);


// PAYMENT
app.use(
  "/api/payment",
  paymentRoutes
);

// CONDUCTOR
app.use("/api/conductor", require("./routes/conductorRoutes"));



// ================= STATIC FRONTEND =================
app.use(express.static(path.join(__dirname, "../frontend")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});



// ================= SERVER =================

const PORT =

  process.env.PORT ||

  5000;



server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
