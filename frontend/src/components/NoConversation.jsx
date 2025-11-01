import { MessageSquare } from "lucide-react";

const NoConversation = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
      {/* Icon Container */}
      <div className="relative">
        <div className="w-24 h-24 rounded-2xl bg-slate-800/60 backdrop-blur flex items-center justify-center shadow-lg border border-slate-700">
          <MessageSquare className="w-12 h-12 text-cyan-400 opacity-90" />
        </div>

        {/* Typing Bubble */}
        <div className="absolute -bottom-2 -right-2 flex items-center space-x-1 bg-cyan-500/20 px-3 py-1 rounded-full border border-cyan-500/30">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce delay-150" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce delay-300" />
        </div>
      </div>

      {/* Text Content */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1 tracking-wide">
          No conversation selected
        </h2>
        <p className="text-sm text-slate-400 max-w-[320px]">
          Pick a chat from your list or start a new conversation to begin messaging.
        </p>
      </div>
    </div>
  );
};

export default NoConversation;
