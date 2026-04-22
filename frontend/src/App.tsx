import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react'
import { io, type Socket } from 'socket.io-client'
import './App.css'

type ApiUser = {
  id: string
  email: string
  name: string | null
  color: string
  createdAt: string
  updatedAt: string
}

type ApiMessage = {
  id: string
  content: string
  createdAt: string
  userId: string
  user: ApiUser
}

type LoginResponse = {
  token: string
  user: ApiUser
}

type LogType = 'info' | 'error' | 'event'

type LogItem = {
  id: number
  type: LogType
  text: string
  time: string
}

async function apiRequest<T>(
  apiBase: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
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

function formatClock() {
  return new Date().toLocaleTimeString('fr-FR')
}

function App() {
  const [apiBase, setApiBase] = useState('http://localhost:3000')

  const [registerEmail, setRegisterEmail] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [authUser, setAuthUser] = useState<ApiUser | null>(null)
  const [token, setToken] = useState('')

  const [users, setUsers] = useState<ApiUser[]>([])
  const [messagesHttp, setMessagesHttp] = useState<ApiMessage[]>([])
  const [messagesWs, setMessagesWs] = useState<ApiMessage[]>([])

  const [joinUserId, setJoinUserId] = useState('')
  const [messageInput, setMessageInput] = useState('')

  const [profileName, setProfileName] = useState('')
  const [profileColor, setProfileColor] = useState('#4f8cff')
  const [savingProfile, setSavingProfile] = useState(false)

  const [socketConnected, setSocketConnected] = useState(false)
  const [inGeneralRoom, setInGeneralRoom] = useState(false)

  const [logs, setLogs] = useState<LogItem[]>([])

  const socketRef = useRef<Socket | null>(null)
  const logIdRef = useRef(0)

  function addLog(type: LogType, text: string) {
    const nextId = logIdRef.current + 1
    logIdRef.current = nextId

    setLogs((prev) => {
      const next = [...prev, { id: nextId, type, text, time: formatClock() }]
      return next.slice(-60)
    })
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const user = await apiRequest<ApiUser>(apiBase, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: registerEmail,
          name: registerName || undefined,
          password: registerPassword,
        }),
      })

      setAuthUser(user)
      setJoinUserId(user.id)
      setProfileName(user.name ?? '')
      setProfileColor(user.color ?? '#4f8cff')
      addLog('event', `register OK: ${user.email}`)
    } catch (error) {
      addLog('error', `register: ${(error as Error).message}`)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const result = await apiRequest<LoginResponse>(apiBase, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      })

      setToken(result.token)
      setAuthUser(result.user)
      setJoinUserId(result.user.id)
      setProfileName(result.user.name ?? '')
      setProfileColor(result.user.color ?? '#4f8cff')
      addLog('event', `login OK: ${result.user.email}`)
    } catch (error) {
      addLog('error', `login: ${(error as Error).message}`)
    }
  }

  async function loadUsers() {
    try {
      const result = await apiRequest<ApiUser[]>(apiBase, '/users')
      setUsers(result)
      addLog('info', `${result.length} user(s) chargés`)
    } catch (error) {
      addLog('error', `users: ${(error as Error).message}`)
    }
  }

  async function loadMessagesHttp() {
    try {
      const result = await apiRequest<ApiMessage[]>(apiBase, '/messages')
      setMessagesHttp(result)
      addLog('info', `${result.length} message(s) HTTP chargés`)
    } catch (error) {
      addLog('error', `messages: ${(error as Error).message}`)
    }
  }

  function connectSocket() {
    socketRef.current?.disconnect()
    setInGeneralRoom(false)

    addLog('info', `connexion websocket vers ${apiBase}`)

    const socket = io(apiBase, {
      transports: ['websocket'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      addLog('event', `socket connecté (${socket.id})`)
    })

    socket.on('disconnect', (reason) => {
      setSocketConnected(false)
      setInGeneralRoom(false)
      addLog('info', `socket déconnecté (${reason})`)
    })

    socket.on('connect_error', (error) => {
      addLog('error', `socket: ${error.message}`)
    })

    socket.on('exception', (payload) => {
      const msg =
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : 'erreur websocket'

      setInGeneralRoom(false)
      addLog('error', `ws exception: ${msg}`)
    })

    socket.on('general:init', (items: ApiMessage[]) => {
      startTransition(() => {
        setMessagesWs(items)
      })

      setInGeneralRoom(true)
      addLog('event', `join general OK (${items.length} message(s))`)
    })

    socket.on('general:new_message', (message: ApiMessage) => {
      startTransition(() => {
        setMessagesWs((prev) => [...prev, message])
      })

      addLog('event', `new message: ${message.user.email}`)
    })

    socket.on('general:user_joined', (payload: { name?: string }) => {
      addLog('event', `${payload.name || 'un user'} a rejoint`)
    })

    socket.on('general:user_left', (payload: { name?: string }) => {
      addLog('info', `${payload.name || 'un user'} a quitté`)
    })

    socket.on('general:user_updated', (u: ApiUser) => {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))
      setMessagesWs((prev) =>
        prev.map((m) => (m.user.id === u.id ? { ...m, user: u } : m)),
      )
      setMessagesHttp((prev) =>
        prev.map((m) => (m.user.id === u.id ? { ...m, user: u } : m)),
      )

      addLog('event', `${u.name || u.email} a mis a jour son profil`)
    })
  }

  function disconnectSocket() {
    socketRef.current?.disconnect()
    socketRef.current = null
    setSocketConnected(false)
    setInGeneralRoom(false)
  }

  function joinGeneral() {
    const socket = socketRef.current
    const currentUserId = joinUserId.trim() || authUser?.id || ''

    if (!socket || !socket.connected) {
      addLog('error', 'socket non connecté')
      return
    }

    if (!currentUserId) {
      addLog('error', 'userId manquant pour join')
      return
    }

    socket.emit('general:join', { userId: currentUserId })
    addLog('info', `join demandé pour ${currentUserId}`)
  }

  function sendGeneralMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const socket = socketRef.current
    const content = messageInput.trim()
    const userId = joinUserId.trim() || authUser?.id || ''

    if (!socket || !socket.connected) {
      addLog('error', 'socket non connecté')
      return
    }

    if (!content) {
      addLog('error', 'message vide')
      return
    }

    socket.emit('general:send', { content, userId })
    setMessageInput('')
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!authUser) {
      addLog('error', 'connecte toi avant de modifier ton profil')
      return
    }

    setSavingProfile(true)

    try {
      const u = await apiRequest<ApiUser>(apiBase, `/users/${authUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName.trim() === '' ? null : profileName,
          color: profileColor,
        }),
      })

      setAuthUser(u)
      setProfileName(u.name ?? '')
      setProfileColor(u.color)

      setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))
      setMessagesWs((prev) =>
        prev.map((m) => (m.user.id === u.id ? { ...m, user: u } : m)),
      )
      setMessagesHttp((prev) =>
        prev.map((m) => (m.user.id === u.id ? { ...m, user: u } : m)),
      )

      addLog('event', `profil MAJ ok (${u.name ?? u.email})`)
    } catch (error) {
      addLog('error', `profil: ${(error as Error).message}`)
    } finally {
      setSavingProfile(false)
    }
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  return (
    <main className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Nest Chat Test Front</p>
          <h1>Auth + General Chat (Websocket)</h1>
        </div>
        <label className="api">
          <span>API Base URL</span>
          <input
            value={apiBase}
            onChange={(event) => setApiBase(event.target.value)}
            placeholder="http://localhost:3000"
          />
        </label>
      </header>

      <section className="layout">
        <article className="card">
          <h2>Authentication</h2>

          <form className="stack" onSubmit={handleRegister}>
            <h3>Register</h3>
            <input
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              placeholder="email"
              type="email"
              required
            />
            <input
              value={registerName}
              onChange={(event) => setRegisterName(event.target.value)}
              placeholder="name (optionnel)"
            />
            <input
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              placeholder="password"
              type="password"
              minLength={6}
              required
            />
            <button type="submit">Register</button>
          </form>

          <form className="stack" onSubmit={handleLogin}>
            <h3>Login</h3>
            <input
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="email"
              type="email"
              required
            />
            <input
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="password"
              type="password"
              required
            />
            <button type="submit">Login</button>
          </form>

          <div className="session">
            <h3>Session</h3>
            {authUser ? (
              <p>
                connecté: <strong>{authUser.email}</strong>
              </p>
            ) : (
              <p>pas connecté</p>
            )}
            <p className="small">token: {token ? 'ok' : 'none'}</p>
          </div>
        </article>

        <article className="card">
          <h2>Profil</h2>
          {authUser ? (
            <form className="stack" onSubmit={saveProfile}>
              <label className="stack">
                <span className="small">Username</span>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="ton nom affiché"
                  maxLength={40}
                />
              </label>

              <label className="color-row">
                <span className="small">Couleur</span>
                <input
                  type="color"
                  value={profileColor}
                  onChange={(event) => setProfileColor(event.target.value)}
                />
                <span className="swatch" style={{ background: profileColor }} />
                <code className="small">{profileColor}</code>
              </label>

              <p className="small">
                Aperçu:{' '}
                <strong style={{ color: profileColor }}>
                  {profileName.trim() || authUser.email}
                </strong>
              </p>

              <button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          ) : (
            <p className="small">Connecte-toi pour modifier ton profil.</p>
          )}
        </article>

        <article className="card">
          <h2>HTTP Quick Checks</h2>
          <div className="row">
            <button onClick={loadUsers} type="button">
              Load users
            </button>
            <button onClick={loadMessagesHttp} type="button">
              Load messages
            </button>
          </div>
          <div className="split">
            <div>
              <h3>Users ({users.length})</h3>
              <ul className="list">
                {users.map((user) => (
                  <li key={user.id}>
                    <code>{user.id}</code>
                    <span>
                      <span
                        className="dot"
                        style={{ background: user.color || '#4f8cff' }}
                      />
                      <strong style={{ color: user.color || '#4f8cff' }}>
                        {user.name || user.email}
                      </strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>HTTP messages ({messagesHttp.length})</h3>
              <ul className="list">
                {messagesHttp.map((message) => (
                  <li key={message.id}>
                    <span style={{ color: message.user.color || '#4f8cff' }}>
                      <strong>{message.user.name || message.user.email}</strong>
                    </span>
                    <p>{message.content}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <article className="card wide">
          <h2>General Chat (Websocket)</h2>
          <div className="row">
            <button onClick={connectSocket} type="button">
              Connect socket
            </button>
            <button onClick={disconnectSocket} type="button">
              Disconnect
            </button>
            <span className={`status ${socketConnected ? 'on' : 'off'}`}>
              {socketConnected ? 'connected' : 'offline'}
            </span>
          </div>

          <div className="row">
            <input
              value={joinUserId}
              onChange={(event) => setJoinUserId(event.target.value)}
              placeholder="userId pour join (auto rempli après login)"
            />
            <button onClick={joinGeneral} type="button">
              Join general
            </button>
            <span className={`status ${inGeneralRoom ? 'on' : 'off'}`}>
              {inGeneralRoom ? 'in room' : 'not in room'}
            </span>
          </div>

          <form className="row" onSubmit={sendGeneralMessage}>
            <input
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder="ton message ici"
            />
            <button type="submit">Send</button>
          </form>

          <h3>Live messages ({messagesWs.length})</h3>
          <ul className="chat">
            {messagesWs.map((message) => (
              <li key={message.id}>
                <div>
                  <strong style={{ color: message.user.color || '#4f8cff' }}>
                    {message.user.name || message.user.email}
                  </strong>
                  <small>
                    {' '}
                    {new Date(message.createdAt).toLocaleTimeString('fr-FR')}
                  </small>
                </div>
                <p>{message.content}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="card wide">
          <h2>Logs</h2>
          <ul className="logs">
            {logs.map((item) => (
              <li key={item.id} className={item.type}>
                <span>[{item.time}]</span> {item.text}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App
