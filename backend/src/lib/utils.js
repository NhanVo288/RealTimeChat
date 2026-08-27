import jwt from 'jsonwebtoken'
import { ENV } from './env.js'

export const generateToken = (userId, res) =>{
    const token = jwt.sign({userId},ENV.JWT_SECRET,{
        expiresIn: "7d"
    })
    res.cookie('jwt',token,{
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none", // strict for avoid CSRF attack
        secure: ENV.NODE_ENV !== "development" || Boolean(ENV.TLS_KEY_PATH)
    })
    return token
}