import { axiosInstance } from "./axios";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const algorithm = "ECDH-P256/HKDF-SHA256/AES-256-GCM";
const dbName = "realtime-chat-e2ee-v1";
const storeName = "keys";
const signedPreKeyLifetime = 7 * 24 * 60 * 60 * 1000;
const preKeyTarget = 30;
let currentUserId = null;
let devicePromise = null;

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

const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const databaseOperation = async (mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
};

const readKey = (key) => databaseOperation("readonly", (store) => store.get(key));
const writeKey = (key, value) => databaseOperation("readwrite", (store) => store.put(value, key));

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

const preKeyData = (preKey) => encoder.encode(canonicalize({
  keyId: preKey.keyId,
  publicKey: preKey.publicKey,
}));

const createPreKey = async (identityPrivateKey) => {
  const pair = await generateKeyPair("ECDH", ["deriveBits"]);
  const preKey = {
    keyId: crypto.randomUUID(),
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    createdAt: new Date().toISOString(),
    published: false,
  };
  preKey.signature = bytesToBase64(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, identityPrivateKey, preKeyData(preKey)
  ));
  return preKey;
};

const publicPreKey = ({ keyId, publicKey, signature, createdAt }) => ({
  keyId, publicKey, signature, ...(createdAt ? { createdAt } : {}),
});

const createDevice = async (userId) => {
  const identity = await generateKeyPair("ECDSA", ["sign", "verify"]);
  const signedPreKey = await createPreKey(identity.privateKey);
  const oneTimePreKeys = [];
  for (let index = 0; index < preKeyTarget; index += 1) {
    oneTimePreKeys.push(await createPreKey(identity.privateKey));
  }
  return {
    userId,
    deviceId: crypto.randomUUID(),
    identity,
    signedPreKeys: [signedPreKey],
    oneTimePreKeys,
  };
};

const registerDevice = async (device) => {
  const activeSignedPreKey = device.signedPreKeys.at(-1);
  const unpublished = device.oneTimePreKeys.filter((key) => !key.published);
  await axiosInstance.put(`/auth/devices/${device.deviceId}`, {
    name: navigator.userAgent.slice(0, 120),
    identitySigningKey: device.identity.publicKey,
    signedPreKey: publicPreKey(activeSignedPreKey),
    oneTimePreKeys: unpublished.map(publicPreKey),
  });
  unpublished.forEach((key) => { key.published = true; });
  activeSignedPreKey.published = true;
  await writeKey(`device:${device.userId}`, device);
  return device;
};

const maintainPreKeys = async (device, force = false) => {
  let changed = false;
  const currentSigned = device.signedPreKeys.at(-1);
  if (Date.now() - new Date(currentSigned.createdAt).getTime() > signedPreKeyLifetime) {
    device.signedPreKeys.push(await createPreKey(device.identity.privateKey));
    device.signedPreKeys = device.signedPreKeys.slice(-4);
    changed = true;
  }
  if (device.oneTimePreKeys.length < 10) {
    while (device.oneTimePreKeys.length < preKeyTarget) {
      device.oneTimePreKeys.push(await createPreKey(device.identity.privateKey));
    }
    changed = true;
  }
  return changed || force ? registerDevice(device) : device;
};

const emergencyPreKeyRefill = async (device) => {
  if (Date.now() - (device.lastEmergencyRefill || 0) < 60 * 60 * 1000) return;
  for (let index = 0; index < 20; index += 1) {
    device.oneTimePreKeys.push(await createPreKey(device.identity.privateKey));
  }
  device.lastEmergencyRefill = Date.now();
  await registerDevice(device);
};

export const initializeE2EE = async (userId) => {
  if (!window.isSecureContext || !crypto?.subtle || typeof indexedDB === "undefined") {
    throw new Error("E2EE requires HTTPS (or localhost) and Web Crypto support");
  }
  if (currentUserId === userId && devicePromise) return devicePromise;
  currentUserId = userId;
  devicePromise = (async () => {
    let device = await readKey(`device:${userId}`);
    if (!device) device = await createDevice(userId);
    return maintainPreKeys(device, true);
  })().catch((error) => {
    devicePromise = null;
    throw error;
  });
  return devicePromise;
};

const verifyPreKey = async (bundle) => {
  const identityKey = await crypto.subtle.importKey(
    "jwk", bundle.identitySigningKey,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, identityKey,
    base64ToBytes(bundle.preKey.signature), preKeyData(bundle.preKey)
  );
};

const deriveWrappingKey = async (privateKey, publicJwk, deviceId, keyId) => {
  const publicKey = await crypto.subtle.importKey(
    "jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey }, privateKey, 256
  );
  const material = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF", hash: "SHA-256",
      salt: encoder.encode(`realtime-chat:${deviceId}`),
      info: encoder.encode(`message-key:${keyId}`),
    },
    material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
};

const unsignedPayload = (payload) => ({
  version: payload.version,
  algorithm: payload.algorithm,
  senderDeviceId: payload.senderDeviceId,
  senderSigningKey: payload.senderSigningKey,
  context: payload.context,
  iv: payload.iv,
  ciphertext: payload.ciphertext,
  envelopes: payload.envelopes,
});

