import React, { useEffect, useRef } from "react";
import { useState } from "react";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
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
    editMessage,
    deleteMessage,
    markConversationRead,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messagesContainer = useRef(null);
  const shouldScrollToLatest = useRef(false);
  const previousLatestMessageId = useRef(null);
  const isNearBottom = useRef(true);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  useEffect(() => {
    if (!selectedUser) return;

    shouldScrollToLatest.current = true;
    previousLatestMessageId.current = null;
    getMessagesBySelection(selectedUser);
    subscribeToMessage();

    return () => unsubscribeMessage();
  }, [selectedUser, getMessagesBySelection, subscribeToMessage, unsubscribeMessage]);

  useEffect(() => {
    if (isMessagesLoading || isLoadingOlderMessages || !messagesContainer.current) return;

    const latestMessageId = messages.at(-1)?._id || null;
    const latestMessageChanged = latestMessageId !== previousLatestMessageId.current;
    if (shouldScrollToLatest.current || (latestMessageChanged && isNearBottom.current)) {
      requestAnimationFrame(() => {
        if (messagesContainer.current) {
          messagesContainer.current.scrollTop = messagesContainer.current.scrollHeight;
          isNearBottom.current = true;
        }
      });
      shouldScrollToLatest.current = false;
    }
    previousLatestMessageId.current = latestMessageId;
  }, [messages, isMessagesLoading, isLoadingOlderMessages]);

  useEffect(() => {
    if (!selectedUser || isMessagesLoading || isLoadingOlderMessages) return undefined;
    const container = messagesContainer.current;
    if (!container) return undefined;

    const markLatestVisibleMessage = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom > 80) return;
      const latestMessage = [...messages].reverse().find(
        (message) => message._id && !message.isOptimistic &&
          !String(message._id).startsWith("temp-")
      );
      if (!latestMessage?.conversationId) return;
      void markConversationRead(latestMessage.conversationId, latestMessage._id);
    };

    const frame = requestAnimationFrame(markLatestVisibleMessage);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") markLatestVisibleMessage();
    };
    container.addEventListener("scroll", markLatestVisibleMessage, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", markLatestVisibleMessage);
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("scroll", markLatestVisibleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", markLatestVisibleMessage);
    };
  }, [
    messages,
    selectedUser,
    isMessagesLoading,
    isLoadingOlderMessages,
    markConversationRead,
  ]);

  const handleMessagesScroll = async () => {
    const container = messagesContainer.current;
    if (container) {
      isNearBottom.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <= 80;
    }
    if (!container || container.scrollTop > 80 || !hasMoreMessages || isLoadingOlderMessages) return;

    const previousHeight = container.scrollHeight;
    await loadOlderMessages();
    requestAnimationFrame(() => {
      container.scrollTop += container.scrollHeight - previousHeight;
    });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingText.trim()) return;
    const updated = await editMessage(editingMessageId, editingText.trim());
    if (updated) {
      setEditingMessageId(null);
      setEditingText("");
    }
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
            {messages.map((msg, messageIndex) => {
              const previousMessage = messages[messageIndex - 1];
              const isOwnMessage = msg.senderId === authUser._id;
              const showSender = !isOwnMessage &&
                previousMessage?.senderId !== msg.senderId;
              return (
                <div
                  key={msg._id}
                  className={`flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  {!isOwnMessage && (
                    <div className="mr-2 flex w-8 shrink-0 items-end">
                      {showSender && msg.sender && (
                        <img
                          src={msg.sender.profilePic || "/avatar.png"}
                          alt={msg.sender.fullName}
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-700"
                        />
                      )}
                    </div>
                  )}
                  <div className={`group flex max-w-[78%] flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
                    {showSender && msg.sender && (
                      <span className="mb-1 ml-1 text-[11px] font-medium text-slate-400">
                        {msg.sender.fullName}
                      </span>
                    )}
                    <div
                      className={`relative rounded-2xl px-3.5 py-2 shadow-sm ${
                        isOwnMessage
                          ? "rounded-br-md bg-cyan-600 text-white"
                          : "rounded-bl-md border border-slate-700/70 bg-slate-800/90 text-slate-200"
                      }`}
                    >
                    {editingMessageId === msg._id ? (
                      <form onSubmit={handleEditSubmit} className="flex min-w-56 items-center gap-2">
                        <input
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          autoFocus
                          className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-sm text-white outline-none"
                        />
                        <button type="submit" title="Lưu" className="text-white hover:text-cyan-200"><Check size={15} /></button>
                        <button
                          type="button"
                          title="Hủy"
                          onClick={() => setEditingMessageId(null)}
                          className="text-white hover:text-red-200"
                        >
                          <X size={15} />
                        </button>
                      </form>
                    ) : msg.deletedAt ? (
                      <p className="italic opacity-60">Tin nhắn đã thu hồi</p>
                    ) : (
                      <>
                    {msg.image && (
                      <img
                        src={msg.image}
                        className="mb-1 h-48 max-w-full rounded-xl object-cover"
                      />
                    )}
                    {msg.text && <p className="mt-2">{msg.text}</p>}
                    <p className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
                      {new Date(msg.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                      </>
                    )}
                    </div>
                    {isOwnMessage && !msg.deletedAt && editingMessageId !== msg._id && (
                      <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          title="Sửa tin nhắn"
                          onClick={() => {
                            setEditingMessageId(msg._id);
                            setEditingText(msg.text || "");
                          }}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-cyan-300"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          title="Thu hồi tin nhắn"
                          onClick={() => deleteMessage(msg._id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-300"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    )}
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
