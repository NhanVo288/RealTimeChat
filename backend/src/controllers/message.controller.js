import { emitToUser } from "../lib/socket.js";
import Conversation from "../model/Conversation.js";
import ConversationMember from "../model/ConversationMember.js";
import Message from "../model/Message.js";
import User from "../model/User.js";
import {
  getDirectConversation,
  getOrCreateDirectConversation,
} from "../services/conversation.service.js";
import { createMessage, toClientMessage, validateEncryptedPayload } from "../services/message.service.js";
import { getMessagePage } from "../services/message-pagination.service.js";
import { publishUsersEvent } from "../services/event.service.js";

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
    const page = await getMessagePage(conversation._id, req.query);
    return res.status(200).json(page);
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const { encryptedPayload } = req.body;
    const senderId = req.user._id;

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }
    if (!(await User.exists({ _id: receiverId }))) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    const conversation = await getOrCreateDirectConversation(senderId, receiverId);
    if (!(await validateEncryptedPayload(encryptedPayload, senderId, conversation._id, {
      expectedRevision: 0,
      expectedAuthSessionId: req.authSession._id,
    }))) {
      return res.status(400).json({ message: "A valid E2EE payload is required" });
    }
    const message = await createMessage({
      conversationId: conversation._id,
      senderId,
      text: "",
      image: null,
      encryptedPayload,
    });
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      lastMessageAt: message.createdAt,
    });

    const clientMessage = toClientMessage(message);
    emitToUser(receiverId, "newMessage", clientMessage);
    return res.status(201).json(clientMessage);
  } catch (error) {
    console.error("Send message error:", error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate encrypted message" });
    }
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

export const editMessage = async (req, res) => {
  try {
    const { encryptedPayload } = req.body;

    const existingMessage = await Message.findOne({
      _id: req.params.id,
      senderId: req.user._id,
      deletedAt: null,
    });
    if (!existingMessage) return res.status(404).json({ message: "Message not found" });
    const isMember = await ConversationMember.exists({
      conversationId: existingMessage.conversationId,
      userId: req.user._id,
    });
    if (!isMember) return res.status(403).json({ message: "Not a conversation member" });
    const currentRevision = existingMessage.encryptionRevision || 0;
    const stableMessageId = existingMessage.clientMessageId || existingMessage._id.toString();
    if (!(await validateEncryptedPayload(
      encryptedPayload,
      req.user._id,
      existingMessage.conversationId,
      {
        expectedMessageId: stableMessageId,
        expectedRevision: currentRevision + 1,
        expectedAuthSessionId: req.authSession._id,
      }
    ))) return res.status(400).json({ message: "A valid E2EE payload is required" });

    const revisionFilter = currentRevision === 0
      ? { $or: [{ encryptionRevision: 0 }, { encryptionRevision: { $exists: false } }] }
      : { encryptionRevision: currentRevision };
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        senderId: req.user._id,
        deletedAt: null,
        ...revisionFilter,
      },
      {
        text: "",
        isEncrypted: true,
        encryptedPayload,
        clientMessageId: encryptedPayload.messageId,
        encryptionRevision: encryptedPayload.revision,
        editedAt: new Date(),
      },
      { new: true }
    ).populate("senderId", "fullName profilePic");
    if (!message) return res.status(409).json({ message: "Message was updated by another request" });

    const payload = toClientMessage(message);
    const memberIds = await ConversationMember.find({
      conversationId: message.conversationId,
    }).distinct("userId");
    publishUsersEvent(memberIds, "message-updated", payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Edit message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const existingMessage = await Message.findOne({
      _id: req.params.id,
      senderId: req.user._id,
      deletedAt: null,
    });
    if (!existingMessage) return res.status(404).json({ message: "Message not found" });
    const isMember = await ConversationMember.exists({
      conversationId: existingMessage.conversationId,
      userId: req.user._id,
    });
    if (!isMember) return res.status(403).json({ message: "Not a conversation member" });

    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, senderId: req.user._id, deletedAt: null },
      { text: "", isEncrypted: false, encryptedPayload: null, deletedAt: new Date(), editedAt: null },
      { new: true }
    ).populate("senderId", "fullName profilePic");
    if (!message) return res.status(404).json({ message: "Message not found" });

    const payload = toClientMessage(message);
    const memberIds = await ConversationMember.find({
      conversationId: message.conversationId,
    }).distinct("userId");
    publishUsersEvent(memberIds, "message-deleted", payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