export const encryptMessage = async (content, recipientUserIds, context) => {
  if (typeof context !== "string" || !context) throw new Error("Missing E2EE conversation context");
  const device = await maintainPreKeys(await initializeE2EE(currentUserId));
  const userIds = [...new Set([...recipientUserIds.map(String), String(currentUserId)])];
  const { data } = await axiosInstance.post("/auth/keys/claim", { userIds });
  const coveredUsers = new Set(data.bundles.map((bundle) => bundle.userId));
  if (userIds.some((userId) => !coveredUsers.has(userId))) {
    throw new Error("A recipient has no registered E2EE device");
  }
  if (data.bundles.some((bundle) =>
    bundle.deviceId === device.deviceId && bundle.preKey.type === "signed")) {
    await emergencyPreKeyRefill(device);
  }

  const messageKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
  const rawMessageKey = await crypto.subtle.exportKey("raw", messageKey);
  const envelopes = [];
  for (const bundle of data.bundles) {
    if (!(await verifyPreKey(bundle))) throw new Error("Invalid recipient pre-key signature");
    const ephemeral = await generateKeyPair("ECDH", ["deriveBits"]);
    const wrappingKey = await deriveWrappingKey(
      ephemeral.privateKey, bundle.preKey.publicKey, bundle.deviceId, bundle.preKey.keyId
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, rawMessageKey);
    envelopes.push({
      userId: bundle.userId,
      deviceId: bundle.deviceId,
      keyId: bundle.preKey.keyId,
      keyType: bundle.preKey.type,
      ephemeralPublicKey: ephemeral.publicKey,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(wrapped),
    });
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`${device.deviceId}:${context}`) },
    messageKey, encoder.encode(JSON.stringify(content))
  );
  const payload = {
    version: 1,
    algorithm,
    senderDeviceId: device.deviceId,
    senderSigningKey: device.identity.publicKey,
    context,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    envelopes,
  };
  payload.signature = bytesToBase64(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, device.identity.privateKey,
    encoder.encode(canonicalize(unsignedPayload(payload)))
  ));
  return payload;
};

const verifyAndPinSender = async (payload) => {
  const identityKey = await crypto.subtle.importKey(
    "jwk", payload.senderSigningKey,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, identityKey,
    base64ToBytes(payload.signature), encoder.encode(canonicalize(unsignedPayload(payload)))
  );
  if (!valid) throw new Error("Invalid message signature");
  const pinKey = `pin:${currentUserId}:${payload.senderDeviceId}`;
  const fingerprint = `${payload.senderSigningKey.x}.${payload.senderSigningKey.y}`;
  const existing = await readKey(pinKey);
  if (existing && existing !== fingerprint) throw new Error("Sender identity key changed");
  if (!existing) await writeKey(pinKey, fingerprint);
};

const unwrapMessageKey = async (message, payload, device) => {
  const cached = await readKey(`message-key:${currentUserId}:${message._id}`);
  if (cached) return crypto.subtle.importKey("raw", cached, "AES-GCM", false, ["decrypt"]);
  const envelope = payload.envelopes.find((item) => item.deviceId === device.deviceId);
  if (!envelope) throw new Error("Message was not encrypted for this device");
  const collection = envelope.keyType === "one-time" ? device.oneTimePreKeys : device.signedPreKeys;
  const preKey = collection.find((item) => item.keyId === envelope.keyId);
  if (!preKey) throw new Error("Required pre-key is no longer available");
  const wrappingKey = await deriveWrappingKey(
    preKey.privateKey, envelope.ephemeralPublicKey, device.deviceId, envelope.keyId
  );
  const rawKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    wrappingKey, base64ToBytes(envelope.ciphertext)
  );
  await writeKey(`message-key:${currentUserId}:${message._id}`, new Uint8Array(rawKey));
  if (envelope.keyType === "one-time") {
    device.oneTimePreKeys = device.oneTimePreKeys.filter((item) => item.keyId !== envelope.keyId);
    await writeKey(`device:${device.userId}`, device);
    await maintainPreKeys(device);
  } else {
    await emergencyPreKeyRefill(device);
  }
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
};

export const decryptMessage = async (message) => {
  if (!message.isEncrypted || message.deletedAt) return message;
  if (!message.encryptedPayload) {
    return { ...message, text: "Tin nhắn dùng định dạng mã hóa cũ không còn được hỗ trợ" };
  }
  const device = await initializeE2EE(currentUserId);
  const payload = message.encryptedPayload;
  await verifyAndPinSender(payload);
  const messageKey = await unwrapMessageKey(message, payload, device);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM", iv: base64ToBytes(payload.iv),
      additionalData: encoder.encode(`${payload.senderDeviceId}:${payload.context}`),
    },
    messageKey, base64ToBytes(payload.ciphertext)
  );
  const content = JSON.parse(decoder.decode(plaintext));
  return { ...message, text: content.text || "", image: content.image || null, _isDecrypted: true };
};

export const decryptMessages = async (messages) => Promise.all(messages.map(async (message) => {
  if (!message.isEncrypted || message._isDecrypted || message.deletedAt) return message;
  try {
    return await decryptMessage(message);
  } catch (error) {
    console.error("E2EE decrypt error:", error);
    return { ...message, text: "Không thể giải mã hoặc xác thực tin nhắn", image: null };
  }
}));

export const resetE2EESession = () => {
  currentUserId = null;
  devicePromise = null;
};
