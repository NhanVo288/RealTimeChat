import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore'
import UsersLoadingSkeleton from './UserLoading'
import NoChatsFound from './NoChatFound';

export default function ChatList() {
  const { getChatPartner, chats, isUserLoading, selectedUser } = useChatStore()

  useEffect(() => {
    getChatPartner()
  },[getChatPartner])
  if (isUserLoading) return <UsersLoadingSkeleton />
  if(chats.length === 0) return <NoChatsFound />
  
}
