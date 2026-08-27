function BorderAnimatedContainer({ children }) {
  return (
    <div
      className="
        w-full h-full 
        rounded-2xl border border-transparent overflow-hidden
        flex 
        animate-[border_4s_linear_infinite]
        [background:linear-gradient(45deg,#172033,#172033)_padding-box,conic-gradient(from_var(--border-angle),rgba(100,116,139,0.48)_80%,_#06b6d4_86%,_#67e8f9_90%,_#06b6d4_94%,_rgba(100,116,139,0.48))_border-box]
      "
    >
      {children}
    </div>
  );
}
export default BorderAnimatedContainer;
