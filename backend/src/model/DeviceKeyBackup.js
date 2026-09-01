import mongoose from "mongoose";

const encryptedBackupSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    kdf: { type: String, required: true },
    iterations: { type: Number, required: true },
    salt: { type: String, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false }
);

const deviceKeyBackupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    revision: { type: Number, required: true, default: 1 },
    backup: { type: encryptedBackupSchema, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("DeviceKeyBackup", deviceKeyBackupSchema);
