import { create } from "zustand";
import { axiosInstance } from "../../../shared/lib/axios";
import toast from "react-hot-toast";
import { io } from 'socket.io-client'


const BASE_URL = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.MODE === "development" ? "http://localhost:3000" : "/");
export const useAuthStore = create((set,get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigingUp: false,
  isLogingIn: false,
  socket: null,
  onlineUsers: [],
  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
    } catch (error) {
      console.log(error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },
  signUp: async (data) => {
    set({ isSigingUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Tao tai khoan thanh cong");
      get().connectSocket()
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigingUp: false });
    }
  },
  logIn: async (data) => {
    set({ isLogingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Dang nhap thanh cong");

      get().connectSocket()
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLogingIn: false });
    }
  },
  logOut: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({authUser: null})
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
    const { authUser} = get()
    if(!authUser || get().socket?.connected) return 
    const socket = io(BASE_URL, { withCredentials: true, autoConnect: false })
    socket.on("getOnlineUser", (userIds) => {
      set({onlineUsers: userIds})
    })
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message)
    })
    set({socket})
    socket.connect()
  },
  disconnectSocket: () => {
   if(get().socket) {
     get().socket.disconnect()
     set({ socket: null, onlineUsers: [] })
   }
  }
}));
