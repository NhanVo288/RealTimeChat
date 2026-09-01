import Device from "../model/Device.js";
import ConversationMember from "../model/ConversationMember.js";
import DeviceKeyBackup from "../model/DeviceKeyBackup.js";
import AuthSession from "../model/AuthSession.js";
import { disconnectSession } from "../lib/socket.js";
import { closeSessionStreams } from "../services/event.service.js";
import {
  isPublicP256Key,
  parseEncryptionContext,
  isBase64WithByteLength,
  verifyDeviceEncryptionKeySignature,
  validateEncryptedKeyBackup,
} from "../lib/e2ee.js";

const resolveBundleUserIds = async (context, requesterId) => {
  const parsed = parseEncryptionContext(context, requesterId);
  if (!parsed) return null;
  if (parsed.type === "direct") return parsed.userIds;
  const isMember = await ConversationMember.exists({
    conversationId: parsed.conversationId,
    userId: requesterId,
  });
  if (!isMember) return null;
  const userIds = (await ConversationMember.find({ conversationId: parsed.conversationId })
    .distinct("userId")).map(String);
  return userIds.length <= 100 ? userIds : null;
};

export const registerDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (req.authSession.deviceId && req.authSession.deviceId !== deviceId) {
      return res.status(409).json({ message: "Session is already bound to another device" });
    }
    const {
      name,
      identitySigningKey,
      encryptionPublicKey,
      encryptionKeySignature,
    } = req.body;
    if (!deviceId || deviceId.length > 100 || !isPublicP256Key(identitySigningKey) ||
      !isPublicP256Key(encryptionPublicKey) ||
      !isBase64WithByteLength(encryptionKeySignature, 64)) {
      return res.status(400).json({ message: "Invalid device key bundle" });
    }
    if (!(await verifyDeviceEncryptionKeySignature(
      identitySigningKey,
      deviceId,
      encryptionPublicKey,
      encryptionKeySignature
    ))) {
      return res.status(400).json({ message: "Invalid device encryption-key signature" });
    }

    let device = await Device.findOne({ userId: req.user._id, deviceId });
    if (device?.revokedAt) return res.status(409).json({ message: "Device has been revoked" });
    if (device && (device.identitySigningKey.x !== identitySigningKey.x ||
      device.identitySigningKey.y !== identitySigningKey.y)) {
      return res.status(409).json({ message: "Device identity key cannot be replaced" });
    }
    if (device?.encryptionPublicKey &&
      (device.encryptionPublicKey.x !== encryptionPublicKey.x ||
        device.encryptionPublicKey.y !== encryptionPublicKey.y)) {
      return res.status(409).json({ message: "Device encryption key cannot be replaced" });
    }
    if (!device) {
      device = new Device({ userId: req.user._id, deviceId, identitySigningKey });
    }
    const previousAuthSessionId = device.authSessionId?.toString();
    device.name = String(name || "Browser").slice(0, 120);
    device.encryptionPublicKey = encryptionPublicKey;
    device.encryptionKeySignature = encryptionKeySignature;
    device.authSessionId = req.authSession._id;
    device.lastSeenAt = new Date();
    await device.save();
    req.authSession.deviceId = deviceId;
    req.authSession.lastSeenAt = new Date();
    await req.authSession.save();

    if (previousAuthSessionId && previousAuthSessionId !== req.authSession._id.toString()) {
      const previousSession = await AuthSession.findOneAndUpdate(
        { _id: previousAuthSessionId, revokedAt: null },
        { revokedAt: new Date() },
        { new: true }
      );
      if (previousSession) {
        disconnectSession(previousSession.sessionId, "replaced");
        closeSessionStreams(previousSession.sessionId, "replaced");
      }
    }
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
      { revokedAt: new Date() },
      { new: true }
    );
    if (!device) return res.status(404).json({ message: "Device not found" });
    let revokedSession = null;
    if (device.authSessionId) {
      revokedSession = await AuthSession.findOneAndUpdate(
        { _id: device.authSessionId, revokedAt: null },
        { revokedAt: new Date() },
        { new: true }
      );
    }
    res.status(200).json({ message: "Device and session revoked" });
    if (revokedSession) {
      disconnectSession(revokedSession.sessionId, "device-revoked");
      closeSessionStreams(revokedSession.sessionId, "device-revoked");
    }
    return undefined;
  } catch (error) {
    console.error("Revoke device error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getKeyBundles = async (req, res) => {
  try {
    const { context } = req.body;
    const userIds = await resolveBundleUserIds(context, req.user._id);
    if (!userIds?.length) return res.status(400).json({ message: "Invalid E2EE context" });

    const devices = await Device.find({
      userId: { $in: userIds },
      revokedAt: null,
      encryptionPublicKey: { $ne: null },
      encryptionKeySignature: { $ne: null },
    }).lean();
    const bundles = devices.map((device) => ({
      userId: device.userId.toString(),
      deviceId: device.deviceId,
      identitySigningKey: device.identitySigningKey,
      encryptionPublicKey: device.encryptionPublicKey,
      encryptionKeySignature: device.encryptionKeySignature,
    }));
    return res.status(200).json({ context, bundles });
  } catch (error) {
    console.error("Get key bundles error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getDeviceKeyBackup = async (req, res) => {
  try {
    const record = await DeviceKeyBackup.findOne({ userId: req.user._id }).lean();
    return res.status(200).json({
      revision: record?.revision || 0,
      backup: record?.backup || null,
    });
  } catch (error) {
    console.error("Get device key backup error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const putDeviceKeyBackup = async (req, res) => {
  try {
    const { backup, expectedRevision } = req.body;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      !validateEncryptedKeyBackup(backup)) {
      return res.status(400).json({ message: "Invalid encrypted device-key backup" });
    }

    const existing = await DeviceKeyBackup.findOne({ userId: req.user._id });
    if (!existing) {
      if (expectedRevision !== 0) {
        return res.status(409).json({ message: "Device-key backup changed" });
      }
      try {
        const created = await DeviceKeyBackup.create({
          userId: req.user._id,
          revision: 1,
          backup,
        });
        return res.status(200).json({ revision: created.revision });
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(409).json({ message: "Device-key backup changed" });
        }
        throw error;
      }
    }

    const updated = await DeviceKeyBackup.findOneAndUpdate(
      { userId: req.user._id, revision: expectedRevision },
      { $set: { backup }, $inc: { revision: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: "Device-key backup changed" });
    return res.status(200).json({ revision: updated.revision });
  } catch (error) {
    console.error("Put device key backup error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
