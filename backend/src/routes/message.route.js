import express from 'express'
import { getAllContacts, getChatByUserId, sendMessage, getChats } from '../controllers/message.controller.js'
import { protectRoute } from '../middleware/auth.middleware.js'
import { arcjetProtect } from '../middleware/arcjet.middleware.js'
const router = express.Router()
router.use(arcjetProtect,protectRoute)
router.get("/contacts",  getAllContacts)
router.get("/chats", getChats)
router.get("/:id", getChatByUserId)
router.post("/send/:id", sendMessage )

export default router