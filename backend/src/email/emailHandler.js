import { resendClient,sender } from "../lib/resend.js"
import { verifyEmailTemplate } from "./emailTempalate.js"


export const sendWelcomeEmail = async (email,name,clientURL) => {
    const { data ,error }= await resendClient.emails.send({
        from: `${sender.name} <${sender.email}>`,
        to: email,
        subject: 'Welcome to Chat App',
        html: verifyEmailTemplate(name,clientURL)
    })
    if(error)
    {
        console.log(error)
    } else{
        console.log("Welcome Email Sent successfully",data)
    }
}