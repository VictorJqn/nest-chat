import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react'
import { io, type Socket } from 'socket.io-client'

type ApiUser = {
  id: string
  email: string
  name: string | null
  color: string
  createdAt: string
  updatedAt: string
}

type ApiReaction = {
  id: string
  messageId: string
  userId: string
  emoji: string
  createdAt: string
  user?: ApiUser
}

type ApiMessage = {
  id: string
  content: string
  createdAt: string
  userId: string
  user: ApiUser
  reactions?: ApiReaction[]
}

type LoginResponse = {
  token: string
  user: ApiUser
}

type TypingUser = {
  id: string
  name: string
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TYPING_IDLE_MS = 1800
const EMOJI_CHOICES = ['👍', '❤️', '😂', '🎉', '😮', '😢']

const cardCls =
  'rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md'
const inputCls =
  'w-full rounded-[10px] border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus-visible:outline-2 focus-visible:outline-sky-500'
const btnCls =
  'cursor-pointer rounded-[10px] border border-transparent bg-teal-800 px-3 py-2.5 text-teal-50 transition hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60'
const h2Cls = 'mb-3 text-[1.06rem] font-semibold'
const smallCls = 'text-[0.86rem] text-slate-500'

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const raw = await response.text()
  const json = raw ? (JSON.parse(raw) as unknown) : null

  if (!response.ok) {
    if (
      json &&
      typeof json === 'object' &&
      'message' in json &&
      typeof json.message === 'string'
    ) {
      throw new Error(json.message)
    }

    throw new Error(`Erreur API ${response.status}`)
  }

  return json as T
}

function formatTypingText(list: TypingUser[], myId: string | undefined) {
  const others = myId ? list.filter((x) => x.id !== myId) : list

  if (others.length === 0) {
    return ''
  }

  if (others.length === 1) {
    return `${others[0].name} est en train d'écrire…`
  }

  if (others.length === 2) {
    return `${others[0].name} et ${others[1].name} sont en train d'écrire…`
  }

  const firstTwo = `${others[0].name}, ${others[1].name}`
  const restCount = others.length - 2

  return `${firstTwo} et ${restCount} autre${restCount > 1 ? 's' : ''} sont en train d'écrire…`
}

function groupReactions(reactions: ApiReaction[] | undefined) {
  const map = new Map<string, ApiReaction[]>()

  for (const r of reactions ?? []) {
    const arr = map.get(r.emoji)

    if (arr) {
      arr.push(r)
    } else {
      map.set(r.emoji, [r])
    }
  }

  return [...map.entries()].map(([emoji, list]) => ({ emoji, list }))
}

function reactionLabel(list: ApiReaction[]) {
  return list.map((r) => r.user?.name || r.user?.email || 'utilisateur').join(', ')
}

function AuthScreen({
  onAuthed,
  error,
  setError,
}: {
  onAuthed: (user: ApiUser, token?: string) => void
  error: string
  setError: (msg: string) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        const user = await apiRequest<ApiUser>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            name: name || undefined,
            password,
          }),
        })
        onAuthed(user)
      } else {
        const result = await apiRequest<LoginResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        onAuthed(result.user, result.token)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <article className={`${cardCls} w-full max-w-md`}>
        <h2 className={h2Cls}>{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>

        <form className="grid gap-2" onSubmit={onSubmit}>
          <input
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            type="email"
            required
          />

          {mode === 'register' && (
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="nom (optionnel)"
            />
          )}

          <input
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mot de passe"
            type="password"
            minLength={mode === 'register' ? 6 : undefined}
            required
          />

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button className={btnCls} type="submit" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <p className="mt-3 text-center text-sm text-slate-500">
          {mode === 'login' ? 'Pas de compte ?' : 'Déjà un compte ?'}{' '}
          <button
            type="button"
            className="cursor-pointer text-teal-800 underline"
            onClick={() => {
              setError('')
              setMode(mode === 'login' ? 'register' : 'login')
            }}
          >
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </article>
    </div>
  )
}

