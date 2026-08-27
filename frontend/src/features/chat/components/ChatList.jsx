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
            <div className="min-w-0">
              <h4 className="text-slate-200 font-medium truncate">{title}</h4>
              {isGroup && <p className="text-xs text-slate-500">{chat.members?.length || 0} thành viên</p>}
            </div>
          </div>
        </div>
        );
      })}
    </>
  );
}
