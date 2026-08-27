import Conversation from "../model/Conversation.js";
import ConversationMember from "../model/ConversationMember.js";

export const getDirectConversation = async (firstUserId, secondUserId) => {
  const [firstMemberships, secondMemberships] = await Promise.all([
    ConversationMember.find({ userId: firstUserId }).distinct("conversationId"),
    ConversationMember.find({ userId: secondUserId }).distinct("conversationId"),
  ]);
  const secondConversationIds = new Set(
    secondMemberships.map((conversationId) => conversationId.toString())
  );
  const sharedConversationIds = firstMemberships.filter((conversationId) =>
    secondConversationIds.has(conversationId.toString())
  );
  if (!sharedConversationIds.length) return null;
  return Conversation.findOne({
    _id: { $in: sharedConversationIds },
    type: "direct",
  }).sort({ createdAt: 1 });
};

export const getOrCreateDirectConversation = async (firstUserId, secondUserId) => {
  const existingConversation = await getDirectConversation(firstUserId, secondUserId);
  if (existingConversation) return existingConversation;

  const conversation = await Conversation.create({
    type: "direct",
    createdBy: firstUserId,
  });
  await ConversationMember.insertMany([
    { conversationId: conversation._id, userId: firstUserId },
    { conversationId: conversation._id, userId: secondUserId },
  ]);
  return conversation;
};

export const requireConversationMember = async (conversationId, userId) => {
  const membership = await ConversationMember.findOne({ conversationId, userId });
  if (!membership) return null;
  return Conversation.findById(conversationId);
};
