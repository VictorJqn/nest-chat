import { useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import type { ApiUser, LoginResponse } from '../lib/types'
import { btnCls, cardCls, h2Cls, inputCls } from '../lib/ui'

export function AuthScreen({
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
