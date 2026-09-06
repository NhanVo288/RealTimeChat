import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ||
    (import.meta.env.MODE === "development" ? "http://localhost:3000/api" : "/api"),
  withCredentials: true,
});

let refreshRequest;
export const refreshAccessToken = () => {
  if (!refreshRequest) {
    const refresh = async () => {
      // Another tab may have refreshed while this tab waited for the lock.
      try {
        await axiosInstance.get("/auth/check", { skipAuthRefresh: true });
        return;
      } catch (error) {
        if (error.response?.status !== 401) throw error;
      }
      await axiosInstance.post("/auth/refresh", {}, { skipAuthRefresh: true });
    };
    refreshRequest = (globalThis.navigator?.locks
      ? navigator.locks.request("chat-auth-refresh", refresh)
      : refresh()).finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
};

axiosInstance.interceptors.response.use((response) => response, async (error) => {
  const request = error.config;
  if (error.response?.status !== 401 || !request || request.skipAuthRefresh || request._authRetry ||
      /^\/auth\/(login|signup|logout|refresh)(?:\?|$)/.test(request.url)) {
    throw error;
  }
  request._authRetry = true;
  await refreshAccessToken();
  return axiosInstance(request);
});
