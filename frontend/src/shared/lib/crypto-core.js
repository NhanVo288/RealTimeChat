export const E2EE_ALGORITHM = "ECDH-P256/HKDF-SHA256/AES-256-GCM";
export const E2EE_VERSION = 3;
export const KEY_BACKUP_VERSION = 1;
export const KEY_BACKUP_ITERATIONS = 600_000;

export const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const unsignedPayload = (payload) => {
  const common = {
    version: payload.version,
    algorithm: payload.algorithm,
    senderDeviceId: payload.senderDeviceId,
    senderSigningKey: payload.senderSigningKey,
    context: payload.context,
    iv: payload.iv,
    ciphertext: payload.ciphertext,
    envelopes: payload.envelopes,
  };
  if (payload.version < 2) return common;
  return {
    ...common,
    senderUserId: payload.senderUserId,
    messageId: payload.messageId,
    revision: payload.revision,
    contentType: payload.contentType,
  };
};

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

export const messageKeyCacheKey = (userId, messageId) =>
  `message-key:${userId}:${messageId}`;

export const isCurrentMessageKeyCache = (cached, payload) => Boolean(
  cached?.key && cached.payloadSignature === payload.signature
);

export const peerIdentityPinKey = (ownerUserId, peerUserId, deviceId) =>
  `peer-pin:${ownerUserId}:${peerUserId}:${deviceId}`;

export const mergeHistoricalKeyEntries = (...collections) => {
  const entries = new Map();
  collections.flat().forEach((entry) => {
    if (!entry || typeof entry.deviceId !== "string" || !entry.deviceId ||
      entry.deviceId.length > 100 || typeof entry.privateKeyPkcs8 !== "string" ||
      !entry.privateKeyPkcs8) return;
    const existing = entries.get(entry.deviceId);
    if (existing && existing.privateKeyPkcs8 !== entry.privateKeyPkcs8) {
      throw new Error("Conflicting historical device key");
    }
    entries.set(entry.deviceId, {
      deviceId: entry.deviceId,
      privateKeyPkcs8: entry.privateKeyPkcs8,
    });
  });
  return [...entries.values()].sort((first, second) =>
    first.deviceId.localeCompare(second.deviceId)
  );
};
