import { useChatStore } from "../store/useChatStore";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatList from "../components/ChatList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversation from "../components/NoConversation";
import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import CreateGroupModal from "../components/CreateGroupModal";
import { useAuthStore } from "../../auth/store/useAuthStore";

function ChatPage() {
  const { activeTab, selectedUser, setSelectedUser, subscribeToConversationEvents, unsubscribeFromConversationEvents, syncMissingMessages, getConversations } = useChatStore();
  const { authUser, socket, socketConnectionVersion } = useAuthStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  useEffect(() => {
    if (!authUser) return undefined;
    subscribeToConversationEvents();
    return unsubscribeFromConversationEvents;
  }, [authUser, subscribeToConversationEvents, unsubscribeFromConversationEvents]);

  useEffect(() => {
    if (!authUser || socketConnectionVersion === 0) return;
    void syncMissingMessages();
  }, [authUser, socketConnectionVersion, syncMissingMessages]);

  useEffect(() => {
    if (!socket) return undefined;
    let refreshTimer = null;
    const refreshConversationList = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void getConversations(true); }, 100);
    };
    socket.on("newMessage", refreshConversationList);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.off("newMessage", refreshConversationList);
    };
  }, [socket, getConversations]);

  return (
    <div className="relative w-full max-w-6xl h-screen md:h-[800px]">
      <BorderAnimatedContainer>
        <div className="flex h-full w-full">
          
          <div className={`${selectedUser ? "hidden" : "flex"} md:flex w-full md:w-80 bg-slate-800/50 backdrop-blur-sm flex-col border-r border-slate-700/50`}>
            <ProfileHeader />
            <ActiveTabSwitch />
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/10"
            >
              <UsersRound size={16} />
              Tạo nhóm
            </button>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeTab === "chats" ? <ChatList /> : <ContactList />}
            </div>
          </div>

          <div className={`${!selectedUser ? "hidden" : "flex"} md:flex flex-1 flex-col bg-slate-900/50 backdrop-blur-sm relative`}>
            {selectedUser ? (
              <>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-4 left-4 z-50 md:hidden p-2 bg-slate-700 rounded-full text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <ChatContainer />
              </>
            ) : (
              <NoConversation />
            )}
          </div>
          
        </div>
      </BorderAnimatedContainer>
      {isGroupModalOpen && <CreateGroupModal onClose={() => setIsGroupModalOpen(false)} />}
    </div>
  );
}

export default ChatPage;
