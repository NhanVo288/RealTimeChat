import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  E2EE_ALGORITHM,
  canonicalize,
  deviceEncryptionKeyData,
  parseEncryptionContext,
  unsignedPayload,
  validatePayloadShape,
  verifyDeviceEncryptionKeySignature,
  verifyPayloadSignature,
} from "../src/lib/e2ee.js";

const bytes64 = (length) => Buffer.alloc(length, 7).toString("base64");

const createIdentity = async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  );
  return {
    pair,
    publicKey: await webcrypto.subtle.exportKey("jwk", pair.publicKey),
  };
};

const createEncryptionKey = async (identity, deviceId = "device-id") => {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const publicKey = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.pair.privateKey,
    Buffer.from(deviceEncryptionKeyData(deviceId, publicKey))
  );
  return { deviceId, publicKey, signature: Buffer.from(signature).toString("base64") };
};

const createSignedPayload = async (identity) => {
  const ephemeral = await webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const payload = {
    version: 3,
    algorithm: E2EE_ALGORITHM,
    senderUserId: "111111111111111111111111",
    senderDeviceId: "sender-device",
    senderSigningKey: identity.publicKey,
    context: "direct:111111111111111111111111:222222222222222222222222",
    messageId: "4af31f45-9f82-42ea-8532-5dc5d8860532",
    revision: 0,
    contentType: "text",
    iv: bytes64(12),
    ciphertext: bytes64(32),
    envelopes: [{
      userId: "222222222222222222222222",
      deviceId: "recipient-device",
      ephemeralPublicKey: await webcrypto.subtle.exportKey("jwk", ephemeral.publicKey),
      iv: bytes64(12),
      ciphertext: bytes64(48),
    }],
  };
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, identity.pair.privateKey,
    Buffer.from(canonicalize(unsignedPayload(payload)))
  );
  payload.signature = Buffer.from(signature).toString("base64");
  return payload;
};

test("device encryption keys are signed by the device identity", async () => {
  const identity = await createIdentity();
  const encryptionKey = await createEncryptionKey(identity);
  assert.equal(await verifyDeviceEncryptionKeySignature(
    identity.publicKey,
    encryptionKey.deviceId,
    encryptionKey.publicKey,
    encryptionKey.signature
  ), true);
  assert.equal(await verifyDeviceEncryptionKeySignature(
    identity.publicKey,
    "another-device",
    encryptionKey.publicKey,
    encryptionKey.signature
  ), false);
});

test("payload signature binds message id and edit revision", async () => {
  const identity = await createIdentity();
  const payload = await createSignedPayload(identity);
  assert.equal(validatePayloadShape(payload), true);
  assert.equal(await verifyPayloadSignature(payload), true);
  assert.equal(await verifyPayloadSignature({ ...payload, revision: 1 }), false);
  assert.equal(await verifyPayloadSignature({ ...payload, messageId: "another-message" }), false);
  assert.equal(await verifyPayloadSignature({ ...payload, senderUserId: "333333333333333333333333" }), false);
});

test("payload shape rejects duplicate device envelopes and malformed IVs", async () => {
  const identity = await createIdentity();
  const payload = await createSignedPayload(identity);
  assert.equal(validatePayloadShape({
    ...payload,
    envelopes: [...payload.envelopes, { ...payload.envelopes[0] }],
  }), false);
  assert.equal(validatePayloadShape({ ...payload, iv: bytes64(8) }), false);
});

test("bundle context is scoped to requester and canonical direct ordering", () => {
  const requester = "111111111111111111111111";
  const peer = "222222222222222222222222";
  assert.deepEqual(parseEncryptionContext(`direct:${requester}:${peer}`, requester), {
    type: "direct",
    conversationId: null,
    userIds: [requester, peer],
  });
  assert.equal(parseEncryptionContext(`direct:${peer}:${requester}`, requester), null);
  assert.equal(parseEncryptionContext(`direct:${peer}:333333333333333333333333`, requester), null);
  assert.deepEqual(parseEncryptionContext(`conversation:${peer}`, requester), {
    type: "group",
    conversationId: peer,
    userIds: null,
  });
});

test("v3 envelope shape has no pre-key metadata", async () => {
  const identity = await createIdentity();
  const payload = await createSignedPayload(identity);
  assert.equal(Object.hasOwn(payload.envelopes[0], "keyId"), false);
  assert.equal(Object.hasOwn(payload.envelopes[0], "keyType"), false);
  assert.equal(validatePayloadShape(payload), true);
});
