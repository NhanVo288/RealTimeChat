import cloudinary from "../lib/cloudinary.js";
import Message from "../model/Message.js";

export const toClientMessage = (message) => {
  const data = message.toObject ? message.toObject() : message;
  const firstImage = data.attachments?.find((attachment) =>
    attachment.mimeType?.startsWith("image/")
  );

  return {
    ...data,
    _id: data._id.toString(),
    conversationId: data.conversationId.toString(),
    senderId: data.senderId.toString(),
    image: firstImage?.url || null,
  };
};

export const createMessage = async ({ conversationId, senderId, text, image }) => {
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

  return Message.create({
    conversationId,
    senderId,
    type: attachments.length ? "image" : "text",
    text: text.trim(),
    attachments,
  });
};
