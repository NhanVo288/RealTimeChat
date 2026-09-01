import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "text",
        "image",
        "file",
        "system",
      ],
      default: "text",
    },

    text: {
      type: String,
      trim: true,
      maxlength: 10000,
    },

    isEncrypted: {
      type: Boolean,
      default: false,
    },

    encryptedPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    clientMessageId: {
      type: String,
      default: null,
      maxlength: 100,
    },

    encryptionRevision: {
      type: Number,
      default: 0,
      min: 0,
    },

    attachments: [
      {
        url: String,
        name: String,
        size: Number,
        mimeType: String,
      },
    ],

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, _id: -1 });
messageSchema.index(
  { senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
