import { getReceiverSockerId, io } from "../lib/socket.js";
import Conversation from "../model/Conversation.js";
import ConversationMember from "../model/ConversationMember.js";
import User from "../model/User.js";
import {
  getDirectConversation,
  getOrCreateDirectConversation,
} from "../services/conversation.service.js";
import {
  createMessage,
  getMessagesPage,
  toClientMessage,
} from "../services/message.service.js";

const publicUserFields = "-password";

export const getAllContacts = async (req, res) => {
  try {
    const contacts = await User.find({ _id: { $ne: req.user._id } })
      .select(publicUserFields)
      .sort({ fullName: 1 });
    return res.status(200).json(contacts);
  } catch (error) {
    console.error("Get contacts error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getChatByUserId = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    if (req.user._id.toString() === otherUserId) {
      return res.status(400).json({ message: "You cannot chat with yourself" });
    }
    if (!(await User.exists({ _id: otherUserId }))) {
      return res.status(404).json({ message: "User not found" });
    }

    const conversation = await getDirectConversation(req.user._id, otherUserId);
    if (!conversation) return res.status(200).json([]);
    const result = await getMessagesPage(conversation._id, req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Server error",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const { text = "", image = null } = req.body;
    const senderId = req.user._id;

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }
    if (!(await User.exists({ _id: receiverId }))) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    if (!text.trim() && !image) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const conversation = await getOrCreateDirectConversation(senderId, receiverId);
    const message = await createMessage({
      conversationId: conversation._id,
      senderId,
      text,
      image,
    });
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      lastMessageAt: message.createdAt,
    });

    const clientMessage = toClientMessage(message);
    const receiverSocketId = getReceiverSockerId(receiverId);
    if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", clientMessage);
    return res.status(201).json(clientMessage);
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getChats = async (req, res) => {
  try {
    const conversationIds = await ConversationMember.find({ userId: req.user._id })
      .distinct("conversationId");
    const partnerIds = await ConversationMember.find({
      conversationId: { $in: conversationIds },
      userId: { $ne: req.user._id },
    }).distinct("userId");
    const chatPartners = await User.find({ _id: { $in: partnerIds } })
      .select(publicUserFields)
      .sort({ fullName: 1 });
    return res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Get chats error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
