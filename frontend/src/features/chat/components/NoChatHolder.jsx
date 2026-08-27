import { Sparkles, Send } from "lucide-react";

const NoChatHolder = ({ name }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center text-center px-6">
      {/* Icon section */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center shadow-xl backdrop-blur-lg">
          <Sparkles className="w-10 h-10 text-cyan-400" />
        </div>

        {/* Glow pulse */}
        <span className="absolute inset-0 rounded-2xl bg-cyan-400/10 blur-xl animate-pulse"></span>
      </div>

      {/* Header */}
      <h2 className="text-xl font-semibold text-white mb-2 tracking-wide">
        Be the first to say hi 👋
      </h2>

      <p className="text-slate-400 max-w-sm mb-6 text-sm">
        You haven’t chatted with <span className="text-cyan-400 font-medium">{name}</span> yet.
        Break the ice and start the conversation!
      </p>

      {/* Quote */}
      <div className="max-w-xs bg-slate-800/40 border border-slate-700 px-4 py-3 rounded-xl text-sm text-slate-300 italic mb-5">
        "Every conversation begins with a single message."
      </div>

      {/* Suggested quick messages */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {[
          "Hello!",
          "Long time no see 👀",
          "How's everything going?",
          "Got a minute to chat?",
        ].map((text, i) => (
          <button
            key={i}
            className="text-xs bg-slate-800 border border-slate-700 hover:border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded-lg font-mono transition-all"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Subtle hint */}
      <div className="flex items-center text-xs text-slate-500 gap-1">
        <Send className="w-3 h-3" />
        Press <span className="text-slate-300 font-semibold">Enter</span> to send
      </div>
    </div>
  );
};

export default NoChatHolder;
