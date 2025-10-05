
import express from 'express'
import { signUp } from '../controllers/auth.controller.js'

const router = express.Router()

router.post("/signup",signUp)
router.get("/login", (req,res) =>{
    res.send("Login")
}
)
router.get("/logout", (req,res) =>{
    res.send('Logout')
}
)


export default router;