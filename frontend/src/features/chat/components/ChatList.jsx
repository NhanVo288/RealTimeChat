import React, { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "../../../shared/components/UserLoading";
import NoChatsFound from "./NoChatFound";
import { useAuthStore } from "../../auth/store/useAuthStore";

export default function ChatList() {
  const { getConversations, conversations, isUserLoading, setSelectedUser } = useChatStore();
  const  { onlineUsers } = useAuthStore()

  useEffect(() => {
    getConversations();
  }, [getConversations]);
  if (isUserLoading) return <UsersLoadingSkeleton />;
  if (conversations.length === 0) return <NoChatsFound />;
  return (
    <>
      {conversations.map((chat) => {
        const isGroup = chat.type === "group";
        const directMember = chat.members?.find((member) => member._id !== useAuthStore.getState().authUser?._id);
        const title = isGroup ? `Nhóm: ${chat.name}` : directMember?.fullName || "Cuộc trò chuyện";
        const avatar = isGroup ? chat.avatar : directMember?.profilePic;
        const unreadCount = Number(chat.unreadCount || 0);
        return (
        <div
          key={chat._id}
          className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
          onClick={() => setSelectedUser(chat)}
        >
          <div className="flex items-center gap-3">
            <div className={`avatar ${!isGroup && onlineUsers.includes(directMember?._id) ? "online" : "offline"}`}>
              <div className="size-12 rounded-full">
                <img
                  src={avatar || "/avatar.png"}
                  alt={title}
                />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-slate-200 font-medium truncate">{title}</h4>
                {chat.lastMessageAt && (
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {new Date(chat.lastMessageAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-slate-500">
                  {unreadCount > 0
                    ? `${unreadCount} tin nhắn chưa đọc`
                    : isGroup ? `${chat.members?.length || 0} thành viên` : "Đã đọc"}
                </p>
                {unreadCount > 0 && (
                  <span className="min-w-5 rounded-full bg-cyan-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-950">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })}
    </>
  );
}
