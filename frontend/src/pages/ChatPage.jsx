import { useChatStore } from "../store/useChatStore";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatList from "../components/ChatList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversation from "../components/NoConversation";

function ChatPage() {
  const { activeTab, selectedUser, setSelectedUser } = useChatStore();

  return (
    <div className="relative w-full max-w-6xl h-screen md:h-[800px]">
      <BorderAnimatedContainer>
        <div className="flex h-full w-full">
          
          <div className={`${selectedUser ? "hidden" : "flex"} md:flex w-full md:w-80 bg-slate-800/50 backdrop-blur-sm flex-col border-r border-slate-700/50`}>
            <ProfileHeader />
            <ActiveTabSwitch />
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
    </div>
  );
}

export default ChatPage;