const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encryptionSecret = import.meta.env.VITE_E2EE_SECRET;

let keyPromise;

const getEncryptionKey = async () => {
  if (!encryptionSecret) {
    throw new Error("VITE_E2EE_SECRET is required for encrypted messages");
  }
  if (!keyPromise) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(encryptionSecret));
    keyPromise = crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return keyPromise;
};

export const encryptMessage = async (plainText) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plainText)
  );
  const bytes = new Uint8Array(iv.length + encrypted.byteLength);
  bytes.set(iv);
  bytes.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...bytes));
};

export const decryptMessage = async (cipherText) => {
  const bytes = Uint8Array.from(atob(cipherText), (character) => character.charCodeAt(0));
  const key = await getEncryptionKey();
  const plainText = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12) },
    key,
    bytes.slice(12)
  );
  return decoder.decode(plainText);
};

export const decryptMessages = async (messages) => Promise.all(
  messages.map(async (message) => {
    if (!message.isEncrypted || !message.text) return message;
    try {
      return { ...message, text: await decryptMessage(message.text) };
    } catch {
      return { ...message, text: "Không thể giải mã tin nhắn" };
    }
  })
);