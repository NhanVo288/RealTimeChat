import Conversation from "../model/Conversation.js";
import ConversationMember from "../model/ConversationMember.js";

export const requireGroupAdmin = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      type: "group",
    });
    if (!conversation) {
      return res.status(404).json({ message: "Group not found" });
    }

    const membership = await ConversationMember.findOne({
      conversationId: conversation._id,
      userId: req.user._id,
      role: "admin",
    });
    if (!membership) {
      return res.status(403).json({ message: "Only group admins can perform this action" });
    }

    req.conversation = conversation;
    req.groupAdminMembership = membership;
    return next();
  } catch (error) {
    console.error("Group admin authorization error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
