function UsersLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-slate-800/30 rounded-xl p-4 animate-pulse"
        >
          <div className="flex items-center space-x-4 w-full">
            <div className="w-10 h-10 bg-slate-700 rounded-full"></div>

            <div className="flex-1">
              <div className="h-4 bg-slate-700 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-slate-700/70 rounded w-1/3"></div>
            </div>
          </div>

          <div className="w-16 h-7 bg-slate-700 rounded-lg ml-4"></div>
        </div>
      ))}
    </div>
  );
}

export default UsersLoadingSkeleton;
