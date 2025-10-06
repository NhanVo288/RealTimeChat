import aj from "../lib/arcjet.js";
import { isSpoofedBot } from "@arcjet/inspect";

export const arcjetProtect = async (req, res, nextMedthod) => {
  try {
    const decision = await aj.protect(req);
    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res
          .status(429)
          .json({ message: "Rate Limit exceeded. Try again" });
      } else if (decision.reason.isBot()) {
        return res.status(403).json({ message: "Bot Access Denined" });
      } else {
        return res
          .status(403)
          .json({ message: "Access Denined by security policy" });
      }
    }
    if (decision.results.some(isSpoofedBot)) {
      return res.status(403).json({
        error: "Spoofed bot detected",
        message: "Bot activity detected",
      });
    }
    nextMedthod()
  } catch (error) {
    console.log(error);
    nextMedthod();
  }
};
