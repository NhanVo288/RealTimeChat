import { create } from "zustand";
import { axiosInstance, refreshAccessToken } from "../../../shared/lib/axios";
import toast from "react-hot-toast";
import { io } from 'socket.io-client'
import { initializeE2EE, resetE2EESession } from "../../../shared/lib/crypto";


const BASE_URL = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.MODE === "development" ? "http://localhost:3000" : "/");
const activateE2EE = async (userId, set, get, backupPassword) => {
  try {
    const device = await initializeE2EE(userId, { backupPassword });
    if (get().authUser?._id === userId) {
      set({ isE2EEReady: true, e2eeError: null, currentDeviceId: device.deviceId });
    }
  } catch (error) {
    console.error("E2EE initialization error:", error);
    if (get().authUser?._id === userId) {
      set({ isE2EEReady: false, e2eeError: error.message, currentDeviceId: null });
    }
  }
};

export const useAuthStore = create((set,get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigingUp: false,
  isLogingIn: false,
  socket: null,
  onlineUsers: [],
  socketConnectionVersion: 0,
  sessionReconnectPending: false,
  isE2EEReady: false,
  e2eeError: null,
  currentDeviceId: null,
  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      await activateE2EE(res.data._id, set, get);
    } catch (error) {
      console.log(error);
      set({ authUser: null, isE2EEReady: false, e2eeError: null, currentDeviceId: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },
  signUp: async (data) => {
    set({ isSigingUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      await activateE2EE(res.data._id, set, get, data.password);
      toast.success("Tao tai khoan thanh cong");
      get().connectSocket()
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      set({ isSigingUp: false });
    }
  },
  logIn: async (data) => {
    set({ isLogingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      await activateE2EE(res.data._id, set, get, data.password);
      toast.success("Dang nhap thanh cong");

      get().connectSocket()
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      set({ isLogingIn: false });
    }
  },
  logOut: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({authUser: null, isE2EEReady: false, e2eeError: null, currentDeviceId: null})
      resetE2EESession();
      toast.success("Đăng xuất thành công")
      get().disconnectSocket()
    } catch (error) {
        toast.error("Đăng xuất thất bại")
        console.log(error)
    }
  },
  updateProfile: async(data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile",data)
      set({authUser: res.data})
      toast.success("Update Avatar thanh cong")
    } catch (error) {
      toast.error(error.response.data.message)
    }
  },

  connectSocket: () => {
    const { authUser, socket: currentSocket } = get()
    if (!authUser || currentSocket?.connected) return
    currentSocket?.disconnect()
    const socket = io(BASE_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    })
    set({socket})
    socket.on("connect", () => {
      set((state) => ({
        socket,
        onlineUsers: state.onlineUsers,
        socketConnectionVersion: state.socketConnectionVersion + 1,
      }));
    })
    socket.on("getOnlineUser", (userIds) => {
      set({onlineUsers: userIds})
    })
    socket.on("session-revoked", ({ reason } = {}) => {
      if (reason === "replaced") get().handleSessionReplaced();
      else if (reason !== "logout") get().handleSessionRevoked();
    })
    socket.on("disconnect", () => {
      set({ onlineUsers: get().onlineUsers.filter((id) => id !== authUser._id) });
    })
    socket.on("connect_error", async (error) => {
      console.error("Socket connection error:", error.message);
      try {
        await refreshAccessToken();
        if (get().authUser && get().socket === socket) socket.connect();
      } catch (refreshError) {
        if (refreshError.response?.status === 401 && get().socket === socket) {
          get().handleSessionRevoked();
        }
      }
    })
  },
  disconnectSocket: () => {
   get().socket?.disconnect()
   set({
     socket: null,
     onlineUsers: [],
     socketConnectionVersion: 0,
     sessionReconnectPending: false,
   })
  },
  handleSessionRevoked: () => {
    if (!get().authUser) return;
    get().socket?.disconnect();
    resetE2EESession();
    set({
      authUser: null,
      isE2EEReady: false,
      e2eeError: null,
      currentDeviceId: null,
      socket: null,
      onlineUsers: [],
      socketConnectionVersion: 0,
      sessionReconnectPending: false,
    });
    toast.error("Thiết bị này đã bị thu hồi");
  },
  handleSessionReplaced: () => {
    if (!get().authUser || get().sessionReconnectPending) return;
    get().socket?.disconnect();
    set({ socket: null, socketConnectionVersion: 0, sessionReconnectPending: true });
    queueMicrotask(() => {
      set({ sessionReconnectPending: false });
      get().connectSocket();
    });
  },
}));
