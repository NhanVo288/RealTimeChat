import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { ENV } from "./env.js";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const cookieOptions = () => {
  const secure = ENV.NODE_ENV !== "development" || Boolean(ENV.TLS_KEY_PATH);
  return { httpOnly: true, sameSite: secure ? "none" : "lax", secure, path: "/" };
};

export const generateToken = (userId, sessionId, res) => {
  const token = jwt.sign({ userId: String(userId), sessionId, type: "access" }, ENV.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
  });
  res.cookie("jwt", token, { ...cookieOptions(), maxAge: ACCESS_TOKEN_TTL_MS });
  return token;
};

export const createRefreshToken = (userId, sessionId, expiresAt) => jwt.sign({
  userId: String(userId), sessionId, type: "refresh", jti: randomUUID(),
  exp: Math.floor(new Date(expiresAt).getTime() / 1000),
}, ENV.JWT_SECRET);

export const verifyAuthToken = (token, type, options = {}) => {
  const decoded = jwt.verify(token, ENV.JWT_SECRET, { ...options, algorithms: ["HS256"] });
  if (decoded.type !== type || typeof decoded.userId !== "string" ||
      typeof decoded.sessionId !== "string" || (type === "refresh" && !decoded.jti)) {
    throw new jwt.JsonWebTokenError("Invalid token type or claims");
  }
  return decoded;
};

export const setRefreshCookie = (res, token, expiresAt) => res.cookie("refreshToken", token, {
  ...cookieOptions(), path: "/api/auth", maxAge: Math.max(0, new Date(expiresAt).getTime() - Date.now()),
});

export const clearAuthCookie = (res) => {
  res.cookie("jwt", "", { ...cookieOptions(), maxAge: 0 });
  res.cookie("refreshToken", "", { ...cookieOptions(), path: "/api/auth", maxAge: 0 });
};
