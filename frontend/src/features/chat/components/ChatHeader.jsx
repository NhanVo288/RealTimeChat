import { ArrowLeft, Check, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../../auth/store/useAuthStore";

const ChatHeader = () => {
  const {
    selectedUser,
    setSelectedUser,
    deleteGroup,
    removeGroupMember,
    addGroupMember,
    allContacts,
    getAllContacts,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [isDeleteMenuOpen, setIsDeleteMenuOpen] = useState(false);
  const [isMembersMenuOpen, setIsMembersMenuOpen] = useState(false);
  const [isAddMemberMenuOpen, setIsAddMemberMenuOpen] = useState(false);
  const [pendingKickMemberId, setPendingKickMemberId] = useState(null);
  if (!selectedUser) return null;
  const isGroup = selectedUser.type === "group";
  const directMember = selectedUser.members?.find(
    (member) => member._id !== useAuthStore.getState().authUser?._id
  );
  const directUser = directMember || selectedUser;
  const title = isGroup ? `Nhóm: ${selectedUser.name}` : directUser.fullName;
  const avatar = isGroup ? selectedUser.avatar : directUser.profilePic;
  const isOnline = !isGroup && onlineUsers.includes(directUser._id);
  const isAdmin = isGroup && selectedUser.members?.some(
    (member) => member._id === authUser?._id && member.role === "admin"
  );
  const groupMembers = [...new Map(
    (selectedUser.members || []).map((member) => [member._id, member])
  ).values()];
  const existingMemberIds = new Set(groupMembers.map((member) => member._id));
  const availableContacts = allContacts.filter((contact) => !existingMemberIds.has(contact._id));

  const handleDeleteGroup = async () => {
    await deleteGroup(selectedUser._id);
  };

  const handleRemoveMember = async (memberId) => {
    const removed = await removeGroupMember(selectedUser._id, memberId);
    if (removed) setPendingKickMemberId(null);
  };

  const handleOpenAddMember = () => {
    setIsAddMemberMenuOpen((open) => !open);
    if (!allContacts.length) getAllContacts();
  };

  const handleAddMember = async (memberId) => {
    const added = await addGroupMember(selectedUser._id, memberId);
    if (added) setIsAddMemberMenuOpen(false);
  };

  return (
    <div className="relative z-30 w-full h-[72px] shrink-0 flex items-center justify-between px-5 bg-slate-900/60 border-b border-slate-800 backdrop-blur-lg">
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
            src={avatar || "/avatar.png"}
            className="w-12 h-12 rounded-full object-cover "
            alt={title}
          />
        </div>

        <div className="flex flex-col">
          <span className="text-white font-medium tracking-wide">
            {title}
          </span>

          {isGroup ? (
            <span className="text-xs text-slate-400">{groupMembers.length} thành viên</span>
          ) : isOnline ? (
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
      <div className="flex items-center gap-2">
        {isAdmin && (
          <div className="relative">
            <button
              onClick={handleOpenAddMember}
              title="Thêm thành viên"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/50 text-slate-300 transition hover:bg-slate-700"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            {isAddMemberMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
                <div className="mb-2 border-b border-slate-800 pb-2">
                  <span className="text-sm font-medium text-white">Thêm thành viên</span>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {availableContacts.length ? availableContacts.map((contact) => (
                    <div key={contact._id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-800">
                      <img
                        src={contact.profilePic || "/avatar.png"}
                        alt={contact.fullName}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{contact.fullName}</span>
                      <button
                        onClick={() => handleAddMember(contact._id)}
                        title="Thêm vào nhóm"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-cyan-300 transition hover:bg-cyan-500/15 hover:text-cyan-200"
                      >
                        <UserPlus size={15} />
                      </button>
                    </div>
                  )) : (
                    <p className="py-3 text-center text-xs text-slate-500">Tất cả contact đã ở trong nhóm</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {isGroup && (
          <div className="relative">
            <button
              onClick={() => setIsMembersMenuOpen((open) => !open)}
              title="Xem thành viên"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/50 text-slate-300 transition hover:bg-slate-700"
            >
              <Users className="w-4 h-4" />
            </button>
            {isMembersMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-sm font-medium text-white">Thành viên nhóm</span>
                  <span className="text-xs text-slate-500">{selectedUser.members?.length || 0}</span>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {selectedUser.members?.map((member) => (
                    <div key={member._id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-800">
                      <img
                        src={member.profilePic || "/avatar.png"}
                        alt={member.fullName}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-200">
                          {member.fullName}{member._id === authUser?._id ? " (Bạn)" : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {member.role === "admin" ? "Admin" : "Thành viên"}
                        </p>
                      </div>
                      {isAdmin && member.role !== "admin" && (
                        pendingKickMemberId === member._id ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => handleRemoveMember(member._id)}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setPendingKickMemberId(null)}
                              className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-700 hover:text-white"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingKickMemberId(member._id)}
                            title="Kick thành viên"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-300 transition hover:bg-red-500/15 hover:text-red-200"
                          >
                            <UserMinus size={15} />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setIsDeleteMenuOpen((open) => !open)}
              title="Xóa nhóm"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {isDeleteMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
                <p className="mb-3 text-xs leading-5 text-slate-300">
                  Xóa nhóm và toàn bộ tin nhắn?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsDeleteMenuOpen(false)}
                    className="rounded-md px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleDeleteGroup}
                    className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500"
                  >
                    <Check size={14} />
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => setSelectedUser(null)}
          className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
