import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const notificationSound = new Audio("/sounds/notification.mp3");
export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUserLoading: false,
  isMessagesLoading: false,
  isSoundEnable: JSON.parse(localStorage.getItem("isSoundEnable")) === true,

  toggleSound: () => {
    const newState = !get().isSoundEnable;
    localStorage.setItem("isSoundEnable", JSON.stringify(newState));
    set({ isSoundEnable: newState });
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
  getChatPartner: async () => {
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
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error?.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (payload) => {
    // payload = { text: '...', image: File | dataURL | null }
    const { selectedUser } = get();
    const { authUser } = useAuthStore.getState();

    // Tạo optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: payload.text || "",
      image: payload.image || null,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    //Thêm optimistic message vào state dựa trên state hiện tại
    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    try {
      // Chuẩn bị body cho request nếu có file, dùng FormData
      let body;
      let headers = {};

      // Nếu payload.image là File object -> FormData
      if (payload.image instanceof File) {
        body = new FormData();
        body.append("text", payload.text || "");
        body.append("image", payload.image);
        // headers không cần set 'Content-Type' explicit khi dùng FormData,
        // axios sẽ tự thêm boundary
      } else {
        // Nếu payload.image là dataURL hoặc null, gửi JSON
        body = {
          text: payload.text || "",
          image: payload.image || null,
        };
        headers["Content-Type"] = "application/json";
      }

      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        body,
        { headers }
      );

      const serverMessage = res.data;

      //  Thay thế optimistic message bằng message server (reconcile)
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === tempId ? serverMessage : m
        ),
      }));
    } catch (error) {
      // thất bại thi gỡ optimistic message và báo lỗi
      set((state) => ({
        messages: state.messages.filter((m) => m._id !== tempId),
      }));

      toast.error(
        error.response?.data?.message ||
          "Gửi tin nhắn thất bại. Vui lòng thử lại."
      );
    }
  },
  subscribeToMessage: () => {
    const { selectedUser, isSoundEnable } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;
      const currentMessage = get().messages;
      set({ messages: [...currentMessage, newMessage] });
      if (isSoundEnable) {
        notificationSound.currentTime = 0;
        notificationSound.play().catch((e) => console.log("Audio error", e));
      }
    });
  },
  unsubscribeMessage: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },
}));
