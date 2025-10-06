import jwt from 'jsonwebtoken'
import User from '../model/User.js'
import { ENV } from '../lib/env.js'


export const protectRoute = async (req, res, nextFunc) => {
    try {
        const token = req.cookies.jwt
        if(!token) return res.status(401).json({message: "No token provided"})
        const decoded = jwt.verify(token, ENV.JWT_SECRET)
        if(!decoded) return res.status(401).json({message: "Invalid token"})

        const user = await User.findById(decoded.userId).select("-password")
        if(!user) return res.status(404).json({message: "User Not Found"})
        req.user = user
        nextFunc()
    } catch (error) {
        console.log(error)
    }
}