import { webcrypto } from "node:crypto";

export const E2EE_ALGORITHM = "ECDH-P256/HKDF-SHA256/AES-256-GCM";
export const E2EE_VERSION = 3;

const objectIdPattern = /^[a-f\d]{24}$/i;
const base64Pattern = /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/;
const base64UrlPattern = /^[A-Za-z\d_-]+$/;

export const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const unsignedPayload = (payload) => ({
  version: payload.version,
  algorithm: payload.algorithm,
  senderDeviceId: payload.senderDeviceId,
  senderSigningKey: payload.senderSigningKey,
  context: payload.context,
  iv: payload.iv,
  ciphertext: payload.ciphertext,
  envelopes: payload.envelopes,
  senderUserId: payload.senderUserId,
  messageId: payload.messageId,
  revision: payload.revision,
  contentType: payload.contentType,
});

export const authenticatedMessageMetadata = (payload) => ({
  version: payload.version,
  algorithm: payload.algorithm,
  senderUserId: payload.senderUserId,
  senderDeviceId: payload.senderDeviceId,
  context: payload.context,
  messageId: payload.messageId,
  revision: payload.revision,
  contentType: payload.contentType,
});

export const deviceEncryptionKeyData = (deviceId, publicKey) => canonicalize({
  deviceId,
  publicKey,
});

const decodeBase64 = (value) => {
  if (typeof value !== "string" || !value.length || !base64Pattern.test(value)) return null;
  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
};

export const isPublicP256Key = (key) => {
  if (!key || key.kty !== "EC" || key.crv !== "P-256" || key.d ||
    typeof key.x !== "string" || typeof key.y !== "string" ||
    !base64UrlPattern.test(key.x) || !base64UrlPattern.test(key.y)) return false;
  try {
    return Buffer.from(key.x, "base64url").length === 32 &&
      Buffer.from(key.y, "base64url").length === 32;
  } catch {
    return false;
  }
};

export const isBase64WithByteLength = (value, minimum, maximum = minimum) => {
  const decoded = decodeBase64(value);
  return Boolean(decoded && decoded.length >= minimum && decoded.length <= maximum);
};

export const validatePayloadShape = (payload) => {
  if (!payload || payload.version !== E2EE_VERSION || payload.algorithm !== E2EE_ALGORITHM ||
    !objectIdPattern.test(payload.senderUserId || "") ||
    typeof payload.senderDeviceId !== "string" || !payload.senderDeviceId.length ||
    payload.senderDeviceId.length > 100 || typeof payload.context !== "string" ||
    !payload.context.length || payload.context.length > 200 ||
    typeof payload.messageId !== "string" || !payload.messageId.length || payload.messageId.length > 100 ||
    !Number.isSafeInteger(payload.revision) || payload.revision < 0 ||
    !["text", "image"].includes(payload.contentType) || !isPublicP256Key(payload.senderSigningKey) ||
    !isBase64WithByteLength(payload.iv, 12) ||
    !isBase64WithByteLength(payload.ciphertext, 16, 10_000_000) ||
    !isBase64WithByteLength(payload.signature, 64) || !Array.isArray(payload.envelopes) ||
    !payload.envelopes.length || payload.envelopes.length > 500) return false;

  const deviceRecipients = new Set();
  return payload.envelopes.every((envelope) => {
    const deviceRecipient = `${envelope?.userId}:${envelope?.deviceId}`;
    if (!envelope || deviceRecipients.has(deviceRecipient)) return false;
    deviceRecipients.add(deviceRecipient);
    return objectIdPattern.test(String(envelope.userId || "")) &&
      typeof envelope.deviceId === "string" && envelope.deviceId.length > 0 &&
      envelope.deviceId.length <= 100 &&
      isPublicP256Key(envelope.ephemeralPublicKey) &&
      isBase64WithByteLength(envelope.iv, 12) &&
      isBase64WithByteLength(envelope.ciphertext, 48);
  });
};

export const parseEncryptionContext = (context, requesterId) => {
  if (typeof context !== "string") return null;
  const groupMatch = /^conversation:([a-f\d]{24})$/i.exec(context);
  if (groupMatch) return { type: "group", conversationId: groupMatch[1], userIds: null };

  const directMatch = /^direct:([a-f\d]{24}):([a-f\d]{24})$/i.exec(context);
  if (!directMatch) return null;
  const userIds = [directMatch[1], directMatch[2]];
  if (userIds[0] === userIds[1] || userIds.join(":") !== [...userIds].sort().join(":") ||
    !userIds.includes(String(requesterId))) return null;
  return { type: "direct", conversationId: null, userIds };
};

const verifyEcdsa = async (publicJwk, signature, data) => {
  try {
    const key = await webcrypto.subtle.importKey(
      "jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
    return webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, key,
      Buffer.from(signature, "base64"), Buffer.from(data)
    );
  } catch {
    return false;
  }
};

export const verifyDeviceEncryptionKeySignature = (
  identityKey,
  deviceId,
  encryptionPublicKey,
  signature
) => verifyEcdsa(
  identityKey,
  signature,
  deviceEncryptionKeyData(deviceId, encryptionPublicKey)
);

export const verifyPayloadSignature = (payload, identityKey = payload.senderSigningKey) =>
  verifyEcdsa(identityKey, payload.signature, canonicalize(unsignedPayload(payload)));