function ProfileCard({
  user,
  onSaved,
  onLogout,
}: {
  user: ApiUser
  onSaved: (u: ApiUser) => void
  onLogout: () => void
}) {
  const [profileName, setProfileName] = useState(user.name ?? '')
  const [profileColor, setProfileColor] = useState(user.color)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setProfileName(user.name ?? '')
    setProfileColor(user.color)
  }, [user.id, user.name, user.color])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const u = await apiRequest<ApiUser>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName.trim() === '' ? null : profileName,
          color: profileColor,
        }),
      })
      onSaved(u)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={cardCls}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={h2Cls + ' mb-0'}>Mon profil</h2>
        <button
          type="button"
          onClick={onLogout}
          className="cursor-pointer text-sm text-slate-500 underline hover:text-slate-700"
        >
          déconnexion
        </button>
      </div>

      <p className={`${smallCls} mb-3`}>{user.email}</p>

      <form className="grid gap-3" onSubmit={onSubmit}>
        <label className="grid gap-1.5">
          <span className={smallCls}>Nom affiché</span>
          <input
            className={inputCls}
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="ton nom affiché"
            maxLength={40}
          />
        </label>

        <label className="flex flex-wrap items-center gap-2.5">
          <span className={smallCls}>Couleur</span>
          <input
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-slate-50 p-0.5"
            value={profileColor}
            onChange={(e) => setProfileColor(e.target.value)}
          />
          <span
            className="h-[22px] w-[22px] rounded-full border border-slate-300"
            style={{ background: profileColor }}
          />
          <code className={`${smallCls} font-mono`}>{profileColor}</code>
        </label>

        <p className={smallCls}>
          Aperçu:{' '}
          <strong style={{ color: profileColor }}>
            {profileName.trim() || user.email}
          </strong>
        </p>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button className={btnCls} type="submit" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </article>
  )
}

