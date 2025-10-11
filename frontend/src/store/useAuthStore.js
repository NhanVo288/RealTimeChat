import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

export const useAuthStore = create((set) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigingUp: false,
  isLogingIn: false,
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
  }
}));
