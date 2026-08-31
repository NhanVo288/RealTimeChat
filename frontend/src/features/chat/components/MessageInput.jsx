import React, { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../auth/store/useAuthStore";

function MessageInput() {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInput = useRef(null);
  const { sendMessage } = useChatStore();
  const { isE2EEReady, e2eeError } = useAuthStore();

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    sendMessage({
      text: text.trim(),
      image: imagePreview,
    });
    setText("");
    setImagePreview("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui long chon hinh anh");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh tối đa 5 MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };
  const removeImage = () => {
    setImagePreview(null);
    if (fileInput.current) fileInput.current.value = "";
  };
  return (
    <div className="p-4 border-t border-slate-700/50">
      {!isE2EEReady && (
        <p className="mb-2 text-center text-xs text-red-300">
          E2EE chưa sẵn sàng: {e2eeError || "đang khởi tạo khóa thiết bị"}
        </p>
      )}
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-4 flex items-center justify-start px-2">
          <div className="relative group">
            <div className="p-[2px] rounded-xl bg-gradient-to-r from-cyan-500/40 to-transparent">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-24 h-24 object-cover rounded-xl shadow-lg border border-slate-700/50"
              />
            </div>

            {/* Close button */}
            <button
              onClick={removeImage}
              type="button"
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex items-center gap-3  shadow-lg"
      >
        {/* Image Upload Btn */}
        <label className="cursor-pointer text-slate-400 hover:text-cyan-400 transition">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImage}
          />
          <ImageIcon />
        </label>

        {/* Input */}
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder="Nhap tin nhan..."
          className="flex-1 bg-slate-900/50 border border-slate-700/70 rounded-lg py-2.5 px-4 text-slate-200 placeholder-slate-500
      focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/50 transition"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!isE2EEReady || (!text.trim() && !imagePreview)}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500
      text-white px-4 py-2 rounded-lg transition font-medium shadow"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
