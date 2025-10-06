import express from "express";
import { signUp, login, logout, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtect } from "../middleware/arcjet.middleware.js";

const router = express.Router();
router.use(arcjetProtect)
router.post("/signup", signUp);
router.post("/login", login);
router.post("/logout", logout);
router.put("/update-profile", protectRoute,updateProfile);

router.get("/check", protectRoute, (req,res) => res.status(200).json(req.user))

export default router;
