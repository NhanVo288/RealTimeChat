import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-session-secret";

const { default: jwt } = await import("jsonwebtoken");
const { clearAuthCookie, generateToken, createRefreshToken, verifyAuthToken, setRefreshCookie } = await import("../src/lib/utils.js");

const createResponse = () => ({
  cookies: [],
  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
  },
});

test("JWT binds a user to an auth session and uses an HTTP-only cookie", () => {
  const response = createResponse();
  const token = generateToken("111111111111111111111111", "session-id", response);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  assert.equal(decoded.userId, "111111111111111111111111");
  assert.equal(decoded.sessionId, "session-id");
  assert.equal(response.cookies[0].name, "jwt");
  assert.equal(response.cookies[0].options.httpOnly, true);
  assert.equal(decoded.type, "access");
  assert.equal(decoded.exp - decoded.iat, 15 * 60);
  assert.equal(response.cookies[0].options.maxAge, 15 * 60 * 1000);
});

test("clearing auth uses the same cookie scope", () => {
  const issuedResponse = createResponse();
  generateToken("111111111111111111111111", "session-id", issuedResponse);
  const response = createResponse();
  clearAuthCookie(response);
  assert.equal(response.cookies[0].name, "jwt");
  assert.equal(response.cookies[0].value, "");
  assert.equal(response.cookies[0].options.maxAge, 0);
  assert.equal(response.cookies[0].options.httpOnly, issuedResponse.cookies[0].options.httpOnly);
  assert.equal(response.cookies[0].options.sameSite, issuedResponse.cookies[0].options.sameSite);
  assert.equal(response.cookies[0].options.secure, issuedResponse.cookies[0].options.secure);
});

test("refresh tokens are unique, expire with the session and cannot be used as access tokens", () => {
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const first = createRefreshToken("user", "session", expiresAt);
  const second = createRefreshToken("user", "session", expiresAt);
  assert.notEqual(first, second);
  assert.equal(verifyAuthToken(first, "refresh").exp, Math.floor(expiresAt.getTime() / 1000));
  assert.throws(() => verifyAuthToken(first, "access"));
  const access = generateToken("user", "session", createResponse());
  assert.throws(() => verifyAuthToken(access, "refresh"));
  const expired = createRefreshToken("user", "session", new Date(Date.now() - 10000));
  assert.throws(() => verifyAuthToken(expired, "refresh"));
  assert.equal(verifyAuthToken(expired, "refresh", { ignoreExpiration: true }).sessionId, "session");
});

test("refresh cookie is HTTP-only and logout clears its exact scope", () => {
  const issued = createResponse();
  setRefreshCookie(issued, "token", new Date(Date.now() + 86400000));
  const cleared = createResponse();
  clearAuthCookie(cleared);
  const cookie = issued.cookies[0];
  const removed = cleared.cookies.find((item) => item.name === cookie.name);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.path, "/api/auth");
  assert.equal(removed.value, "");
  assert.deepEqual(removed.options, { ...cookie.options, maxAge: 0 });
});
