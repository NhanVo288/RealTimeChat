import { createHash } from "node:crypto";
import { redis } from "../lib/redis.js";
import { createRefreshToken, generateToken, setRefreshCookie } from "../lib/utils.js";

const keyFor = (sessionId) => `auth:refresh:${sessionId}`;
const hash = (token) => createHash("sha256").update(token).digest("hex");

// Compare and replace atomically; missing/revoked keys are never recreated.
export const ROTATE_REFRESH_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
return 1
`;

export const saveRefreshToken = (session, token, client = redis) => client.set(
  keyFor(session.sessionId), hash(token),
  { PXAT: Math.floor(new Date(session.expiresAt).getTime() / 1000) * 1000, NX: true },
);

export const rotateRefreshToken = async (sessionId, previous, next, client = redis) =>
  (await client.eval(ROTATE_REFRESH_SCRIPT, {
    keys: [keyFor(sessionId)], arguments: [hash(previous), hash(next)],
  })) === 1;

export const revokeRefreshToken = (sessionId, client = redis) => client.del(keyFor(sessionId));

export const issueAuthTokens = async (session, res) => {
  const token = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  if (!(await saveRefreshToken(session, token))) throw new Error("Refresh session already exists");
  generateToken(session.userId, session.sessionId, res);
  setRefreshCookie(res, token, session.expiresAt);
};
