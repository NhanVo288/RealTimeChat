import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore'
import { useAuthStore } from '../store/useAuthStore'
import ChatHeader from './ChatHeader'
import NoChatHolder from './NoChatHolder';

export default function ChatContainer() {
  const {selectedUser, getMessageByUser, messages} = useChatStore()
  const { authUser } = useAuthStore()

  useEffect(()=>{
    getMessageByUser(selectedUser._id)
  },[getMessageByUser,selectedUser])
  return (
    <>
      <ChatHeader />
      <div className='flex-1 px-6 overflow-y-auto py-8 '>
        {messages.length > 0 ? ( <p> hi</p>) : (
          <NoChatHolder name={selectedUser.fullName} />
        )}
      </div>
    </>
  )
}
