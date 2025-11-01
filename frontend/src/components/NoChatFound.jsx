import { MessageSquarePlus } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function NoChatsFound() {
  const { setActiveTabs } = useChatStore();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-10">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center">
          <MessageSquarePlus className="w-10 h-10 text-cyan-400" />
        </div>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full animate-ping opacity-75"></span>
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full"></span>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">No chats yet</h2>
        <p className="text-sm text-slate-400 px-8">
          Looks like you haven't started any conversation. Find someone to chat with!
        </p>
      </div>

      <button
        onClick={() => setActiveTabs("contacts")}
        className="
          px-5 py-2.5 text-sm font-medium rounded-lg
          text-white bg-cyan-500/80 
          hover:bg-cyan-500 transition-colors duration-200
          shadow-lg shadow-cyan-500/20
        "
      >
        Browse contacts
      </button>
    </div>
  );
}

export default NoChatsFound;
