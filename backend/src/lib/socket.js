import {Server} from 'socket.io'
import fs from 'fs'
import http from 'http'
import https from 'https'
import express from 'express'
import { ENV } from './env.js'
import { socketAuthMiddleware } from '../middleware/socket.auth.middleware.js'

const app = express()
const hasTlsCertificates = ENV.TLS_KEY_PATH &&
    ENV.TLS_CERT_PATH &&
    fs.existsSync(ENV.TLS_KEY_PATH) &&
    fs.existsSync(ENV.TLS_CERT_PATH)

const server = hasTlsCertificates
    ? https.createServer({
        key: fs.readFileSync(ENV.TLS_KEY_PATH),
        cert: fs.readFileSync(ENV.TLS_CERT_PATH),
    }, app)
    : http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'https://localhost:5173'].filter(Boolean),
        credentials: true
    }
})
//apply authentication middleware
io.use(socketAuthMiddleware)

// kiem tra user on hay off
export function getReceiverSockerId(userId) {
    return userSocketMap[userId]
}
// store online users
const userSocketMap = {} //{userId : socketId}

io.on("connection", (socket) => {
    console.log("A user connected" , socket.user.fullName)

    const userId = socket.userId
    userSocketMap[userId] = socket.id

    // send event to all connected clients
    io.emit("getOnlineUser", Object.keys(userSocketMap))

    // socket.on is listening for events from clients
    socket.on("disconnect", () => {
        console.log("Disconnect", socket.user.fullName)
        delete userSocketMap[userId]
        io.emit('getOnlineUser', Object.keys(userSocketMap))
    })
})

export { io, app, server}