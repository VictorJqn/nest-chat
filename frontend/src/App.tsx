import { useEffect, useState } from 'react'
import { AddMemberForm } from './components/AddMemberForm'
import { AuthScreen } from './components/AuthScreen'
import { ChatPanel } from './components/ChatPanel'
import { CreateRoomModal } from './components/CreateRoomModal'
import { ProfileCard } from './components/ProfileCard'
import { RoomsList } from './components/RoomsList'
import { useChatSocket } from './hooks/useChatSocket'
import { fetchRooms, fetchUsers } from './lib/api'
import type { ApiRoom, ApiUser, CurrentRoom } from './lib/types'
import { smallCls } from './lib/ui'

function App() {
  const [authUser, setAuthUser] = useState<ApiUser | null>(null)
  const [authError, setAuthError] = useState('')

  const [rooms, setRooms] = useState<ApiRoom[]>([])
  const [allUsers, setAllUsers] = useState<ApiUser[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [current, setCurrent] = useState<CurrentRoom>({ kind: 'general' })

  const chat = useChatSocket({
    authUser,
    current,
    onUserUpdated: (u) => {
      setAllUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))
    },
  })

  useEffect(() => {
    if (!authUser) {
      return
    }

    fetchRooms(authUser.id).then(setRooms).catch(() => {})
    fetchUsers().then(setAllUsers).catch(() => {})
  }, [authUser?.id])

  function onLogout() {
    chat.resetChat()
    setAuthUser(null)
    setRooms([])
    setCurrent({ kind: 'general' })
  }

  function onRoomCreated(room: ApiRoom) {
    setRooms((prev) => [room, ...prev.filter((r) => r.id !== room.id)])
    setShowCreate(false)
    setCurrent({ kind: 'room', roomId: room.id })
  }

  function onRoomUpdated(room: ApiRoom) {
    setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)))
  }

  if (!authUser) {
    return (
      <AuthScreen
        onAuthed={(u) => {
          setAuthError('')
          setAuthUser(u)
        }}
        error={authError}
        setError={setAuthError}
      />
    )
  }

  const currentRoom =
    current.kind === 'room' ? rooms.find((r) => r.id === current.roomId) : null

  const title =
    current.kind === 'general'
      ? 'Chat général'
      : currentRoom
        ? `# ${currentRoom.name}`
        : 'Salon'

  const membersBar =
    current.kind === 'room' && currentRoom ? (
      <div className="rounded-md bg-slate-100 p-2 text-sm">
        <p className={smallCls}>
          Membres ({currentRoom.members.length}) :{' '}
          {currentRoom.members.map((m) => m.user.name || m.user.email).join(', ')}
        </p>
        <AddMemberForm
          room={currentRoom}
          authUser={authUser}
          onUpdated={onRoomUpdated}
          allUsers={allUsers}
        />
      </div>
    ) : null

  return (
    <main className="mx-auto box-border grid min-h-dvh w-full max-w-[1200px] gap-4 px-5 pt-8 pb-10 md:grid-cols-[320px_1fr]">
      <div className="grid gap-4 self-start">
        <ProfileCard user={authUser} onSaved={setAuthUser} onLogout={onLogout} />
        <RoomsList
          rooms={rooms}
          current={current}
          onSelect={setCurrent}
          onOpenCreate={() => setShowCreate(true)}
        />
      </div>

      <ChatPanel
        authUser={authUser}
        title={title}
        messages={chat.messages}
        typingList={chat.typingList}
        messageInput={chat.messageInput}
        onMessageInput={chat.handleMessageInput}
        onSend={chat.sendMessage}
        onToggleReaction={chat.toggleReaction}
        extra={membersBar}
      />

      {showCreate && (
        <CreateRoomModal
          authUser={authUser}
          onClose={() => setShowCreate(false)}
          onCreated={onRoomCreated}
        />
      )}
    </main>
  )
}

export default App
