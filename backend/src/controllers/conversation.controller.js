import { emitToUser } from "../lib/socket.js";
import Conversation from "../model/Conversation.js";
import ConversationMember from "../model/ConversationMember.js";
import Message from "../model/Message.js";
import User from "../model/User.js";
import { requireConversationMember } from "../services/conversation.service.js";
import {
  publishUserEvent,
  publishUsersEvent,
} from "../services/event.service.js";
import { createMessage, toClientMessage, validateEncryptedPayload } from "../services/message.service.js";
import { getMessagePage } from "../services/message-pagination.service.js";
import mongoose from "mongoose";

const publicUserFields = "-password";


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
      .populate({
        path: "conversationId",
        populate: {
          path: "lastMessage",
          populate: { path: "senderId", select: "fullName profilePic" },
        },
      })
      .sort({ updatedAt: -1 });
    const conversations = await Promise.all(memberships.map(async (membership) => {
      const { conversationId } = membership;
      if (!conversationId) return null;
      const members = await ConversationMember.find({ conversationId: conversationId._id })
        .populate("userId", publicUserFields)
        .select("userId role");
      const unreadFilter = {
        conversationId: conversationId._id,
        senderId: { $ne: req.user._id },
        deletedAt: null,
      };
      if (membership.lastReadMessageId) {
        unreadFilter._id = { $gt: membership.lastReadMessageId };
      }
      const unreadCount = await Message.countDocuments(unreadFilter);
      const conversationData = conversationId.toObject();
      return {
        ...conversationData,
        lastMessage: conversationData.lastMessage
          ? toClientMessage(conversationData.lastMessage)
          : null,
        members: members.map((member) => ({ ...member.userId.toObject(), role: member.role })),
        lastReadMessageId: membership.lastReadMessageId,
        unreadCount,
      };
    }));
    return res.status(200).json(conversations.filter(Boolean).sort((first, second) =>
      new Date(second.lastMessageAt || second.updatedAt) -
      new Date(first.lastMessageAt || first.updatedAt)
    ));
  } catch (error) {
    console.error("Get conversations error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "A valid messageId is required" });
    }
    const membership = await ConversationMember.findOne({
      conversationId: req.params.id,
      userId: req.user._id,
    });
    if (!membership) return res.status(404).json({ message: "Conversation not found" });

    const message = await Message.findOne({
      _id: messageId,
      conversationId: req.params.id,
    }).select("_id");
    if (!message) return res.status(404).json({ message: "Message not found in conversation" });

    const currentReadId = membership.lastReadMessageId?.toString();
    if (!currentReadId || currentReadId < message._id.toString()) {
      membership.lastReadMessageId = message._id;
    }
    const effectiveReadId = membership.lastReadMessageId;
    const unreadCount = await Message.countDocuments({
      conversationId: req.params.id,
      senderId: { $ne: req.user._id },
      deletedAt: null,
      ...(effectiveReadId ? { _id: { $gt: effectiveReadId } } : {}),
    });
    membership.unreadCount = unreadCount;
    await membership.save();
    return res.status(200).json({
      conversationId: req.params.id,
      lastReadMessageId: effectiveReadId,
      unreadCount,
    });
  } catch (error) {
    console.error("Mark conversation read error:", error);
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
    const { encryptedPayload } = req.body;
    const conversation = await requireConversationMember(req.params.id, req.user._id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!(await validateEncryptedPayload(encryptedPayload, req.user._id, conversation._id))) {
      return res.status(400).json({ message: "A valid E2EE payload is required" });
    }

    const message = await createMessage({
      conversationId: conversation._id,
      senderId: req.user._id,
      text: "",
      image: null,
      encryptedPayload,
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
    members.forEach((memberId) => emitToUser(memberId, "newMessage", clientMessage));
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

    await ConversationMember.create({
      conversationId,
      userId: memberId,
      role: "member",
      lastReadMessageId: req.conversation?.lastMessage || null,
    });
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
