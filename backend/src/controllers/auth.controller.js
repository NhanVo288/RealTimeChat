import User from "../model/User.js"
import { generateToken } from "../lib/utils.js"
import bcrypt from 'bcryptjs'
export const signUp = async (req, res) =>{
    const { fullName, email, password} = req.body
    try {
        if(!fullName || !email || !password){
            return res.status(400).json({message:"All fields are required"})
        }

        if(password.length < 6)
        {
            return res.status(400).json({message:"Password must be at least 6 characters"})
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if(!emailRegex.test(email)){
            return res.status(400).json({message:"Invalid Email Format"})
        }

        const user = await User.findOne({email})
        if(user) return res.status(400).json({message:"Email already exists"})

        const salt = await bcrypt.genSalt(10)
        const hashPassword = await bcrypt.hash(password,salt)
        const newUser = new User({
            fullName,
            email,
            password: hashPassword
        })

        if(newUser) {
            const saveUser = await newUser.save()
            generateToken(saveUser._id, res)
            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic
            })
        } else{ 
            return res.status(400).json({message: "Invalid User"})
        }
    } catch (error) {
        console.log("Error in signup controller", error)
    }
}
