import express from "express";
import { signUp, login, logout, refresh, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtect } from "../middleware/arcjet.middleware.js";
import {
  getDeviceKeyBackup,
  getKeyBundles,
  getDevices,
  putDeviceKeyBackup,
  registerDevice,
  revokeDevice,
} from "../controllers/device.controller.js";

const router = express.Router();
router.use(arcjetProtect)
router.post("/signup", signUp);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.put("/update-profile", protectRoute,updateProfile);
router.get("/devices", protectRoute, getDevices);
router.put("/devices/:deviceId", protectRoute, registerDevice);
router.delete("/devices/:deviceId", protectRoute, revokeDevice);
router.post("/keys/bundles", protectRoute, getKeyBundles);
router.get("/keys/backup", protectRoute, getDeviceKeyBackup);
router.put("/keys/backup", protectRoute, putDeviceKeyBackup);

router.get("/check", protectRoute, (req,res) => res.status(200).json(req.user))

export default router;
