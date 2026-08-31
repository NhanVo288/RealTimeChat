import cloudinary from "../lib/cloudinary.js";
import Message from "../model/Message.js";
import Device from "../model/Device.js";
import ConversationMember from "../model/ConversationMember.js";
import Conversation from "../model/Conversation.js";

const validCipher = (value, max = 14_000_000) =>
  typeof value === "string" && value.length > 0 && value.length <= max;

export const validateEncryptedPayload = async (payload, senderId, conversationId) => {
  if (!payload || payload.version !== 1 || payload.algorithm !== "ECDH-P256/HKDF-SHA256/AES-256-GCM" ||
    typeof payload.senderDeviceId !== "string" || !validCipher(payload.iv, 100) ||
    typeof payload.context !== "string" || payload.context.length > 200 ||
    !validCipher(payload.ciphertext) || !validCipher(payload.signature, 300) ||
    !Array.isArray(payload.envelopes) || !payload.envelopes.length || payload.envelopes.length > 500) {
    return false;
  }
  const device = await Device.findOne({
    userId: senderId,
    deviceId: payload.senderDeviceId,
    revokedAt: null,
  }).lean();
  if (!device || device.identitySigningKey.x !== payload.senderSigningKey?.x ||
    device.identitySigningKey.y !== payload.senderSigningKey?.y || payload.senderSigningKey?.d ||
    payload.senderSigningKey?.kty !== "EC" || payload.senderSigningKey?.crv !== "P-256") return false;

  const memberIds = new Set((await ConversationMember.find({ conversationId })
    .distinct("userId")).map(String));
  const conversation = await Conversation.findById(conversationId).select("type").lean();
  const expectedContext = conversation?.type === "group"
    ? `conversation:${conversationId}`
    : `direct:${[...memberIds].sort().join(":")}`;
  if (payload.context !== expectedContext) return false;
  const activeDevices = await Device.find({ userId: { $in: [...memberIds] }, revokedAt: null })
    .select("userId deviceId").lean();
  const allowedDevices = new Map(activeDevices.map((item) => [item.deviceId, String(item.userId)]));
  const coveredDevices = new Set(payload.envelopes.map((envelope) => envelope.deviceId));
  return activeDevices.every((item) => coveredDevices.has(item.deviceId)) &&
    payload.envelopes.every((envelope) =>
    memberIds.has(String(envelope.userId)) &&
    allowedDevices.get(envelope.deviceId) === String(envelope.userId) &&
    typeof envelope.deviceId === "string" &&
    typeof envelope.keyId === "string" && ["one-time", "signed"].includes(envelope.keyType) &&
    envelope.ephemeralPublicKey?.kty === "EC" && envelope.ephemeralPublicKey?.crv === "P-256" &&
    typeof envelope.ephemeralPublicKey?.x === "string" &&
    typeof envelope.ephemeralPublicKey?.y === "string" &&
    !envelope.ephemeralPublicKey?.d && validCipher(envelope.iv, 100) &&
    validCipher(envelope.ciphertext, 500)
  );
};

export const toClientMessage = (message) => {
  const data = message.toObject ? message.toObject() : message;
  const sender = data.senderId?.fullName && data.senderId?._id
    ? data.senderId
    : null;
  const firstImage = data.attachments?.find((attachment) =>
    attachment.mimeType?.startsWith("image/")
  );

  return {
    ...data,
    _id: data._id.toString(),
    conversationId: data.conversationId.toString(),
    senderId: (sender?._id || data.senderId).toString(),
    sender: sender
      ? {
          _id: sender._id.toString(),
          fullName: sender.fullName,
          profilePic: sender.profilePic,
        }
      : null,
    image: firstImage?.url || null,
  };
};

export const createMessage = async ({ conversationId, senderId, text, image, isEncrypted = false, encryptedPayload = null }) => {
  const attachments = [];
  if (image) {
    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "realtime-chat/messages",
      resource_type: "image",
    });
    attachments.push({
      url: uploadResponse.secure_url,
      name: "image",
      mimeType: "image/*",
    });
  }

  const message = await Message.create({
    conversationId,
    senderId,
    type: encryptedPayload?.contentType === "image" || attachments.length ? "image" : "text",
    text: encryptedPayload ? "" : text.trim(),
    isEncrypted: Boolean(encryptedPayload) || isEncrypted,
    encryptedPayload,
    attachments,
  });
  return message.populate("senderId", "fullName profilePic");
};
