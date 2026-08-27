import express from 'express'
import {
	getAllContacts,
	getChatByUserId,
	sendMessage,
	getChats,
} from '../controllers/message.controller.js'
import {
	createGroup,
	getConversations,
	getConversationMessages,
	sendConversationMessage,
	deleteGroup,
	removeGroupMember,
	addGroupMember,
} from '../controllers/conversation.controller.js'
import { conversationEvents } from '../controllers/conversation.controller.js'
import { protectRoute } from '../middleware/auth.middleware.js'
import { requireGroupAdmin } from '../middleware/group-admin.middleware.js'
import { arcjetProtect } from '../middleware/arcjet.middleware.js'
const router = express.Router()
router.use(arcjetProtect,protectRoute)
router.get("/contacts",  getAllContacts)
router.get("/chats", getChats)
router.post("/groups", createGroup)
router.get("/events", conversationEvents)
router.get("/conversations", getConversations)
router.get("/conversations/:id", getConversationMessages)
router.post("/conversations/:id/send", sendConversationMessage)
router.delete("/conversations/:id", requireGroupAdmin, deleteGroup)
router.delete("/conversations/:id/members/:memberId", requireGroupAdmin, removeGroupMember)
router.post("/conversations/:id/members/:memberId", requireGroupAdmin, addGroupMember)
router.get("/:id", getChatByUserId)
router.post("/send/:id", sendMessage )

export default router