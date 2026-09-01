import { randomUUID } from "node:crypto";
import AuthSession from "../model/AuthSession.js";

export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const createAuthSession = (userId, request) => AuthSession.create({
  userId,
  sessionId: randomUUID(),
  userAgent: String(request?.get?.("user-agent") || "Browser").slice(0, 240),
  expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_MS),
});

export const findActiveAuthSession = (sessionId, userId) => AuthSession.findOne({
  sessionId,
  userId,
  revokedAt: null,
  expiresAt: { $gt: new Date() },
});

export const revokeAuthSession = (sessionId, userId) => AuthSession.findOneAndUpdate(
  { sessionId, userId, revokedAt: null },
  { revokedAt: new Date() },
  { new: true }
);

export const touchAuthSession = (authSessionId) => AuthSession.updateOne(
  { _id: authSessionId, revokedAt: null },
  { lastSeenAt: new Date() }
);
