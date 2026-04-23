import { startTransition, type Dispatch, type SetStateAction } from 'react'
import type { Socket } from 'socket.io-client'
import type {
  ApiMessage,
  ApiReaction,
  ApiUser,
  CurrentRoom,
  TypingUser,
} from '../lib/types'

type Setters = {
  setMessages: Dispatch<SetStateAction<ApiMessage[]>>
  setTypingList: Dispatch<SetStateAction<TypingUser[]>>
  onUserUpdated?: (u: ApiUser) => void
}

export function attachChatListeners(
  socket: Socket,
  getCurrent: () => CurrentRoom,
  setters: Setters,
) {
  const { setMessages, setTypingList, onUserUpdated } = setters

  socket.on('general:init', (items: ApiMessage[]) => {
    if (getCurrent().kind !== 'general') return

    startTransition(() => setMessages(items))
  })

  socket.on('general:new_message', (message: ApiMessage) => {
    if (getCurrent().kind !== 'general') return

    startTransition(() => setMessages((prev) => [...prev, message]))
  })

  socket.on('general:user_left', (payload: { userId?: string }) => {
    if (getCurrent().kind !== 'general') return

    if (payload.userId) {
      setTypingList((prev) => prev.filter((x) => x.id !== payload.userId))
    }
  })

  socket.on(
    'general:typing_start',
    (payload: { userId: string; name: string }) => {
      if (getCurrent().kind !== 'general') return

      setTypingList((prev) => {
        if (prev.some((x) => x.id === payload.userId)) return prev
        return [...prev, { id: payload.userId, name: payload.name }]
      })
    },
  )

  socket.on('general:typing_stop', (payload: { userId: string }) => {
    if (getCurrent().kind !== 'general') return
    setTypingList((prev) => prev.filter((x) => x.id !== payload.userId))
  })

  socket.on(
    'general:reaction_added',
    (payload: { messageId: string; reaction: ApiReaction }) => {
      if (getCurrent().kind !== 'general') return
      appendReaction(setMessages, payload.messageId, payload.reaction)
    },
  )

  socket.on(
    'general:reaction_removed',
    (payload: { messageId: string; userId: string; emoji: string }) => {
      if (getCurrent().kind !== 'general') return
      removeReaction(setMessages, payload.messageId, payload.userId, payload.emoji)
    },
  )

  socket.on('room:init', (payload: { roomId: string; messages: ApiMessage[] }) => {
    const cur = getCurrent()
    if (cur.kind !== 'room' || cur.roomId !== payload.roomId) return

    startTransition(() => setMessages(payload.messages))
  })

  socket.on(
    'room:new_message',
    (payload: { roomId: string; message: ApiMessage }) => {
      const cur = getCurrent()
      if (cur.kind !== 'room' || cur.roomId !== payload.roomId) return

      startTransition(() => setMessages((prev) => [...prev, payload.message]))
    },
  )

  socket.on(
    'room:typing_start',
    (payload: { roomId: string; userId: string; name: string }) => {
      const cur = getCurrent()
      if (cur.kind !== 'room' || cur.roomId !== payload.roomId) return

      setTypingList((prev) => {
        if (prev.some((x) => x.id === payload.userId)) return prev
        return [...prev, { id: payload.userId, name: payload.name }]
      })
    },
  )

  socket.on(
    'room:typing_stop',
    (payload: { roomId: string; userId: string }) => {
      const cur = getCurrent()
      if (cur.kind !== 'room' || cur.roomId !== payload.roomId) return
      setTypingList((prev) => prev.filter((x) => x.id !== payload.userId))
    },
  )

  socket.on(
    'room:reaction_added',
    (payload: { roomId: string; messageId: string; reaction: ApiReaction }) => {
      const cur = getCurrent()
      if (cur.kind !== 'room' || cur.roomId !== payload.roomId) return
      appendReaction(setMessages, payload.messageId, payload.reaction)
    },
  )

  socket.on(
    'room:reaction_removed',
    (payload: {
      roomId: string
      messageId: string
      userId: string
      emoji: string
    }) => {
      const cur = getCurrent()
      if (cur.kind !== 'room' || cur.roomId !== payload.roomId) return
      removeReaction(setMessages, payload.messageId, payload.userId, payload.emoji)
    },
  )

  socket.on('user:updated', (u: ApiUser) => {
    setMessages((prev) =>
      prev.map((m) => (m.user.id === u.id ? { ...m, user: u } : m)),
    )
    onUserUpdated?.(u)
  })
}

function appendReaction(
  setMessages: Dispatch<SetStateAction<ApiMessage[]>>,
  messageId: string,
  reaction: ApiReaction,
) {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== messageId) return m

      const already = (m.reactions ?? []).some((r) => r.id === reaction.id)
      if (already) return m

      return { ...m, reactions: [...(m.reactions ?? []), reaction] }
    }),
  )
}

function removeReaction(
  setMessages: Dispatch<SetStateAction<ApiMessage[]>>,
  messageId: string,
  userId: string,
  emoji: string,
) {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== messageId) return m

      return {
        ...m,
        reactions: (m.reactions ?? []).filter(
          (r) => !(r.userId === userId && r.emoji === emoji),
        ),
      }
    }),
  )
}
