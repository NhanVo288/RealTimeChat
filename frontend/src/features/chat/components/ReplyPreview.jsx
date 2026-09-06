import { useAuthStore } from "../../auth/store/useAuthStore";

export default function ReplyPreview({ message }) {
  const authUser = useAuthStore((state) => state.authUser);
  const name = message.senderId === authUser?._id
    ? "Bạn"
    : message.sender?.fullName || "Người dùng";

  return (
    <div className="min-w-0 border-l-2 border-cyan-300 bg-black/10 px-3 py-2 rounded-r-lg text-sm">
      <p className="truncate font-semibold">{name}</p>
      <p className="line-clamp-2 break-words opacity-80">
        {message.deletedAt ? "Tin nhắn đã thu hồi" : message.text || (message.image || message.type === "image" ? "Hình ảnh" : "Tin nhắn")}
      </p>
    </div>
  );
}
