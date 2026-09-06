import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.JWT_SECRET = "test-refresh-secret";
process.env.RESEND_KEY = "re_test";
process.env.TLS_KEY_PATH = "";
process.env.TLS_CERT_PATH = "";
const { redis } = await import("../src/lib/redis.js");
const { default: AuthSession } = await import("../src/model/AuthSession.js");
const { default: User } = await import("../src/model/User.js");
const { refresh, logout } = await import("../src/controllers/auth.controller.js");
const { createRefreshToken, generateToken } = await import("../src/lib/utils.js");
const { saveRefreshToken, rotateRefreshToken, revokeRefreshToken } = await import("../src/services/refresh-token.service.js");
const { default: jwt } = await import("jsonwebtoken");
const { protectRoute } = await import("../src/middleware/auth.middleware.js");

const response = () => ({
  cookies: [], statusCode: 200,
  cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
  status(code) { this.statusCode = code; return this; },
  set() { return this; },
  json(body) { this.body = body; return this; },
});

function setup(t) {
  const session = { userId: "111111111111111111111111", sessionId: randomUUID(), expiresAt: new Date(Date.now() + 86400000) };
  const values = new Map();
  t.mock.method(redis, "set", async (key, value) => { values.set(key, value); return "OK"; });
  t.mock.method(redis, "del", async (key) => Number(values.delete(key)));
  // Controller unit tests emulate CAS; the integration test below runs the real Lua.
  t.mock.method(redis, "eval", async (_script, { keys, arguments: args }) => {
    if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[0], args[1]); return 1;
  });
  t.mock.method(AuthSession, "findOne", async () => session.revokedAt ? null : session);
  t.mock.method(AuthSession, "findOneAndUpdate", async () => { session.revokedAt = new Date(); return session; });
  t.mock.method(User, "exists", async () => ({ _id: session.userId }));
  return { session, values };
}

test("refresh rotates once; replay and concurrent reuse fail", async (t) => {
  const { session, values } = setup(t);
  const token = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  await saveRefreshToken(session, token);
  assert.notEqual([...values.values()][0], token);
  const responses = [response(), response()];
  await Promise.all(responses.map((res) => refresh({ cookies: { refreshToken: token } }, res)));
  assert.deepEqual(responses.map((res) => res.statusCode).sort(), [200, 401]);
  const next = responses.find((res) => res.statusCode === 200).cookies.find((cookie) => cookie.name === "refreshToken").value;
  assert.notEqual(next, token);
  const nextResponse = response();
  await refresh({ cookies: { refreshToken: next } }, nextResponse);
  assert.equal(nextResponse.statusCode, 200);
});

test("logout with expired access token revokes the current RT, including after rotation", async (t) => {
  const { session, values } = setup(t);
  const old = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  const current = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  await saveRefreshToken(session, old);
  await rotateRefreshToken(session.sessionId, old, current);
  const expiredAccess = jwt.sign({ userId: session.userId, sessionId: session.sessionId, type: "access" }, process.env.JWT_SECRET, { expiresIn: -1 });
  const res = response();
  await logout({ cookies: { jwt: expiredAccess, refreshToken: old } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(values.size, 0);
  assert.ok(session.revokedAt);
  assert.equal(res.cookies.length, 2);
  const retry = response();
  await refresh({ cookies: { refreshToken: current } }, retry);
  assert.equal(retry.statusCode, 401);
});

test("refresh rejects an access token and revoked Mongo session", async (t) => {
  const { session } = setup(t);
  const access = generateToken(session.userId, session.sessionId, response());
  const invalid = response();
  await refresh({ cookies: { refreshToken: access } }, invalid);
  assert.equal(invalid.statusCode, 401);
  session.revokedAt = new Date();
  const token = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  await saveRefreshToken(session, token);
  const revoked = response();
  await refresh({ cookies: { refreshToken: token } }, revoked);
  assert.equal(revoked.statusCode, 401);
});

test("Redis failures do not report successful refresh or logout", async (t) => {
  const { session } = setup(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(redis, "eval", async () => { throw new Error("Redis unavailable"); });
  t.mock.method(redis, "del", async () => { throw new Error("Redis unavailable"); });
  const token = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  for (const handler of [refresh, logout]) {
    const res = response();
    await handler({ cookies: { refreshToken: token } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.cookies.length, 0);
  }
});

test("expired access token returns 401 without clearing the refresh cookie", async () => {
  const token = jwt.sign({ userId: "user", sessionId: "session", type: "access" },
    process.env.JWT_SECRET, { expiresIn: -1 });
  const res = response();
  await protectRoute({ cookies: { jwt: token } }, res, () => assert.fail("must not authorize"));
  assert.equal(res.statusCode, 401);
  assert.equal(res.cookies.length, 0);
});

test("an in-flight refresh cannot recreate RT state after logout", async (t) => {
  const { session, values } = setup(t);
  const token = createRefreshToken(session.userId, session.sessionId, session.expiresAt);
  await saveRefreshToken(session, token);
  let resume;
  let reached;
  const atRotation = new Promise((resolve) => { reached = resolve; });
  const gate = new Promise((resolve) => { resume = resolve; });
  const evaluate = redis.eval.bind(redis);
  t.mock.method(redis, "eval", async (...args) => {
    reached();
    await gate;
    return evaluate(...args);
  });
  const refreshed = response();
  const pending = refresh({ cookies: { refreshToken: token } }, refreshed);
  await atRotation;
  const loggedOut = response();
  await logout({ cookies: { refreshToken: token } }, loggedOut);
  resume();
  await pending;
  assert.equal(loggedOut.statusCode, 200);
  assert.equal(refreshed.statusCode, 401);
  assert.equal(values.size, 0);
});

test("real Redis: atomic rotation, TTL preservation, expiry and revocation", {
  skip: !process.env.REDIS_TEST_URL,
}, async () => {
  const { createClient } = await import("redis");
  const client = createClient({ url: process.env.REDIS_TEST_URL, socket: { reconnectStrategy: false } });
  client.on("error", () => {});
  const session = { sessionId: `test-${randomUUID()}`, expiresAt: new Date(Date.now() + 60000) };
  const key = `auth:refresh:${session.sessionId}`;
  await client.connect();
  try {
    await saveRefreshToken(session, "old", client);
    const ttl = await client.pTTL(key);
    const results = await Promise.all([
      rotateRefreshToken(session.sessionId, "old", "next", client),
      rotateRefreshToken(session.sessionId, "old", "other", client),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.ok(await client.pTTL(key) <= ttl);
    assert.ok(await client.pTTL(key) > 0);
    await revokeRefreshToken(session.sessionId, client);
    assert.equal(await rotateRefreshToken(session.sessionId, "next", "again", client), false);
    session.expiresAt = new Date(Date.now() - 1000);
    await saveRefreshToken(session, "expired", client);
    assert.equal(await rotateRefreshToken(session.sessionId, "expired", "again", client), false);
  } finally {
    await client.del(key);
    await client.close();
  }
});
