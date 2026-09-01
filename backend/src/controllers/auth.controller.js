import User from "../model/User.js";
import jwt from "jsonwebtoken";
import { clearAuthCookie, generateToken } from "../lib/utils.js";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "../email/emailHandler.js";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import { createAuthSession, revokeAuthSession } from "../services/auth-session.service.js";
import { disconnectSession } from "../lib/socket.js";
import { closeSessionStreams } from "../services/event.service.js";
export const signUp = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid Email Format" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const newUser = new User({
      fullName,
      email: normalizedEmail,
      password: hashPassword,
    });

    const saveUser = await newUser.save();
    const authSession = await createAuthSession(saveUser._id, req);
    generateToken(saveUser._id, authSession.sessionId, res);
    res.status(201).json({
      _id: saveUser._id,
      fullName: saveUser.fullName,
      email: saveUser.email,
      profilePic: saveUser.profilePic,
    });
    sendWelcomeEmail(saveUser.email, saveUser.fullName, ENV.CLIENT_URL).catch(
      (error) => console.error("Welcome email error:", error)
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and Password are required" });
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid credentials" });
    const authSession = await createAuthSession(user._id, req);
    generateToken(user._id, authSession.sessionId, res);
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const logout = async (req, res) => {
  const token = req.cookies.jwt;
  let sessionId = null;
  try {
    const decoded = token ? jwt.verify(token, ENV.JWT_SECRET) : null;
    sessionId = decoded?.sessionId || null;
    if (sessionId) {
      await revokeAuthSession(sessionId, decoded.userId);
    }
  } catch {
    // Clearing an invalid cookie is still a successful logout.
  }
  clearAuthCookie(res);
  res.status(200).json({ message: "Logout Successfully" });
  if (sessionId) {
    disconnectSession(sessionId, "logout");
    closeSessionStreams(sessionId, "logout");
  }
};


export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic)
      return res.status(400).json({ message: "Profile picture is required" });
    const userId = req.user._id;
    const uploadRes = await cloudinary.uploader.upload(profilePic);
    const updateUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadRes.secure_url },
      { new: true }
    );
    res.status(200).json(updateUser);
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
