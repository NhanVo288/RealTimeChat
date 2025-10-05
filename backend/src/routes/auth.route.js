
import express from 'express'

const router = express.Router()

router.get("/signup", (req,res) =>{
    res.send('SignUp')
}
)
router.get("/login", (req,res) =>{
    res.send("Login")
}
)
router.get("/logout", (req,res) =>{
    res.send('Logout')
}
)


export default router;