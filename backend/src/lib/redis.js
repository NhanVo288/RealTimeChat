import { createClient } from "redis";
import { ENV } from "./env.js";

export const redis = createClient({
  // Upstash: rediss://default:<PASSWORD>@<ENDPOINT>:6379 (TLS enabled by rediss).
  url: ENV.REDIS_URL,
  disableOfflineQueue: true,
  socket: { connectTimeout: 5000 },
});
redis.on("error", (error) => console.error("Redis connection error:", error.message));
