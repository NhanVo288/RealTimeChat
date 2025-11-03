import React, { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import ChatHeader from "./ChatHeader";
import NoChatHolder from "./NoChatHolder";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./MessageLoading";

export default function ChatContainer() {
  const {
    selectedUser,
    getMessageByUser,
    messages,
    isMessagesLoading,
    subscribeToMessage,
    unsubscribeMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndScroll = useRef(null);
  useEffect(() => {
    if (!selectedUser) return;

    getMessageByUser(selectedUser._id);
    subscribeToMessage();

    return () => unsubscribeMessage();
  }, [selectedUser, getMessageByUser, subscribeToMessage, unsubscribeMessage]);

  useEffect(() => {
    if (messageEndScroll.current) {
      messageEndScroll.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <>
      <ChatHeader />
      <div className="flex-1 px-6 overflow-y-auto py-8 ">
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
          <NoChatHolder name={selectedUser.fullName} />
        )}
      </div>
      <MessageInput />
    </>
  );
}
