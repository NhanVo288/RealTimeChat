import authRoute from "./routes/auth.route.js";
import messageRoute from "./routes/message.route.js";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";
dotenv.config();

const __dirname = path.resolve();
const PORT = ENV.PORT;
const allowedOrigins = [
  "http://localhost:5173",          // frontend dev
  "https://admin-36.up.railway.app",
  "https://shop-36.up.railway.app",
  "http://localhost:3000"
];
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
// app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.options("*", cors());
app.use(cookieParser());
app.use("/api/auth", authRoute);
app.use("/api/messages", messageRoute);
app.get("/health",(req,res) => {
  res.status(200).json({status: "true"})
})

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}
server.listen(PORT, () => {
  console.log("server running on port:", PORT);
  connectDB();
});
