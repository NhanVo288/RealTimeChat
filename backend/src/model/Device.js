import mongoose from "mongoose";

const publicKeySchema = new mongoose.Schema(
  {
    kty: { type: String, required: true },
    crv: { type: String, required: true },
    x: { type: String, required: true },
    y: { type: String, required: true },
    ext: Boolean,
    key_ops: [String],
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, required: true },
    name: { type: String, default: "Browser", maxlength: 120 },
    identitySigningKey: { type: publicKeySchema, required: true },
    signedPreKey: {
      keyId: { type: String, required: true },
      publicKey: { type: publicKeySchema, required: true },
      signature: { type: String, required: true },
      createdAt: { type: Date, required: true },
    },
    oneTimePreKeys: [{
      _id: false,
      keyId: { type: String, required: true },
      publicKey: { type: publicKeySchema, required: true },
      signature: { type: String, required: true },
    }],
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export default mongoose.model("Device", deviceSchema);
