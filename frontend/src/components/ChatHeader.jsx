import { ArrowLeft, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(selectedUser._id);
  if (!selectedUser) return null;

  return (
    <div className="w-full h-[72px] flex items-center justify-between px-5 bg-slate-900/60 border-b border-slate-800 backdrop-blur-lg">
      {/* Back button for mobile */}
      <button
        onClick={() => setSelectedUser(null)}
        className="lg:hidden p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-slate-300" />
      </button>

      {/* User info */}
      <div className="flex items-center gap-3">
        <div className="rounded-full">
          <img
            src={selectedUser.profilePic || "/avatar.png"}
            className="w-12 h-12 rounded-full object-cover "
            alt={selectedUser.fullName}
          />
        </div>

        <div className="flex flex-col">
          <span className="text-white font-medium tracking-wide">
            {selectedUser.fullName}
          </span>

          {isOnline ? (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"></span>{" "}
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce delay-150"></span>
              Online
            </span>
          ) : (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span className="relative flex">
                <span className="w-2 h-2 bg-slate-500 rounded-full" />
              </span>
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Close button desktop */}
      <button
        onClick={() => setSelectedUser(null)}
        className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-all"
      >
        <X className="w-5 h-5 text-slate-300" />
      </button>
    </div>
  );
};

export default ChatHeader;