function ChatPanel({
  authUser,
  messages,
  typingList,
  messageInput,
  onMessageInput,
  onSend,
  onToggleReaction,
}: {
  authUser: ApiUser
  messages: ApiMessage[]
  typingList: TypingUser[]
  messageInput: string
  onMessageInput: (v: string) => void
  onSend: (e: FormEvent<HTMLFormElement>) => void
  onToggleReaction: (m: ApiMessage, emoji: string) => void
}) {
  const myId = authUser.id

  return (
    <article className={`${cardCls} flex h-full flex-col`}>
      <h2 className={h2Cls}>Chat général</h2>

      <ul className="m-0 grid flex-1 list-none gap-2 overflow-auto p-0">
        {messages.map((message) => {
          const groups = groupReactions(message.reactions)

          return (
            <li
              key={message.id}
              className="group rounded-[10px] border border-slate-300 bg-slate-50 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <strong style={{ color: message.user.color || '#4f8cff' }}>
                    {message.user.name || message.user.email}
                  </strong>
                  <small className="ml-1 text-slate-500">
                    {new Date(message.createdAt).toLocaleTimeString('fr-FR')}
                  </small>
                </div>

                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  {EMOJI_CHOICES.map((emj) => (
                    <button
                      key={emj}
                      type="button"
                      className="cursor-pointer rounded-md border border-transparent bg-white px-1.5 py-0.5 text-sm hover:border-slate-300"
                      onClick={() => onToggleReaction(message, emj)}
                      title={`Réagir avec ${emj}`}
                    >
                      {emj}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-1">{message.content}</p>

              {groups.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {groups.map((g) => {
                    const iReacted = g.list.some((r) => r.userId === myId)

                    return (
                      <div key={g.emoji} className="relative group/pill">
                        <button
                          type="button"
                          onClick={() => onToggleReaction(message, g.emoji)}
                          className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                            iReacted
                              ? 'border-sky-500 bg-sky-100 text-sky-900'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{g.emoji}</span>
                          <span>{g.list.length}</span>
                        </button>

                        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover/pill:block">
                          {reactionLabel(g.list)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}

        {messages.length === 0 && (
          <li className={smallCls}>Aucun message pour le moment.</li>
        )}
      </ul>

      <p className={`${smallCls} -mt-1 mb-2 min-h-[1.2em] italic`}>
        {formatTypingText(typingList, authUser.id)}
      </p>

      <form
        className="flex items-center gap-2 max-md:flex-wrap"
        onSubmit={onSend}
      >
        <input
          className={inputCls}
          value={messageInput}
          onChange={(e) => onMessageInput(e.target.value)}
          placeholder="Écris ton message..."
        />
        <button className={btnCls} type="submit">
          Envoyer
        </button>
      </form>
    </article>
  )
}

function App() {
  const [authUser, setAuthUser] = useState<ApiUser | null>(null)
  const [authError, setAuthError] = useState('')

  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [typingList, setTypingList] = useState<TypingUser[]>([])

  const socketRef = useRef<Socket | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const iAmTypingRef = useRef(false)

  function cleanupTyping() {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }

    iAmTypingRef.current = false
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
      socket.emit('general:join', { userId: authUser.id })
    })

    socket.on('disconnect', () => {
      setTypingList([])
      cleanupTyping()
    })

    socket.on('general:init', (items: ApiMessage[]) => {
      startTransition(() => {
        setMessages(items)
      })
    })

    socket.on('general:new_message', (message: ApiMessage) => {
      startTransition(() => {
        setMessages((prev) => [...prev, message])
      })
    })

    socket.on('general:user_left', (payload: { userId?: string }) => {
      if (payload.userId) {
        setTypingList((prev) => prev.filter((x) => x.id !== payload.userId))
      }
    })

    socket.on(
      'general:typing_start',
      (payload: { userId: string; name: string }) => {
        setTypingList((prev) => {
          if (prev.some((x) => x.id === payload.userId)) {
            return prev
          }

          return [...prev, { id: payload.userId, name: payload.name }]
        })
      },
    )

    socket.on('general:typing_stop', (payload: { userId: string }) => {
      setTypingList((prev) => prev.filter((x) => x.id !== payload.userId))
    })

    socket.on(
      'general:reaction_added',
      (payload: { messageId: string; reaction: ApiReaction }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) {
              return m
            }

            const already = (m.reactions ?? []).some(
              (r) => r.id === payload.reaction.id,
            )

            if (already) {
              return m
            }

            return { ...m, reactions: [...(m.reactions ?? []), payload.reaction] }
          }),
        )
      },
    )

    socket.on(
      'general:reaction_removed',
      (payload: { messageId: string; userId: string; emoji: string }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) {
              return m
            }

            return {
              ...m,
              reactions: (m.reactions ?? []).filter(
                (r) => !(r.userId === payload.userId && r.emoji === payload.emoji),
              ),
            }
          }),
        )
      },
    )

    socket.on('general:user_updated', (u: ApiUser) => {
      setMessages((prev) =>
        prev.map((m) => (m.user.id === u.id ? { ...m, user: u } : m)),
      )
    })

    return () => {
      cleanupTyping()
      socket.disconnect()
      socketRef.current = null
    }
  }, [authUser])

  function stopTypingNow() {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }

    if (!iAmTypingRef.current) {
      return
    }

    iAmTypingRef.current = false
    socketRef.current?.emit('general:typing_stop')
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

    if (!iAmTypingRef.current) {
      iAmTypingRef.current = true
      socket.emit('general:typing_start')
    }

    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
    }

    typingTimerRef.current = window.setTimeout(() => {
      typingTimerRef.current = null
      stopTypingNow()
    }, TYPING_IDLE_MS)
  }

  function sendGeneralMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const socket = socketRef.current
    const content = messageInput.trim()

    if (!socket || !socket.connected || !authUser) {
      return
    }

    if (!content) {
      return
    }

    socket.emit('general:send', { content, userId: authUser.id })
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

    if (mine) {
      socket.emit('general:reaction_remove', { messageId: message.id, emoji })
    } else {
      socket.emit('general:reaction_add', { messageId: message.id, emoji })
    }
  }

  function onLogout() {
    setAuthUser(null)
    setMessages([])
    setTypingList([])
    setMessageInput('')
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

  return (
    <main className="mx-auto box-border grid min-h-dvh w-full max-w-[1200px] gap-4 px-5 pt-8 pb-10 md:grid-cols-[320px_1fr]">
      <ProfileCard user={authUser} onSaved={setAuthUser} onLogout={onLogout} />
      <ChatPanel
        authUser={authUser}
        messages={messages}
        typingList={typingList}
        messageInput={messageInput}
        onMessageInput={handleMessageInput}
        onSend={sendGeneralMessage}
        onToggleReaction={toggleReaction}
      />
    </main>
  )
}

export default App
