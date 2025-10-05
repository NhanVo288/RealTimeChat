import authRoute from './routes/auth.route.js'
import messageRoute from './routes/message.route.js'
import express from 'express'
import dotenv from 'dotenv'
dotenv.config()

const app = express()

const PORT = process.env.PORT

app.use("/api/auth",authRoute)
app.use("/api/messages",messageRoute)

app.listen(3000, () => console.log("server running on port:", PORT))