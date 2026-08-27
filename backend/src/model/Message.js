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
      maxlength: 2000,
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

const Message = mongoose.model("Message", messageSchema);

export default Message;