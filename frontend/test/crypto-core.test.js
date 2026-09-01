import test from "node:test";
import assert from "node:assert/strict";
import {
  E2EE_ALGORITHM,
  authenticatedMessageMetadata,
  canonicalize,
  deviceEncryptionKeyData,
  isCurrentMessageKeyCache,
  mergeHistoricalKeyEntries,
  messageKeyCacheKey,
  peerIdentityPinKey,
  unsignedPayload,
} from "../src/shared/lib/crypto-core.js";

test("message key cache is invalidated when an edited payload has a new signature", () => {
  const cached = { payloadSignature: "revision-0", key: { type: "secret" } };
  assert.equal(isCurrentMessageKeyCache(cached, { signature: "revision-0" }), true);
  assert.equal(isCurrentMessageKeyCache(cached, { signature: "revision-1" }), false);
  assert.equal(messageKeyCacheKey("user-a", "message-a"), "message-key:user-a:message-a");
});

test("v3 signed fields bind sender, message identity, revision and content type", () => {
  const payload = {
    version: 3,
    algorithm: E2EE_ALGORITHM,
    senderUserId: "sender",
    senderDeviceId: "device",
    senderSigningKey: { kty: "EC" },
    context: "conversation:id",
    messageId: "client-message-id",
    revision: 3,
    contentType: "text",
    iv: "iv",
    ciphertext: "ciphertext",
    envelopes: [],
  };
  const signed = unsignedPayload(payload);
  assert.equal(signed.senderUserId, "sender");
  assert.equal(signed.messageId, "client-message-id");
  assert.equal(signed.revision, 3);
  assert.equal(signed.contentType, "text");
  assert.notEqual(
    canonicalize(authenticatedMessageMetadata(payload)),
    canonicalize(authenticatedMessageMetadata({ ...payload, revision: 4 }))
  );
});

test("legacy v1 signature shape remains stable for stored messages", () => {
  const payload = {
    version: 1,
    algorithm: E2EE_ALGORITHM,
    senderDeviceId: "device",
    senderSigningKey: {},
    context: "direct:a:b",
    iv: "iv",
    ciphertext: "ciphertext",
    envelopes: [],
    senderUserId: "must-not-be-signed-for-v1",
  };
  assert.equal(Object.hasOwn(unsignedPayload(payload), "senderUserId"), false);
});

test("identity pins are scoped to owner, peer user and peer device", () => {
  assert.equal(
    peerIdentityPinKey("owner", "peer", "device"),
    "peer-pin:owner:peer:device"
  );
});

test("device encryption-key signatures bind both device id and public key", () => {
  const publicKey = { kty: "EC", crv: "P-256", x: "x", y: "y" };
  assert.notEqual(
    deviceEncryptionKeyData("device-a", publicKey),
    deviceEncryptionKeyData("device-b", publicKey)
  );
  assert.notEqual(
    deviceEncryptionKeyData("device-a", publicKey),
    deviceEncryptionKeyData("device-a", { ...publicKey, x: "other" })
  );
});

test("historical device keys merge deterministically without replacing a device key", () => {
  const first = { deviceId: "device-b", privateKeyPkcs8: "key-b" };
  const second = { deviceId: "device-a", privateKeyPkcs8: "key-a" };
  assert.deepEqual(mergeHistoricalKeyEntries([first], [second, first]), [second, first]);
  assert.throws(
    () => mergeHistoricalKeyEntries([first], [{ ...first, privateKeyPkcs8: "changed" }]),
    /Conflicting historical device key/
  );
});
