import { axiosInstance } from "./axios";
import {
  E2EE_ALGORITHM,
  E2EE_VERSION,
  authenticatedMessageMetadata,
  canonicalize,
  deviceEncryptionKeyData,
  isCurrentMessageKeyCache,
  messageKeyCacheKey,
  peerIdentityPinKey,
  unsignedPayload,
} from "./crypto-core";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const dbName = "realtime-chat-e2ee-v1";
const storeName = "keys";
let currentUserId = null;
let devicePromise = null;
let databasePromise = null;
let sessionVersion = 0;
let sessionController = null;

const bytesToBase64 = (bytes) => {
  let value = "";
  const array = new Uint8Array(bytes);
  for (let index = 0; index < array.length; index += 0x8000) {
    value += String.fromCharCode(...array.subarray(index, index + 0x8000));
  }
  return btoa(value);
};

const base64ToBytes = (value) => Uint8Array.from(
  atob(value), (character) => character.charCodeAt(0)
);

const openDatabase = () => {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(request.error);
      };
    });
  }
  return databasePromise;
};

const databaseOperation = async (mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || request.error);
    transaction.onabort = () => reject(transaction.error || request.error);
  });
};

const readKey = (key) => databaseOperation("readonly", (store) => store.get(key));
const writeKey = (key, value) => databaseOperation("readwrite", (store) => store.put(value, key));
const deleteKey = (key) => databaseOperation("readwrite", (store) => store.delete(key));

const assertActiveSession = (device, version) => {
  if (version !== sessionVersion || String(device.userId) !== String(currentUserId)) {
    throw new DOMException("E2EE session changed", "AbortError");
  }
};

const generateKeyPair = async (name, usages) => {
  const generated = await crypto.subtle.generateKey({ name, namedCurve: "P-256" }, true, usages);
  const [publicKey, privatePkcs8] = await Promise.all([
    crypto.subtle.exportKey("jwk", generated.publicKey),
    crypto.subtle.exportKey("pkcs8", generated.privateKey),
  ]);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", privatePkcs8, { name, namedCurve: "P-256" }, false,
    name === "ECDSA" ? ["sign"] : ["deriveBits"]
  );
  return { publicKey, privateKey };
};

const signDeviceEncryptionKey = async (deviceId, publicKey, identityPrivateKey) =>
  bytesToBase64(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identityPrivateKey,
    encoder.encode(deviceEncryptionKeyData(deviceId, publicKey))
  ));

const createDevice = async (userId) => {
  const [identity, encryption] = await Promise.all([
    generateKeyPair("ECDSA", ["sign", "verify"]),
    generateKeyPair("ECDH", ["deriveBits"]),
  ]);
  const deviceId = crypto.randomUUID();
  encryption.signature = await signDeviceEncryptionKey(
    deviceId,
    encryption.publicKey,
    identity.privateKey
  );
  return { userId, deviceId, identity, encryption };
};

const migrateDevice = async (device) => {
  if (!device.encryption?.privateKey || !device.encryption?.publicKey) {
    device.encryption = await generateKeyPair("ECDH", ["deriveBits"]);
  }
  if (!device.encryption.signature) {
    device.encryption.signature = await signDeviceEncryptionKey(
      device.deviceId,
      device.encryption.publicKey,
      device.identity.privateKey
    );
  }
};

const registerDevice = async (device, version) => {
  assertActiveSession(device, version);
  await axiosInstance.put(`/auth/devices/${device.deviceId}`, {
    name: navigator.userAgent.slice(0, 120),
    identitySigningKey: device.identity.publicKey,
    encryptionPublicKey: device.encryption.publicKey,
    encryptionKeySignature: device.encryption.signature,
  }, { signal: sessionController?.signal });
  assertActiveSession(device, version);
  await writeKey(`device:${device.userId}`, device);
  return device;
};

export const initializeE2EE = async (userId) => {
  if (!window.isSecureContext || !crypto?.subtle || typeof indexedDB === "undefined") {
    throw new Error("E2EE requires HTTPS (or localhost) and Web Crypto support");
  }
  const normalizedUserId = String(userId);
  if (currentUserId === normalizedUserId && devicePromise) return devicePromise;

  sessionController?.abort();
  sessionVersion += 1;
  const version = sessionVersion;
  sessionController = new AbortController();
  currentUserId = normalizedUserId;
  devicePromise = (async () => {
    let device = await readKey(`device:${normalizedUserId}`);
    if (!device) device = await createDevice(normalizedUserId);
    else await migrateDevice(device);
    assertActiveSession(device, version);
    await writeKey(`device:${normalizedUserId}`, device);
    return registerDevice(device, version);
  })().catch((error) => {
    if (version === sessionVersion) devicePromise = null;
    throw error;
  });
  return devicePromise;
};

