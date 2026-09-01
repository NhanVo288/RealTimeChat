import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-session-secret";

const { default: jwt } = await import("jsonwebtoken");
const { clearAuthCookie, generateToken } = await import("../src/lib/utils.js");

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
  assert.equal(response.cookies[0].options.maxAge, 7 * 24 * 60 * 60 * 1000);
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
