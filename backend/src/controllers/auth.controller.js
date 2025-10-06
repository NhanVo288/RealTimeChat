import User from "../model/User.js";
import { generateToken } from "../lib/utils.js";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "../email/emailHandler.js";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
export const signUp = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid Email Format" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const newUser = new User({
      fullName,
      email,
      password: hashPassword,
    });

    if (newUser) {
      const saveUser = await newUser.save();
      generateToken(saveUser._id, res);
      res.status(201).json({
        _id: saveUser._id,
        fullName: saveUser.fullName,
        email: saveUser.email,
        profilePic: saveUser.profilePic,
      });
      try {
        await sendWelcomeEmail(
          saveUser.email,
          saveUser.fullName,
          ENV.CLIENT_URL
        );
      } catch (error) {
        console.log("Error", error);
      }
    } else {
      return res.status(400).json({ message: "Invalid User" });
    }
  } catch (error) {
    console.log(error);
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and Password are required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid credentials" });
    generateToken(user._id, res);
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.log(error);
  }
};

export const logout = (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logout Successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic)
      return res.status(400).json({ message: "Profile picture is required" });
    const userId = req.user._id;
    const uploadRes = await cloudinary.uploader.upload(profilePic);
    const updateUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadRes.secure_url },
      { new: true }
    );
    res.status(200).json(updateUser)
  } catch (error) {
    console.log(error)
  }
};
