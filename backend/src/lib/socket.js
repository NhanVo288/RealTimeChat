import {Server} from 'socket.io'
import http from 'http'
import express from 'express'
import { ENV } from './env.js'
import { socketAuthMiddleware } from '../middleware/socket.auth.middleware.js'

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: [ENV.CLIENT_URL],
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