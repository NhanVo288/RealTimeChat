import cloudinary from "../lib/cloudinary.js";
import Message from "../model/Message.js";
import Device from "../model/Device.js";
import ConversationMember from "../model/ConversationMember.js";
import Conversation from "../model/Conversation.js";
import {
  E2EE_ALGORITHM,
  E2EE_VERSION,
  validatePayloadShape,
  verifyPayloadSignature,
} from "../lib/e2ee.js";

export const validateEncryptedPayload = async (
  payload,
  senderId,
  conversationId,
  { expectedMessageId = null, expectedRevision = 0, expectedAuthSessionId = null } = {}
) => {
  if (!validatePayloadShape(payload) || payload.version !== E2EE_VERSION ||
    payload.algorithm !== E2EE_ALGORITHM || payload.senderUserId !== String(senderId) ||
    payload.revision !== expectedRevision ||
    (expectedMessageId && payload.messageId !== String(expectedMessageId))) return false;
  const device = await Device.findOne({
    userId: senderId,
    deviceId: payload.senderDeviceId,
    revokedAt: null,
    ...(expectedAuthSessionId ? { authSessionId: expectedAuthSessionId } : {}),
    encryptionPublicKey: { $ne: null },
    encryptionKeySignature: { $ne: null },
  }).lean();
  if (!device || device.identitySigningKey.x !== payload.senderSigningKey.x ||
    device.identitySigningKey.y !== payload.senderSigningKey?.y || payload.senderSigningKey?.d ||
    !(await verifyPayloadSignature(payload, device.identitySigningKey))) return false;

  const memberIds = new Set((await ConversationMember.find({ conversationId })
    .distinct("userId")).map(String));
  const conversation = await Conversation.findById(conversationId).select("type").lean();
  const expectedContext = conversation?.type === "group"
    ? `conversation:${conversationId}`
    : `direct:${[...memberIds].sort().join(":")}`;
  if (payload.context !== expectedContext) return false;
  const activeDevices = await Device.find({
    userId: { $in: [...memberIds] },
    revokedAt: null,
    encryptionPublicKey: { $ne: null },
    encryptionKeySignature: { $ne: null },
  })
    .select("userId deviceId").lean();
  const deviceRecipient = (userId, deviceId) => `${userId}:${deviceId}`;
  const allowedDevices = new Set(activeDevices.map((item) =>
    deviceRecipient(item.userId, item.deviceId)
  ));
  const coveredDevices = new Set(payload.envelopes.map((envelope) =>
    deviceRecipient(envelope.userId, envelope.deviceId)
  ));
  return payload.envelopes.length === activeDevices.length &&
    activeDevices.every((item) => coveredDevices.has(deviceRecipient(item.userId, item.deviceId))) &&
    payload.envelopes.every((envelope) =>
    memberIds.has(String(envelope.userId)) &&
    allowedDevices.has(deviceRecipient(envelope.userId, envelope.deviceId)) &&
    typeof envelope.deviceId === "string"
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
    clientMessageId: encryptedPayload?.messageId || null,
    encryptionRevision: encryptedPayload?.revision || 0,
    attachments,
  });
  return message.populate("senderId", "fullName profilePic");
};
