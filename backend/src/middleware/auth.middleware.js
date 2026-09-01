import jwt from 'jsonwebtoken'
import User from '../model/User.js'
import { ENV } from '../lib/env.js'
import { clearAuthCookie, generateToken } from '../lib/utils.js'
import {
    createAuthSession,
    findActiveAuthSession,
    touchAuthSession,
} from '../services/auth-session.service.js'


export const protectRoute = async (req, res, nextFunc) => {
    try {
        const token = req.cookies.jwt
        if(!token) return res.status(401).json({message: "No token provided"})
        const decoded = jwt.verify(token, ENV.JWT_SECRET)
        if(!decoded) return res.status(401).json({message: "Invalid token"})

        const user = await User.findById(decoded.userId).select("-password")
        if(!user) {
            clearAuthCookie(res)
            return res.status(404).json({message: "User Not Found"})
        }

        let authSession
        if (decoded.sessionId) {
            authSession = await findActiveAuthSession(decoded.sessionId, decoded.userId)
            if (!authSession) {
                clearAuthCookie(res)
                return res.status(401).json({ message: "Session expired or revoked" })
            }
        } else {
            // Upgrade cookies issued before device-bound sessions were deployed.
            authSession = await createAuthSession(decoded.userId, req)
            generateToken(decoded.userId, authSession.sessionId, res)
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
        console.log(error)
        clearAuthCookie(res)
        return res.status(401).json({ message: "Invalid or expired session" })
    }
}
