import mongoose from "mongoose";
import Device from "../model/Device.js";

const isPublicP256Key = (key) => key && key.kty === "EC" && key.crv === "P-256" &&
  typeof key.x === "string" && key.x.length <= 100 &&
  typeof key.y === "string" && key.y.length <= 100 && !key.d;

const validPreKey = (key) => key && typeof key.keyId === "string" &&
  key.keyId.length <= 100 && isPublicP256Key(key.publicKey) &&
  typeof key.signature === "string" && key.signature.length <= 300;

export const registerDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { name, identitySigningKey, signedPreKey, oneTimePreKeys = [] } = req.body;
    if (!deviceId || deviceId.length > 100 || !isPublicP256Key(identitySigningKey) ||
      !validPreKey(signedPreKey) || typeof signedPreKey.signature !== "string" ||
      !Number.isFinite(Date.parse(signedPreKey.createdAt)) ||
      !Array.isArray(oneTimePreKeys) || oneTimePreKeys.length > 100 ||
      !oneTimePreKeys.every(validPreKey)) {
      return res.status(400).json({ message: "Invalid device key bundle" });
    }

    let device = await Device.findOne({ userId: req.user._id, deviceId });
    if (device?.revokedAt) return res.status(409).json({ message: "Device has been revoked" });
    if (device && (device.identitySigningKey.x !== identitySigningKey.x ||
      device.identitySigningKey.y !== identitySigningKey.y)) {
      return res.status(409).json({ message: "Device identity key cannot be replaced" });
    }
    if (!device) {
      device = new Device({ userId: req.user._id, deviceId, identitySigningKey });
    }
    device.name = String(name || "Browser").slice(0, 120);
    device.signedPreKey = { ...signedPreKey, createdAt: new Date(signedPreKey.createdAt) };
    const knownKeyIds = new Set(device.oneTimePreKeys.map((key) => key.keyId));
    device.oneTimePreKeys.push(...oneTimePreKeys.filter((key) => !knownKeyIds.has(key.keyId)));
    device.lastSeenAt = new Date();
    await device.save();
    return res.status(200).json({
      deviceId: device.deviceId,
      name: device.name,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    });
  } catch (error) {
    console.error("Register device error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getDevices = async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user._id, revokedAt: null })
      .select("deviceId name lastSeenAt createdAt").sort({ lastSeenAt: -1 });
    return res.status(200).json(devices);
  } catch (error) {
    console.error("Get devices error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const revokeDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { userId: req.user._id, deviceId: req.params.deviceId, revokedAt: null },
      { revokedAt: new Date(), oneTimePreKeys: [] },
      { new: true }
    );
    if (!device) return res.status(404).json({ message: "Device not found" });
    return res.status(200).json({ message: "Device revoked" });
  } catch (error) {
    console.error("Revoke device error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const claimKeyBundles = async (req, res) => {
  try {
    const userIds = [...new Set((req.body.userIds || []).map(String))];
    if (!userIds.length || userIds.length > 100 ||
      userIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid recipients" });
    }

    const devices = await Device.find({ userId: { $in: userIds }, revokedAt: null });
    const bundles = [];
    for (const device of devices) {
      const claimedDevice = await Device.findOneAndUpdate(
        { _id: device._id, "oneTimePreKeys.0": { $exists: true } },
        { $pop: { oneTimePreKeys: -1 } },
        { new: false }
      );
      let preKey = claimedDevice?.oneTimePreKeys?.[0];
      let preKeyType = preKey ? "one-time" : "signed";
      if (!preKey) {
        preKey = device.signedPreKey;
      }
      bundles.push({
        userId: device.userId.toString(),
        deviceId: device.deviceId,
        identitySigningKey: device.identitySigningKey,
        signedPreKey: device.signedPreKey,
        preKey: {
          keyId: preKey.keyId,
          publicKey: preKey.publicKey,
          signature: preKey.signature,
          type: preKeyType,
        },
      });
    }
    return res.status(200).json({ bundles });
  } catch (error) {
    console.error("Claim key bundles error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
