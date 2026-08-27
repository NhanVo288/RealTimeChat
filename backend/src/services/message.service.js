import cloudinary from "../lib/cloudinary.js";
import Message from "../model/Message.js";

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

export const createMessage = async ({ conversationId, senderId, text, image, isEncrypted = false }) => {
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
    type: attachments.length ? "image" : "text",
    text: text.trim(),
    isEncrypted,
    attachments,
  });
  return message.populate("senderId", "fullName profilePic");
};
