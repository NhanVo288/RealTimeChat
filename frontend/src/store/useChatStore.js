import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUserLoading: false,
  isMessagesLoading: false,
  isSoundEnable: localStorage.getItem("isSoundEnable") === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnable", !get().isSoundEnable);
    set({ isSoundEnable: !get().isSoundEnable });
  },
  setActiveTabs: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser: selectedUser }),

  getAllContacts: async () => {
    set({ isUserLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUserLoading: false });
    }
  },
  getChatPartner: async() => {
    set({ isUserLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUserLoading: false });
    }
  },
  getMessageByUser: async (userId) => {
    set({isMessagesLoading: true})
    try {
      const res = await axiosInstance.get(`/messages/${userId}`)
      set({messages: res.data})
    } catch (error) {
      toast.error(error?.response.data.message)
    } finally{ 
      set({isMessagesLoading: false})
    }

  }
}));
