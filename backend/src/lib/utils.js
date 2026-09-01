import jwt from 'jsonwebtoken'
import { ENV } from './env.js'

const cookieOptions = () => ({
    httpOnly: true,
    sameSite: "none",
    secure: ENV.NODE_ENV !== "development" || Boolean(ENV.TLS_KEY_PATH)
})

export const generateToken = (userId, sessionId, res) =>{
    const token = jwt.sign({ userId, sessionId },ENV.JWT_SECRET,{
        expiresIn: "7d"
    })
    res.cookie('jwt',token,{
        maxAge: 7 * 24 * 60 * 60 * 1000,
        ...cookieOptions(),
    })
    return token
}

export const clearAuthCookie = (res) => res.cookie("jwt", "", {
    maxAge: 0,
    ...cookieOptions(),
})
