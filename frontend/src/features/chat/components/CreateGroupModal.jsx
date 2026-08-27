import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function CreateGroupModal({ onClose }) {
  const { allContacts, getAllContacts, createGroup } = useChatStore();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!allContacts.length) getAllContacts();
  }, [allContacts.length, getAllContacts]);

  const toggleMember = (userId) => {
    setSelectedIds((ids) => ids.includes(userId)
      ? ids.filter((id) => id !== userId)
      : [...ids, userId]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || selectedIds.length < 2) return;
    setIsSubmitting(true);
    const group = await createGroup(name, selectedIds);
    setIsSubmitting(false);
    if (group) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-cyan-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Tạo nhóm mới</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tên nhóm"
          maxLength={100}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
          required
        />
        <p className="mb-2 text-xs text-slate-400">Chọn ít nhất 2 người khác</p>
        <div className="mb-5 max-h-56 space-y-1 overflow-y-auto">
          {allContacts.map((contact) => (
            <label key={contact._id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-800">
              <input
                type="checkbox"
                checked={selectedIds.includes(contact._id)}
                onChange={() => toggleMember(contact._id)}
                className="checkbox checkbox-sm checkbox-info"
              />
              <img src={contact.profilePic || "/avatar.png"} alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="truncate text-sm text-slate-200">{contact.fullName}</span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim() || selectedIds.length < 2}
          className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {isSubmitting ? "Đang tạo..." : "Tạo nhóm"}
        </button>
      </form>
    </div>
  );
}

export default CreateGroupModal;
