// app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./config/db");
const mainRouter = require("./routes");
const { authLimiter } = require("./middlewares/rateLimit");
const errorHandler = require("./middlewares/error");

const app = express();

// Trust proxy (needed for Render/Vercel)
app.set("trust proxy", 1);

// Security middlewares
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Logging (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ✅ CORS configuration for frontend and local testing
const allowedOrigins = [
  process.env.CLIENT_URL,      // Production frontend (Vercel)
  "http://localhost:5173",     // Local frontend
  "https://www.faaruuqbookshop.com"      // Optional: React default
];

app.use(
  cors({
    origin: function(origin, callback) {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS policy: Origin not allowed"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Rate limiter for auth routes (optional)
app.use("/api/v1/auth", authLimiter);

// API routes
app.use("/api/v1", mainRouter);

// Global error handler
app.use(errorHandler);

// Connect to MongoDB
connectDB(process.env.MONGO_URI);

module.exports = app;
