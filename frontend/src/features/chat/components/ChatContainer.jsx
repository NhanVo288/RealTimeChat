import React, { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../../auth/store/useAuthStore";
import ChatHeader from "./ChatHeader";
import NoChatHolder from "./NoChatHolder";
import MessageInput from "./MessageInput";
import MessageSkeleton from "../../../shared/components/MessageLoading";

export default function ChatContainer() {
  const {
    selectedUser,
    getMessagesBySelection,
    messages,
    isMessagesLoading,
    isLoadingOlderMessages,
    hasMoreMessages,
    loadOlderMessages,
    subscribeToMessage,
    unsubscribeMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndScroll = useRef(null);
  const messagesContainer = useRef(null);
  useEffect(() => {
    if (!selectedUser) return;

    getMessagesBySelection(selectedUser);
    subscribeToMessage();

    return () => unsubscribeMessage();
  }, [selectedUser, getMessagesBySelection, subscribeToMessage, unsubscribeMessage]);

  useEffect(() => {
    if (messageEndScroll.current) {
      messageEndScroll.current.scrollIntoView({ behavior: "auto" });
    }
  }, [selectedUser]);

  const handleMessagesScroll = async () => {
    const container = messagesContainer.current;
    if (!container || container.scrollTop > 80 || !hasMoreMessages || isLoadingOlderMessages) return;

    const previousHeight = container.scrollHeight;
    await loadOlderMessages();
    requestAnimationFrame(() => {
      container.scrollTop += container.scrollHeight - previousHeight;
    });
  };

  return (
    <>
      <ChatHeader />
      <div
        ref={messagesContainer}
        onScroll={handleMessagesScroll}
        className="relative z-0 flex-1 overflow-y-auto px-6 py-8"
      >
        {isLoadingOlderMessages && (
          <p className="mb-4 text-center text-xs text-slate-500">Đang tải tin cũ...</p>
        )}
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              return (
                <div
                  ref={messageEndScroll}
                  key={msg._id}
                  className={`chat ${
                    msg.senderId === authUser._id ? "chat-end" : "chat-start"
                  }`}
                >
                  <div
                    className={`chat-bubble relative ${
                      msg.senderId === authUser._id
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {msg.image && (
                      <img
                        src={msg.image}
                        className="rounded-lg h-48 object-cover"
                      />
                    )}
                    {msg.text && <p className="mt-2">{msg.text}</p>}
                    <p className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                      {new Date(msg.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : isMessagesLoading ? (
          <MessageSkeleton />
        ) : (
          <NoChatHolder name={selectedUser.type === "group" ? selectedUser.name : selectedUser.fullName} />
        )}
      </div>
      <MessageInput />
    </>
  );
}