const deriveEcdhWrappingKey = async (privateKey, publicJwk, salt, info) => {
  const publicKey = await crypto.subtle.importKey(
    "jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey }, privateKey, 256
  );
  const material = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode(salt), info: encoder.encode(info) },
    material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
};

const deriveV3WrappingKey = (privateKey, publicJwk, deviceId, payload) =>
  deriveEcdhWrappingKey(
    privateKey,
    publicJwk,
    `realtime-chat:v3:${deviceId}`,
    `message-key:${payload.context}:${payload.messageId}:${payload.revision}`
  );

const deriveLegacyWrappingKey = (privateKey, publicJwk, deviceId, keyId) =>
  deriveEcdhWrappingKey(
    privateKey,
    publicJwk,
    `realtime-chat:${deviceId}`,
    `message-key:${keyId}`
  );

const identityFingerprint = (key) => `${key.x}.${key.y}`;

const verifyAndPinRecipient = async (bundle) => {
  const identityKey = await crypto.subtle.importKey(
    "jwk", bundle.identitySigningKey,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    identityKey,
    base64ToBytes(bundle.encryptionKeySignature),
    encoder.encode(deviceEncryptionKeyData(bundle.deviceId, bundle.encryptionPublicKey))
  );
  if (!valid) throw new Error("Invalid recipient device encryption-key signature");

  const pinKey = peerIdentityPinKey(currentUserId, bundle.userId, bundle.deviceId);
  const fingerprint = identityFingerprint(bundle.identitySigningKey);
  const existing = await readKey(pinKey);
  if (existing && existing !== fingerprint) throw new Error("Recipient identity key changed");
  if (!existing) await writeKey(pinKey, fingerprint);
};

export const encryptMessage = async (content, recipientUserIds, context, options = {}) => {
  if (typeof context !== "string" || !context) throw new Error("Missing E2EE conversation context");
  const device = await initializeE2EE(currentUserId);
  const userIds = [...new Set([...recipientUserIds.map(String), String(currentUserId)])];
  const { data } = await axiosInstance.post("/auth/keys/bundles", { context });
  if (data.context !== context) throw new Error("E2EE key-bundle context mismatch");
  const coveredUsers = new Set(data.bundles.map((bundle) => bundle.userId));
  if (userIds.some((recipientId) => !coveredUsers.has(recipientId))) {
    throw new Error("A recipient has no registered E2EE device");
  }

  const payload = {
    version: E2EE_VERSION,
    algorithm: E2EE_ALGORITHM,
    senderUserId: String(currentUserId),
    senderDeviceId: device.deviceId,
    senderSigningKey: device.identity.publicKey,
    context,
    messageId: options.messageId || crypto.randomUUID(),
    revision: options.revision ?? 0,
    contentType: content.image ? "image" : "text",
    envelopes: [],
  };
  const messageKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
  const rawMessageKey = await crypto.subtle.exportKey("raw", messageKey);
  payload.envelopes = await Promise.all(data.bundles.map(async (bundle) => {
    await verifyAndPinRecipient(bundle);
    const ephemeral = await generateKeyPair("ECDH", ["deriveBits"]);
    const wrappingKey = await deriveV3WrappingKey(
      ephemeral.privateKey,
      bundle.encryptionPublicKey,
      bundle.deviceId,
      payload
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, wrappingKey, rawMessageKey
    );
    return {
      userId: bundle.userId,
      deviceId: bundle.deviceId,
      ephemeralPublicKey: ephemeral.publicKey,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
    };
  }));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(canonicalize(authenticatedMessageMetadata(payload))),
    },
    messageKey,
    encoder.encode(JSON.stringify(content))
  );
  payload.iv = bytesToBase64(iv);
  payload.ciphertext = bytesToBase64(ciphertext);
  payload.signature = bytesToBase64(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    device.identity.privateKey,
    encoder.encode(canonicalize(unsignedPayload(payload)))
  ));
  return payload;
};

const verifyAndPinSender = async (payload, message) => {
  if (![1, 2, E2EE_VERSION].includes(payload.version) || payload.algorithm !== E2EE_ALGORITHM) {
    throw new Error("Unsupported E2EE payload");
  }
  const identityKey = await crypto.subtle.importKey(
    "jwk", payload.senderSigningKey,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    identityKey,
    base64ToBytes(payload.signature),
    encoder.encode(canonicalize(unsignedPayload(payload)))
  );
  if (!valid) throw new Error("Invalid message signature");

  const senderUserId = String(payload.senderUserId || message.senderId);
  if (payload.version >= 2) {
    if (senderUserId !== String(message.senderId)) throw new Error("Sender identity mismatch");
    if (payload.messageId !== message.clientMessageId) throw new Error("Message identity mismatch");
    if (!Number.isSafeInteger(message.encryptionRevision) ||
      payload.revision !== message.encryptionRevision) throw new Error("Message revision mismatch");
    if (payload.context.startsWith("conversation:")) {
      if (payload.context !== `conversation:${message.conversationId}`) {
        throw new Error("Conversation context mismatch");
      }
    } else if (payload.context.startsWith("direct:")) {
      const directUsers = payload.context.slice("direct:".length).split(":");
      if (directUsers.length !== 2 || !directUsers.includes(String(currentUserId)) ||
        !directUsers.includes(senderUserId)) throw new Error("Direct message context mismatch");
    } else {
      throw new Error("Invalid message context");
    }
  }

  const pinKey = peerIdentityPinKey(currentUserId, senderUserId, payload.senderDeviceId);
  const legacyPinKey = `pin:${currentUserId}:${payload.senderDeviceId}`;
  const fingerprint = identityFingerprint(payload.senderSigningKey);
  const existing = await readKey(pinKey);
  const legacy = existing ? null : await readKey(legacyPinKey);
  if ((existing && existing !== fingerprint) || (legacy && legacy !== fingerprint)) {
    throw new Error("Sender identity key changed");
  }
  if (!existing) await writeKey(pinKey, fingerprint);
};

