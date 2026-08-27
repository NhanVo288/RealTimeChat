import { getReceiverSockerId, io } from "../lib/socket.js";
import Conversation from "../model/Conversation.js";
import ConversationMember from "../model/ConversationMember.js";
import Message from "../model/Message.js";
import User from "../model/User.js";
import { requireConversationMember } from "../services/conversation.service.js";
import {
  addClientStream,
  publishUserEvent,
  publishUsersEvent,
} from "../services/event.service.js";
import { createMessage, toClientMessage } from "../services/message.service.js";
import { getMessagePage } from "../services/message-pagination.service.js";

const publicUserFields = "-password";

export const conversationEvents = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": connected\n\n");
  addClientStream(req.user._id, res);
};

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds = [], avatar = "" } = req.body;
    const groupName = name?.trim();
    const uniqueMemberIds = [...new Set([req.user._id.toString(), ...memberIds.map(String)])];

    if (!groupName) return res.status(400).json({ message: "Group name is required" });
    if (groupName.length > 100) {
      return res.status(400).json({ message: "Group name cannot exceed 100 characters" });
    }
    if (uniqueMemberIds.length < 3) {
      return res.status(400).json({ message: "A group needs at least 3 members" });
    }

    const users = await User.find({ _id: { $in: uniqueMemberIds } }).select(publicUserFields);
    if (users.length !== uniqueMemberIds.length) {
      return res.status(400).json({ message: "One or more members do not exist" });
    }

    const conversation = await Conversation.create({
      type: "group",
      name: groupName,
      avatar,
      createdBy: req.user._id,
    });
    await ConversationMember.insertMany(uniqueMemberIds.map((userId) => ({
      conversationId: conversation._id,
      userId,
      role: userId === req.user._id.toString() ? "admin" : "member",
    })));

    const groupPayload = {
      ...conversation.toObject(),
      members: users.map((user) => ({
        ...user.toObject(),
        role: user._id.toString() === req.user._id.toString() ? "admin" : "member",
      })),
    };
    publishUsersEvent(memberIds, "group-created", groupPayload);

    return res.status(201).json(groupPayload);
  } catch (error) {
    console.error("Create group error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const memberships = await ConversationMember.find({ userId: req.user._id })
      .populate({ path: "conversationId", populate: { path: "lastMessage" } })
      .sort({ updatedAt: -1 });
    const conversations = await Promise.all(memberships.map(async ({ conversationId }) => {
      const members = await ConversationMember.find({ conversationId: conversationId._id })
        .populate("userId", publicUserFields)
        .select("userId role");
      return {
        ...conversationId.toObject(),
        members: members.map((member) => ({ ...member.userId.toObject(), role: member.role })),
      };
    }));
    return res.status(200).json(conversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const conversation = await requireConversationMember(req.params.id, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    const page = await getMessagePage(conversation._id, req.query);
    return res.status(200).json(page);
  } catch (error) {
    console.error("Get conversation messages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendConversationMessage = async (req, res) => {
  try {
    const { text = "", image = null } = req.body;
    const conversation = await requireConversationMember(req.params.id, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!text.trim() && !image) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const message = await createMessage({
      conversationId: conversation._id,
      senderId: req.user._id,
      text,
      image,
      isEncrypted: Boolean(text),
    });
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      lastMessageAt: message.createdAt,
    });

    const clientMessage = toClientMessage(message);
    const members = await ConversationMember.find({
      conversationId: conversation._id,
      userId: { $ne: req.user._id },
    }).distinct("userId");
    members.forEach((memberId) => {
      const socketId = getReceiverSockerId(memberId.toString());
      if (socketId) io.to(socketId).emit("newMessage", clientMessage);
    });
    return res.status(201).json(clientMessage);
  } catch (error) {
    console.error("Send conversation message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const conversation = req.conversation;
    const memberIds = await ConversationMember.find({ conversationId: conversation._id })
      .distinct("userId");
    await Promise.all([
      Message.deleteMany({ conversationId: conversation._id }),
      ConversationMember.deleteMany({ conversationId: conversation._id }),
      Conversation.deleteOne({ _id: conversation._id }),
    ]);
    publishUsersEvent(memberIds, "group-deleted", { conversationId: req.params.id });
    return res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Delete group error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { id: conversationId, memberId } = req.params;

    const conversation = req.conversation || await Conversation.findOne({
      _id: conversationId,
      type: "group",
    });
    if (!conversation) return res.status(404).json({ message: "Group not found" });
    const member = await ConversationMember.findOne({ conversationId, userId: memberId });
    if (!member) return res.status(404).json({ message: "Member not found" });
    if (member.role === "admin") return res.status(400).json({ message: "Cannot remove another admin" });
    await ConversationMember.deleteOne({ _id: member._id });
    const remainingMemberIds = await ConversationMember.find({ conversationId }).distinct("userId");
    publishUserEvent(memberId, "member-removed", { conversationId, memberId });
    publishUsersEvent(remainingMemberIds, "member-removed", { conversationId, memberId });
    return res.status(200).json({ message: "Member removed successfully", memberId });
  } catch (error) {
    console.error("Remove group member error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const addGroupMember = async (req, res) => {
  try {
    const { id: conversationId, memberId } = req.params;
    const user = await User.findById(memberId).select(publicUserFields);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (await ConversationMember.exists({ conversationId, userId: memberId })) {
      return res.status(409).json({ message: "User is already a group member" });
    }

    await ConversationMember.create({ conversationId, userId: memberId, role: "member" });
    const currentMemberIds = await ConversationMember.find({ conversationId }).distinct("userId");
    publishUsersEvent(currentMemberIds, "member-added", {
      conversationId,
      member: { ...user.toObject(), role: "member" },
    });
    return res.status(201).json({ ...user.toObject(), role: "member" });
  } catch (error) {
    console.error("Add group member error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
