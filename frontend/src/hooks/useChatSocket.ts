import { useEffect, useRef, useState, type FormEvent } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE } from '../lib/api'
import { sameCurrentRoom } from '../lib/helpers'
import type {
  ApiMessage,
  ApiUser,
  CurrentRoom,
  TypingUser,
} from '../lib/types'
import { TYPING_IDLE_MS } from '../lib/ui'
import { attachChatListeners } from './chatListeners'

export function useChatSocket({
  authUser,
  current,
  onUserUpdated,
}: {
  authUser: ApiUser | null
  current: CurrentRoom
  onUserUpdated?: (u: ApiUser) => void
}) {
  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [typingList, setTypingList] = useState<TypingUser[]>([])

  const socketRef = useRef<Socket | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const iAmTypingRef = useRef(false)
  const currentRef = useRef<CurrentRoom>(current)
  const previousRef = useRef<CurrentRoom>(current)
  const onUserUpdatedRef = useRef(onUserUpdated)

  useEffect(() => {
    onUserUpdatedRef.current = onUserUpdated
  }, [onUserUpdated])

  useEffect(() => {
    currentRef.current = current
  }, [current])

  function cleanupTyping() {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }

    iAmTypingRef.current = false
  }

  function emitJoin(socket: Socket, cur: CurrentRoom, userId: string) {
    if (cur.kind === 'general') {
      socket.emit('general:join', { userId })
    } else {
      socket.emit('room:join', { roomId: cur.roomId, userId })
    }
  }

  useEffect(() => {
    if (!authUser) {
      return
    }

    const socket = io(API_BASE, {
      transports: ['websocket'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      emitJoin(socket, currentRef.current, authUser.id)
    })

    socket.on('disconnect', () => {
      setTypingList([])
      cleanupTyping()
    })

    attachChatListeners(socket, () => currentRef.current, {
      setMessages,
      setTypingList,
      onUserUpdated: (u) => onUserUpdatedRef.current?.(u),
    })

    return () => {
      cleanupTyping()
      socket.disconnect()
      socketRef.current = null
    }
  }, [authUser?.id])

  useEffect(() => {
    const prev = previousRef.current

    if (sameCurrentRoom(prev, current)) {
      return
    }

    previousRef.current = current

    cleanupTyping()
    setMessages([])
    setTypingList([])
    setMessageInput('')

    const socket = socketRef.current

    if (!socket || !socket.connected || !authUser) {
      return
    }

    emitJoin(socket, current, authUser.id)
  }, [current, authUser?.id])

  function stopTypingNow() {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }

    if (!iAmTypingRef.current) {
      return
    }

    iAmTypingRef.current = false

    const socket = socketRef.current
    const cur = currentRef.current

    if (cur.kind === 'general') {
      socket?.emit('general:typing_stop')
    } else {
      socket?.emit('room:typing_stop', { roomId: cur.roomId })
    }
  }

  function handleMessageInput(value: string) {
    setMessageInput(value)

    const socket = socketRef.current

    if (!socket || !socket.connected) {
      return
    }

    if (value.trim() === '') {
      stopTypingNow()
      return
    }

    const cur = currentRef.current

    if (!iAmTypingRef.current) {
      iAmTypingRef.current = true

      if (cur.kind === 'general') {
        socket.emit('general:typing_start')
      } else {
        socket.emit('room:typing_start', { roomId: cur.roomId })
      }
    }

    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
    }

    typingTimerRef.current = window.setTimeout(() => {
      typingTimerRef.current = null
      stopTypingNow()
    }, TYPING_IDLE_MS)
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const socket = socketRef.current
    const content = messageInput.trim()

    if (!socket || !socket.connected || !authUser || !content) {
      return
    }

    const cur = currentRef.current

    if (cur.kind === 'general') {
      socket.emit('general:send', { content, userId: authUser.id })
    } else {
      socket.emit('room:send', { roomId: cur.roomId, content })
    }

    setMessageInput('')
    cleanupTyping()
  }

  function toggleReaction(message: ApiMessage, emoji: string) {
    const socket = socketRef.current

    if (!socket || !socket.connected || !authUser) {
      return
    }

    const mine = (message.reactions ?? []).some(
      (r) => r.userId === authUser.id && r.emoji === emoji,
    )

    const cur = currentRef.current

    if (cur.kind === 'general') {
      socket.emit(mine ? 'general:reaction_remove' : 'general:reaction_add', {
        messageId: message.id,
        emoji,
      })
    } else {
      socket.emit(mine ? 'room:reaction_remove' : 'room:reaction_add', {
        roomId: cur.roomId,
        messageId: message.id,
        emoji,
      })
    }
  }

  function resetChat() {
    cleanupTyping()
    setMessages([])
    setTypingList([])
    setMessageInput('')
  }

  return {
    messages,
    typingList,
    messageInput,
    handleMessageInput,
    sendMessage,
    toggleReaction,
    resetChat,
  }
}
