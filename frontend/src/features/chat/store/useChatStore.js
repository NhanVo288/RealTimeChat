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
const reconnectPageSize = 100;
const lastReadRequestByConversation = new Map();
let conversationsRequest = null;

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

const sortConversationsByLatestMessage = (conversations) => [...conversations].sort(
  (first, second) => new Date(second.lastMessageAt || 0) - new Date(first.lastMessageAt || 0)
);

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
  isSyncingMissingMessages: false,
  messageSocketHandler: null,

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

    const refreshConversations = () => get().getConversations(true);
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
      get().getConversations(true);
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
  getConversations: async (silent = false) => {
    if (!silent) set({ isUserLoading: true });
    try {
      if (!conversationsRequest) {
        conversationsRequest = axiosInstance.get("/messages/conversations")
          .then(({ data }) => Promise.all(data.map(async (conversation) => {
            if (!conversation.lastMessage) return conversation;
            const [lastMessage] = await decryptMessages([conversation.lastMessage]);
            return { ...conversation, lastMessage };
          })))
          .finally(() => { conversationsRequest = null; });
      }
      const conversations = await conversationsRequest;
      set({
        conversations: conversations.map((conversation) => {
          const requestedReadId = lastReadRequestByConversation.get(conversation._id);
          const fetchedReadId = conversation.lastReadMessageId
            ? String(conversation.lastReadMessageId)
            : null;
          if (requestedReadId && (!fetchedReadId || fetchedReadId < requestedReadId)) {
            return {
              ...conversation,
              lastReadMessageId: requestedReadId,
              unreadCount: 0,
            };
          }
          return conversation;
        }),
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải cuộc trò chuyện");
    } finally {
      if (!silent) set({ isUserLoading: false });
    }
  },
  markConversationRead: async (conversationId, messageId) => {
    if (!conversationId || !messageId || String(messageId).startsWith("temp-")) return;
    const requestedMessageId = String(messageId);
    const previousRequest = lastReadRequestByConversation.get(conversationId);
    if (previousRequest && previousRequest >= requestedMessageId) return;
    lastReadRequestByConversation.set(conversationId, requestedMessageId);
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation._id === conversationId
          ? {
              ...conversation,
              lastReadMessageId: requestedMessageId,
              unreadCount: 0,
            }
          : conversation
      ),
    }));
    try {
      const { data } = await axiosInstance.post(
        `/messages/conversations/${conversationId}/read`,
        { messageId: requestedMessageId }
      );
      set((state) => {
        const updateConversation = (conversation) => {
          if (conversation._id !== conversationId) return conversation;
          if (conversation.lastReadMessageId &&
            String(conversation.lastReadMessageId) > String(data.lastReadMessageId)) {
            return conversation;
          }
          return {
            ...conversation,
            lastReadMessageId: data.lastReadMessageId,
            unreadCount: data.unreadCount,
          };
        };
        return { conversations: state.conversations.map(updateConversation) };
      });
    } catch (error) {
      if (lastReadRequestByConversation.get(conversationId) === requestedMessageId) {
        lastReadRequestByConversation.delete(conversationId);
      }
      console.error("Mark conversation read error:", error);
      void get().getConversations(true);
    }
  },
  applyConversationMessage: async (message) => {
    if (!message?.conversationId || !message?._id) return;
    const conversationExists = get().conversations.some(
      (conversation) => conversation._id === message.conversationId
    );
    if (!conversationExists) {
      void get().getConversations(true);
      return;
    }
    const currentUserId = useAuthStore.getState().authUser?._id;
    set((state) => ({
      conversations: sortConversationsByLatestMessage(
        state.conversations.map((conversation) => {
          if (conversation._id !== message.conversationId) return conversation;
          const alreadyApplied = conversation.lastMessage?._id === message._id;
          const isIncoming = message.senderId !== currentUserId;
          return {
            ...conversation,
            lastMessage: message,
            lastMessageAt: message.createdAt || conversation.lastMessageAt,
            unreadCount: alreadyApplied || !isIncoming
              ? Number(conversation.unreadCount || 0)
              : Number(conversation.unreadCount || 0) + 1,
          };
        })
      ),
    }));

    const [decryptedMessage] = await decryptMessages([message]);
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation._id === message.conversationId &&
        conversation.lastMessage?._id === message._id
          ? { ...conversation, lastMessage: decryptedMessage }
          : conversation
      ),
    }));
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
      if (!existingMessage) throw new Error("Message not found");
      const encryptedPayload = await encryptMessage(
        { text, image: existingMessage?.image || null },
        getRecipientUserIds(get().selectedUser),
        getEncryptionContext(get().selectedUser),
        {
          messageId: existingMessage.clientMessageId || existingMessage._id,
          revision: Number(existingMessage.encryptionRevision || 0) + 1,
        }
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
  syncMissingMessages: async () => {
    const { selectedUser, messages, isSyncingMissingMessages } = get();
    if (isSyncingMissingMessages) return;
    if (!selectedUser) {
      await get().getConversations(true);
      return;
    }

    const selectionId = selectedUser._id;
    const latestMessage = [...messages].reverse().find(
      (message) => message._id && !message.isOptimistic &&
        !String(message._id).startsWith("temp-")
    );
    if (!latestMessage) {
      await get().getMessagesBySelection(selectedUser);
      await get().getConversations(true);
      return;
    }

    const url = selectedUser.type === "group"
      ? `/messages/conversations/${selectedUser._id}`
      : `/messages/${getDirectUserId(selectedUser)}`;
    set({ isSyncingMissingMessages: true });
    try {
      let after = latestMessage._id;
      let hasMore = true;
      while (hasMore) {
        const res = await axiosInstance.get(url, {
          params: { limit: reconnectPageSize, after },
        });
        const result = Array.isArray(res.data)
          ? { messages: res.data, hasMore: false, nextCursor: null }
          : res.data;
        const decryptedMessages = await decryptMessages(result.messages || []);
        if (get().selectedUser?._id !== selectionId) {
          return;
        }
        set((state) => ({
          messages: mergeMessages(state.messages, decryptedMessages),
        }));
        hasMore = Boolean(result.hasMore && result.nextCursor && result.nextCursor !== after);
        after = result.nextCursor;
      }
    } catch (error) {
      console.error("Missing message sync error:", error);
      toast.error(error.response?.data?.message || "Không thể đồng bộ tin nhắn bị lỡ");
    } finally {
      set({ isSyncingMissingMessages: false });
      await get().getConversations(true);
    }
  },
  sendMessage: async (payload) => {
    // payload = { text: '...', image: File | dataURL | null }
    const { selectedUser } = get();
      const directUserId = getDirectUserId(selectedUser);
    const { authUser } = useAuthStore.getState();

    // Tạo optimistic message
    const clientMessageId = crypto.randomUUID();
    const tempId = `temp-${clientMessageId}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser.type === "group" ? undefined : directUserId,
      conversationId: selectedUser.type === "group" ? selectedUser._id : undefined,
      text: payload.text || "",
      image: payload.image || null,
      createdAt: new Date().toISOString(),
      clientMessageId,
      encryptionRevision: 0,
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
        getEncryptionContext(selectedUser),
        { messageId: clientMessageId, revision: 0 }
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
      get().applyConversationMessage(serverMessage);
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
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    get().unsubscribeMessage();
    const handler = async (newMessage) => {
      if (newMessage.senderId === useAuthStore.getState().authUser?._id) return;
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
      if (get().isSoundEnable) {
        notificationSound.currentTime = 0;
        notificationSound.play().catch((e) => console.log("Audio error", e));
      }
    };
    socket.on("newMessage", handler);
    set({ messageSocketHandler: handler });
  },
  unsubscribeMessage: () => {
    const socket = useAuthStore.getState().socket;
    const handler = get().messageSocketHandler;
    if (handler) socket?.off("newMessage", handler);
    set({ messageSocketHandler: null });
  },
}));
