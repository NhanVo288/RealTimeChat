import jwt from 'jsonwebtoken'
import User from '../model/User.js'
import { clearAuthCookie, verifyAuthToken } from '../lib/utils.js'
import {
    findActiveAuthSession,
    touchAuthSession,
} from '../services/auth-session.service.js'


export const protectRoute = async (req, res, nextFunc) => {
    try {
        const token = req.cookies.jwt
        if(!token) return res.status(401).json({message: "No token provided"})
        const decoded = verifyAuthToken(token, "access")
        if(!decoded) return res.status(401).json({message: "Invalid token"})

        const user = await User.findById(decoded.userId).select("-password")
        if(!user) {
            clearAuthCookie(res)
            return res.status(404).json({message: "User Not Found"})
        }

        const authSession = await findActiveAuthSession(decoded.sessionId, decoded.userId)
        if (!authSession) {
            clearAuthCookie(res)
            return res.status(401).json({ message: "Session expired or revoked" })
        }

        req.user = user
        req.authSession = authSession
        const lastSeenAge = Date.now() - new Date(authSession.lastSeenAt).getTime()
        if (lastSeenAge > 60_000) {
            void touchAuthSession(authSession._id).catch((error) =>
                console.error("Update auth session activity error:", error)
            )
        }
        nextFunc()
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            // Preserve RT so the client can recover from an expired access token.
            return res.status(401).json({ message: "Invalid or expired access token" })
        }
        console.error("Authentication error:", error.message)
        return res.status(503).json({ message: "Authentication unavailable" })
    }
}
