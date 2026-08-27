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

export const getMessagesPage = async (conversationId, { before, limit = 30 } = {}) => {
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const query = { conversationId };
  if (before) {
    const beforeDate = new Date(before);
    if (Number.isNaN(beforeDate.getTime())) {
      const error = new Error("Invalid cursor");
      error.statusCode = 400;
      throw error;
    }
    query.createdAt = { $lt: beforeDate };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(pageSize + 1)
    .lean();
  const hasMore = messages.length > pageSize;
  const page = messages.slice(0, pageSize).reverse();

  return {
    messages: page.map(toClientMessage),
    hasMore,
    nextCursor: page[0]?.createdAt?.toISOString() || null,
  };
};
