import User from "../model/User.js";
import jwt from "jsonwebtoken";
import { clearAuthCookie, generateToken, createRefreshToken, setRefreshCookie, verifyAuthToken } from "../lib/utils.js";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "../email/emailHandler.js";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import { createAuthSession, revokeAuthSession, findActiveAuthSession } from "../services/auth-session.service.js";
import { issueAuthTokens, rotateRefreshToken, revokeRefreshToken } from "../services/refresh-token.service.js";
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
    await issueAuthTokens(authSession, res);
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
    await issueAuthTokens(authSession, res);
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
  try {
    // Verify signatures even for expired cookies so logout also works after AT expiry.
    const sessions = new Map();
    for (const [token, type] of [[req.cookies?.refreshToken, "refresh"], [req.cookies?.jwt, "access"]]) {
      if (!token) continue;
      try {
        const decoded = verifyAuthToken(token, type, { ignoreExpiration: true });
        sessions.set(decoded.sessionId, decoded.userId);
      } catch (error) {
        if (!(error instanceof jwt.JsonWebTokenError)) throw error;
      }
    }
    for (const [sessionId, userId] of sessions) {
      await revokeAuthSession(sessionId, userId);
      await revokeRefreshToken(sessionId);
      disconnectSession(sessionId, "logout");
      closeSessionStreams(sessionId, "logout");
    }
    clearAuthCookie(res);
    return res.status(200).json({ message: "Logout Successfully" });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(503).json({ message: "Logout unavailable, please retry" });
  }
};

export const refresh = async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const previous = req.cookies?.refreshToken;
    if (!previous) return res.status(401).json({ message: "No refresh token provided" });
    const decoded = verifyAuthToken(previous, "refresh");
    const session = await findActiveAuthSession(decoded.sessionId, decoded.userId);
    if (!session || !(await User.exists({ _id: decoded.userId }))) {
      await revokeRefreshToken(decoded.sessionId);
      clearAuthCookie(res);
      return res.status(401).json({ message: "Session expired or revoked" });
    }
    const next = createRefreshToken(decoded.userId, decoded.sessionId, session.expiresAt);
    if (!(await rotateRefreshToken(decoded.sessionId, previous, next))) {
      // Do not clear cookies: a concurrent successful refresh may have just set them.
      return res.status(401).json({ message: "Refresh token expired, revoked or already used" });
    }
    generateToken(decoded.userId, decoded.sessionId, res);
    setRefreshCookie(res, next, session.expiresAt);
    return res.status(200).json({ message: "Token refreshed" });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    console.error("Refresh error:", error.message);
    return res.status(503).json({ message: "Refresh unavailable, please retry" });
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
