import jwt from "jsonwebtoken";
import User from "../model/User.js";
import { ENV } from "../lib/env.js";
import { findActiveAuthSession } from "../services/auth-session.service.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.headers.cookie
      ?.split("; ")
      .find((row) => row.startsWith("jwt="))
      ?.split("=")[1];
    if (!token) {
      console.log("Socket connect error: No token provided");
      return next(new Error("Unauthorized - No token provided"));
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    if (!decoded) {
      console.log("Socket connect error : invalid token");
      return next(new Error("Invalid Token"));
    }
    if (!decoded.sessionId) {
      return next(new Error("Session upgrade required"));
    }
    const authSession = await findActiveAuthSession(decoded.sessionId, decoded.userId);
    if (!authSession) {
      return next(new Error("Session expired or revoked"));
    }
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.log("Socket connect error: User not found");
      return next(new Error("User Not Found"));
    }
    socket.user = user;
    socket.userId = user._id.toString();
    socket.sessionId = authSession.sessionId;
    console.log(
      `Socket authenticated for user: ${user.fullName} (${user._id})`
    );
    next();
  } catch (error) {
    console.log("Socket error", error)
    next(new Error('Socket Authenticated Error'))
  }
};
