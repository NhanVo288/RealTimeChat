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

export function getReceiverSockerId(userId) {
    const sockets = userSocketMap.get(userId.toString())
    return sockets ? [...sockets].at(-1) : undefined
}

export function emitToUser(userId, event, payload) {
    const sockets = userSocketMap.get(userId.toString())
    if (sockets?.size) io.to([...sockets]).emit(event, payload)
}

// Keep all tabs/devices for a user so one reconnect cannot mark another offline.
const userSocketMap = new Map()

io.on("connection", (socket) => {
    console.log("A user connected" , socket.user.fullName)

    const userId = socket.userId
    const sockets = userSocketMap.get(userId) || new Set()
    sockets.add(socket.id)
    userSocketMap.set(userId, sockets)

    // send event to all connected clients
    io.emit("getOnlineUser", [...userSocketMap.keys()])

    // socket.on is listening for events from clients
    socket.on("disconnect", () => {
        console.log("Disconnect", socket.user.fullName)
        const sockets = userSocketMap.get(userId)
        if (!sockets) return
        sockets.delete(socket.id)
        if (!sockets.size) userSocketMap.delete(userId)
        io.emit('getOnlineUser', [...userSocketMap.keys()])
    })
})

export { io, app, server}
