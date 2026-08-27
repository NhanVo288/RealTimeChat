import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const notificationSound = new Audio("/sounds/notification.mp3");
const eventsUrl = import.meta.env.MODE === "development"
  ? "http://localhost:3000/api/messages/events"
  : "/api/messages/events";

const getDirectUserId = (selection) => {
  if (selection?.type !== "group") {
    return selection?.members?.find(
      (member) => member._id !== useAuthStore.getState().authUser?._id
    )?._id || selection?._id;
  }
  return selection._id;
};

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  conversations: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUserLoading: false,
  isMessagesLoading: false,
  isSoundEnable: JSON.parse(localStorage.getItem("isSoundEnable")) === true,
  conversationEventSource: null,

  toggleSound: () => {
    const newState = !get().isSoundEnable;
    localStorage.setItem("isSoundEnable", JSON.stringify(newState));
    set({ isSoundEnable: newState });
  },
  setActiveTabs: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser: selectedUser }),

  subscribeToConversationEvents: () => {
    if (get().conversationEventSource) return;
    const eventSource = new EventSource(eventsUrl, { withCredentials: true });

    const refreshConversations = () => get().getConversations();
    eventSource.addEventListener("group-created", (event) => {
      const conversation = JSON.parse(event.data);
      set((state) => ({
        conversations: state.conversations.some((item) => item._id === conversation._id)
          ? state.conversations
          : [conversation, ...state.conversations],
      }));
    });
    eventSource.addEventListener("member-added", (event) => {
      const { conversationId, member } = JSON.parse(event.data);
      set((state) => {
        const updateConversation = (conversation) => conversation._id === conversationId
          ? {
              ...conversation,
              members: conversation.members.some((item) => item._id === member._id)
                ? conversation.members
                : [...conversation.members, member],
            }
          : conversation;
        return {
          conversations: state.conversations.map(updateConversation),
          selectedUser: state.selectedUser?._id === conversationId
            ? updateConversation(state.selectedUser)
            : state.selectedUser,
        };
      });
      refreshConversations();
    });
    eventSource.addEventListener("member-removed", (event) => {
      const { conversationId, memberId } = JSON.parse(event.data);
      const currentUserId = useAuthStore.getState().authUser?._id;
      if (memberId === currentUserId && get().selectedUser?._id === conversationId) {
        set({ selectedUser: null, messages: [] });
      } else {
        set((state) => ({
          conversations: state.conversations.map((conversation) => conversation._id === conversationId
            ? { ...conversation, members: conversation.members.filter((member) => member._id !== memberId) }
            : conversation),
          selectedUser: state.selectedUser?._id === conversationId
            ? { ...state.selectedUser, members: state.selectedUser.members.filter((member) => member._id !== memberId) }
            : state.selectedUser,
        }));
      }
      refreshConversations();
    });
    eventSource.addEventListener("group-deleted", (event) => {
      const { conversationId } = JSON.parse(event.data);
      set((state) => ({
        conversations: state.conversations.filter((conversation) => conversation._id !== conversationId),
        selectedUser: state.selectedUser?._id === conversationId ? null : state.selectedUser,
        messages: state.selectedUser?._id === conversationId ? [] : state.messages,
      }));
      get().getConversations();
    });
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        set({ conversationEventSource: null });
      }
    };
    set({ conversationEventSource: eventSource });
  },

  unsubscribeFromConversationEvents: () => {
    get().conversationEventSource?.close();
    set({ conversationEventSource: null });
  },

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
  getConversations: async () => {
    set({ isUserLoading: true });
    try {
      const res = await axiosInstance.get("/messages/conversations");
      set({ conversations: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải cuộc trò chuyện");
    } finally {
      set({ isUserLoading: false });
    }
  },
  createGroup: async (name, memberIds) => {
    try {
      const res = await axiosInstance.post("/messages/groups", { name, memberIds });
      set((state) => ({ conversations: [res.data, ...state.conversations] }));
      set({ selectedUser: res.data });
      toast.success("Tạo nhóm thành công");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tạo nhóm");
      return null;
    }
  },
  deleteGroup: async (conversationId) => {
    try {
      await axiosInstance.delete(`/messages/conversations/${conversationId}`);
      set((state) => ({
        conversations: state.conversations.filter(
          (conversation) => conversation._id !== conversationId
        ),
        selectedUser: null,
        messages: [],
      }));
      toast.success("Đã xóa nhóm");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể xóa nhóm");
      return false;
    }
  },
  removeGroupMember: async (conversationId, memberId) => {
    try {
      await axiosInstance.delete(
        `/messages/conversations/${conversationId}/members/${memberId}`
      );
      set((state) => {
        const updateConversation = (conversation) => conversation._id === conversationId
          ? {
              ...conversation,
              members: conversation.members.filter((member) => member._id !== memberId),
            }
          : conversation;
        const conversations = state.conversations.map(updateConversation);
        const selectedUser = state.selectedUser?._id === conversationId
          ? updateConversation(state.selectedUser)
          : state.selectedUser;
        return { conversations, selectedUser };
      });
      toast.success("Đã kick thành viên");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể kick thành viên");
      return false;
    }
  },
  addGroupMember: async (conversationId, memberId) => {
    try {
      const res = await axiosInstance.post(
        `/messages/conversations/${conversationId}/members/${memberId}`
      );
      set((state) => {
        const updateConversation = (conversation) => conversation._id === conversationId
          ? { ...conversation, members: [...conversation.members, res.data] }
          : conversation;
        return {
          conversations: state.conversations.map(updateConversation),
          selectedUser: state.selectedUser?._id === conversationId
            ? updateConversation(state.selectedUser)
            : state.selectedUser,
        };
      });
      toast.success("Đã thêm thành viên");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể thêm thành viên");
      return false;
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
  getMessagesBySelection: async (selection) => {
    set({ isMessagesLoading: true });
    try {
      const url = selection.type === "group"
        ? `/messages/conversations/${selection._id}`
        : `/messages/${getDirectUserId(selection)}`;
      const res = await axiosInstance.get(url);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải tin nhắn");
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (payload) => {
    // payload = { text: '...', image: File | dataURL | null }
    const { selectedUser } = get();
      const directUserId = getDirectUserId(selectedUser);
    const { authUser } = useAuthStore.getState();

    // Tạo optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser.type === "group" ? undefined : directUserId,
      conversationId: selectedUser.type === "group" ? selectedUser._id : undefined,
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

      const endpoint = selectedUser.type === "group"
        ? `/messages/conversations/${selectedUser._id}/send`
        : `/messages/send/${directUserId}`;
      const res = await axiosInstance.post(
        endpoint,
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
      const belongsToSelection = selectedUser.type === "group"
        ? newMessage.conversationId === selectedUser._id
        : newMessage.senderId === getDirectUserId(selectedUser);
      if (!belongsToSelection) return;
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
