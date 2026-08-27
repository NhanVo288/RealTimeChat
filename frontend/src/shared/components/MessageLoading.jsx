export default function MessageSkeleton() {
  const bubbles = Array.from({ length: 5 });

  return (
    <div className="px-6 py-6 space-y-5">
      {bubbles.map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`h-10 w-40 rounded-2xl bg-slate-700/40 animate-pulse ${
              i % 2 !== 0 ? "rounded-tr-none" : "rounded-tl-none"
            }`}
          ></div>
        </div>
      ))}
    </div>
  );
}
