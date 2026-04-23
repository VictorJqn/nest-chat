import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import type { ApiRoom, ApiUser } from '../lib/types'
import { btnCls, cardCls, h2Cls, inputCls, smallCls } from '../lib/ui'

export function CreateRoomModal({
  authUser,
  onClose,
  onCreated,
}: {
  authUser: ApiUser
  onClose: () => void
  onCreated: (r: ApiRoom) => void
}) {
  const [name, setName] = useState('')
  const [allUsers, setAllUsers] = useState<ApiUser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [canSeeHistory, setCanSeeHistory] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<ApiUser[]>('/users')
      .then((list) => {
        setAllUsers(list.filter((u) => u.id !== authUser.id))
      })
      .catch((err) => setError((err as Error).message))
  }, [authUser.id])

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)

      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }

      return next
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setCreating(true)

    try {
      const room = await apiRequest<ApiRoom>('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name,
          ownerId: authUser.id,
          memberIds: [...selected],
          canSeeHistory,
        }),
      })
      onCreated(room)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <article className={`${cardCls} w-full max-w-lg`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className={h2Cls + ' mb-0'}>Nouveau salon</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-sm text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1.5">
            <span className={smallCls}>Nom du salon</span>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: dev team"
              maxLength={60}
              required
            />
          </label>

          <div>
            <p className={`${smallCls} mb-1.5`}>Inviter des membres</p>
            <ul className="m-0 grid max-h-48 list-none gap-1 overflow-auto rounded-md border border-slate-300 bg-slate-50 p-2">
              {allUsers.map((u) => {
                const checked = selected.has(u.id)

                return (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(u.id)}
                      />
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: u.color }}
                      />
                      <span>
                        <strong style={{ color: u.color }}>
                          {u.name || u.email}
                        </strong>
                      </span>
                    </label>
                  </li>
                )
              })}

              {allUsers.length === 0 && (
                <li className={smallCls}>Aucun autre utilisateur disponible.</li>
              )}
            </ul>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={canSeeHistory}
              onChange={(e) => setCanSeeHistory(e.target.checked)}
            />
            <span>Les invités voient l'historique avant leur arrivée</span>
          </label>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-[10px] border border-slate-300 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button className={btnCls} type="submit" disabled={creating}>
              {creating ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
