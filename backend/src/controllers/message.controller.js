import cloudinary from "../lib/cloudinary.js";
import { getReceiverSockerId, io } from "../lib/socket.js";
import Message from "../model/Message.js";
import User from "../model/User.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedUserId = req.user._id;
    const filterdUser = await User.find({ _id: { $ne: loggedUserId } }).select(
      "-password"
    );
    res.status(200).json(filterdUser);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "SERVER ERROR" });
  }
};

export const getChatByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userChatWith } = req.params;
    //find:  i send orthers message or others send me message
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userChatWith },
        { senderId: userChatWith, receiverId: myId },
      ],
    });
    res.status(200).json(messages);
  } catch (error) {
    console.log(error.message);
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageURL;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageURL = uploadResponse.secure_url;
    }
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageURL,
    });
    await newMessage.save();

    const receiverSocketId = getReceiverSockerId(receiverId)
    if(receiverSocketId){
      io.to(receiverSocketId).emit('newMessage',newMessage)
    }
    res.status(200).json(newMessage);
  } catch (error) {
    console.log(error.message);
  }
};

export const getChats = async (req, res) => {
  try {
    const loggedUserId = req.user._id;
    const messsages = await Message.find({
      $or: [{ senderId: loggedUserId }, { receiverId: loggedUserId }],
    });

    const chatPartnerId = [...new Set(messsages.map((msg) =>
      msg.senderId.toString() === loggedUserId.toString()
        ? msg.receiverId.toString()
        : msg.senderId.toString()
    ))];

    const chatPartners = await User.find({_id:{$in: chatPartnerId}}).select("-password")
    res.status(200).json(chatPartners)
  } catch (error) {
    console.log(error)
  }
};