const importAndCacheMessageKey = async (cacheKey, payload, rawKey) => {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  await writeKey(cacheKey, { payloadSignature: payload.signature, key, cachedAt: Date.now() });
  return key;
};

const unwrapMessageKey = async (message, payload, device) => {
  const cacheKey = messageKeyCacheKey(currentUserId, message._id);
  const cached = await readKey(cacheKey);
  if (isCurrentMessageKeyCache(cached, payload)) return cached.key;
  if (cached instanceof Uint8Array && payload.version === 1) {
    return importAndCacheMessageKey(cacheKey, payload, cached);
  }
  if (cached) await deleteKey(cacheKey);

  const envelope = payload.envelopes.find((item) =>
    item.deviceId === device.deviceId && String(item.userId) === String(currentUserId)
  );
  if (!envelope) throw new Error("Message was not encrypted for this device");

  let wrappingKey;
  if (payload.version >= 3) {
    if (!device.encryption?.privateKey) throw new Error("Device encryption key is unavailable");
    wrappingKey = await deriveV3WrappingKey(
      device.encryption.privateKey,
      envelope.ephemeralPublicKey,
      device.deviceId,
      payload
    );
  } else {
    const collection = envelope.keyType === "one-time"
      ? (device.oneTimePreKeys || [])
      : (device.signedPreKeys || []);
    const preKey = collection.find((item) => item.keyId === envelope.keyId);
    if (!preKey) throw new Error("Required legacy pre-key is no longer available");
    wrappingKey = await deriveLegacyWrappingKey(
      preKey.privateKey,
      envelope.ephemeralPublicKey,
      device.deviceId,
      envelope.keyId
    );
  }

  const rawKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    wrappingKey,
    base64ToBytes(envelope.ciphertext)
  );
  const messageKey = await importAndCacheMessageKey(cacheKey, payload, rawKey);

  if (payload.version < 3 && envelope.keyType === "one-time") {
    device.oneTimePreKeys = (device.oneTimePreKeys || [])
      .filter((item) => item.keyId !== envelope.keyId);
    await writeKey(`device:${device.userId}`, device);
  }
  return messageKey;
};

export const decryptMessage = async (message) => {
  if (!message.isEncrypted || message.deletedAt) return message;
  if (!message.encryptedPayload) {
    return { ...message, text: "Định dạng mã hóa cũ không còn được hỗ trợ" };
  }
  const device = await initializeE2EE(currentUserId);
  const payload = message.encryptedPayload;
  await verifyAndPinSender(payload, message);
  const messageKey = await unwrapMessageKey(message, payload, device);
  const additionalData = payload.version >= 2
    ? canonicalize(authenticatedMessageMetadata(payload))
    : `${payload.senderDeviceId}:${payload.context}`;
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(payload.iv),
      additionalData: encoder.encode(additionalData),
    },
    messageKey,
    base64ToBytes(payload.ciphertext)
  );
  const content = JSON.parse(decoder.decode(plaintext));
  return { ...message, text: content.text || "", image: content.image || null, _isDecrypted: true };
};

export const decryptMessages = async (messages) => Promise.all(messages.map(async (message) => {
  if (message.deletedAt) {
    if (currentUserId && message._id) {
      try {
        await deleteKey(messageKeyCacheKey(currentUserId, message._id));
      } catch (error) {
        console.error("E2EE cache cleanup error:", error);
      }
    }
    return message;
  }
  if (!message.isEncrypted || message._isDecrypted) return message;
  try {
    return await decryptMessage(message);
  } catch (error) {
    console.error("E2EE decrypt error:", error);
    return { ...message, text: "Không thể giải mã hoặc xác thực tin nhắn", image: null };
  }
}));

export const resetE2EESession = () => {
  sessionVersion += 1;
  sessionController?.abort();
  sessionController = null;
  currentUserId = null;
  devicePromise = null;
};
