import authRoute from "./routes/auth.route.js";
import messageRoute from "./routes/message.route.js";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
dotenv.config();

const app = express();
const __dirname = path.resolve();
const PORT = ENV.PORT;
app.use(express.json())  // req.body
app.use("/api/auth", authRoute);
app.use("/api/messages", messageRoute);

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}
app.listen(PORT, () => {
  console.log("server running on port:", PORT);
  connectDB()
});
