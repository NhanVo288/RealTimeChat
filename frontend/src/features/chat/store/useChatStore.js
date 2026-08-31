import { create } from "zustand";
import { axiosInstance } from "../../../shared/lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { decryptMessages, encryptMessage } from "../../../shared/lib/crypto";

const notificationSound = new Audio("/sounds/notification.mp3");
const eventsUrl = import.meta.env.VITE_EVENTS_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:3000/api/messages/events"
    : "/api/messages/events");
const messagePageSize = 30;

const getDirectUserId = (selection) => {
  if (selection?.type !== "group") {
    return selection?.members?.find(
      (member) => member._id !== useAuthStore.getState().authUser?._id
    )?._id || selection?._id;
  }
  return selection._id;
};

const getRecipientUserIds = (selection) => selection?.type === "group"
  ? selection.members.map((member) => member._id)
  : [getDirectUserId(selection)];

const getEncryptionContext = (selection) => {
  if (selection?.type === "group") return `conversation:${selection._id}`;
  const userIds = [
    useAuthStore.getState().authUser?._id,
    getDirectUserId(selection),
  ].filter(Boolean).sort();
  return `direct:${userIds.join(":")}`;
};

const mergeMessages = (currentMessages, incomingMessages) => {
  const messagesById = new Map(currentMessages.map((message) => [message._id, message]));
  incomingMessages.forEach((message) => messagesById.set(message._id, message));
  return [...messagesById.values()].sort(
    (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
  );
};

const uniqueMembers = (members = []) => [
  ...new Map(members.map((member) => [member._id, member])).values(),
];

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
  messageCursor: null,
  hasMoreMessages: false,
  isLoadingOlderMessages: false,

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
              members: uniqueMembers([...conversation.members, member]),
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
            ? {
                ...conversation,
                members: uniqueMembers(
                  conversation.members.filter((member) => member._id !== memberId)
                ),
              }
            : conversation),
          selectedUser: state.selectedUser?._id === conversationId
            ? {
                ...state.selectedUser,
                members: uniqueMembers(
                  state.selectedUser.members.filter((member) => member._id !== memberId)
                ),
              }
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
    const updateMessage = async (event) => {
      const updatedMessage = JSON.parse(event.data);
      const selectedUser = get().selectedUser;
      if (!selectedUser) return;
      const belongsToSelection = selectedUser.type === "group"
        ? updatedMessage.conversationId === selectedUser._id
        : updatedMessage.senderId === getDirectUserId(selectedUser) ||
          updatedMessage.conversationId === selectedUser._id;
      if (!belongsToSelection) return;
      const [message] = await decryptMessages([updatedMessage]);
      set((state) => ({
        messages: state.messages.map((item) => item._id === message._id ? message : item),
      }));
    };
    eventSource.addEventListener("message-updated", updateMessage);
    eventSource.addEventListener("message-deleted", updateMessage);
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
          ? { ...conversation, members: uniqueMembers([...conversation.members, res.data]) }
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
  editMessage: async (messageId, text) => {
    try {
      const existingMessage = get().messages.find((message) => message._id === messageId);
      const encryptedPayload = await encryptMessage(
        { text, image: existingMessage?.image || null },
        getRecipientUserIds(get().selectedUser),
        getEncryptionContext(get().selectedUser)
      );
      const res = await axiosInstance.patch(`/messages/${messageId}`, {
        encryptedPayload,
      });
      const [message] = await decryptMessages([res.data]);
      set((state) => ({
        messages: state.messages.map((item) => item._id === messageId ? message : item),
      }));
      toast.success("Đã sửa tin nhắn");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Không thể sửa tin nhắn");
      return false;
    }
  },
  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      set((state) => ({
        messages: state.messages.map((item) => item._id === messageId ? res.data : item),
      }));
      toast.success("Đã thu hồi tin nhắn");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể thu hồi tin nhắn");
      return false;
    }
  },
  getMessageByUser: async (userId) => {
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const result = Array.isArray(res.data) ? res.data : res.data.messages || [];
      set({ messages: await decryptMessages(result) });
    } catch (error) {
      toast.error(error?.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  getMessagesBySelection: async (selection) => {
    set({
      messages: [],
      messageCursor: null,
      hasMoreMessages: false,
      isMessagesLoading: true,
    });
    try {
      const url = selection.type === "group"
        ? `/messages/conversations/${selection._id}`
        : `/messages/${getDirectUserId(selection)}`;
      const res = await axiosInstance.get(url, { params: { limit: messagePageSize } });
      const result = Array.isArray(res.data)
        ? { messages: res.data, hasMore: false, nextCursor: null }
        : res.data;
      set({
        messages: await decryptMessages(result.messages || []),
        messageCursor: result.nextCursor,
        hasMoreMessages: result.hasMore,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải tin nhắn");
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  loadOlderMessages: async () => {
    const { selectedUser, messageCursor, hasMoreMessages, isLoadingOlderMessages } = get();
    if (!selectedUser || !messageCursor || !hasMoreMessages || isLoadingOlderMessages) return;
    set({ isLoadingOlderMessages: true });
    try {
      const url = selectedUser.type === "group"
        ? `/messages/conversations/${selectedUser._id}`
        : `/messages/${getDirectUserId(selectedUser)}`;
      const res = await axiosInstance.get(url, {
        params: { limit: messagePageSize, before: messageCursor },
      });
      const result = Array.isArray(res.data)
        ? { messages: res.data, hasMore: false, nextCursor: null }
        : res.data;
      const messages = mergeMessages(
        get().messages,
        await decryptMessages(result.messages || [])
      );
      set({
        messages,
        messageCursor: result.nextCursor,
        hasMoreMessages: result.hasMore,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải thêm tin nhắn");
    } finally {
      set({ isLoadingOlderMessages: false });
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
      const encryptedPayload = await encryptMessage(
        { text: payload.text || "", image: payload.image || null },
        getRecipientUserIds(selectedUser),
        getEncryptionContext(selectedUser)
      );
      body = { encryptedPayload };

      const res = await axiosInstance.post(
        endpoint,
        body,
        { headers }
      );

      const [serverMessage] = await decryptMessages([res.data]);

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
        error.response?.data?.message || error.message ||
          "Gửi tin nhắn thất bại. Vui lòng thử lại."
      );
    }
  },
  subscribeToMessage: () => {
    const { selectedUser, isSoundEnable } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", async (newMessage) => {
      const isGroupMessage = get().conversations.some(
        (conversation) =>
          conversation.type === "group" &&
          conversation._id === newMessage.conversationId
      );
      const belongsToSelection = selectedUser.type === "group"
        ? newMessage.conversationId === selectedUser._id
        : selectedUser.type === "direct"
          ? newMessage.conversationId === selectedUser._id
          : !isGroupMessage && newMessage.senderId === getDirectUserId(selectedUser);
      if (!belongsToSelection) return;
      const [decryptedMessage] = await decryptMessages([newMessage]);
      set((state) => ({
        messages: mergeMessages(state.messages, [decryptedMessage]),
      }));
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
