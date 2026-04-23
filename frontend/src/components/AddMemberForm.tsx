import { useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import type { ApiRoom, ApiUser } from '../lib/types'
import { btnCls, inputCls } from '../lib/ui'

export function AddMemberForm({
  room,
  authUser,
  onUpdated,
  allUsers,
}: {
  room: ApiRoom
  authUser: ApiUser
  onUpdated: (r: ApiRoom) => void
  allUsers: ApiUser[]
}) {
  const [pickedUserId, setPickedUserId] = useState('')
  const [canSee, setCanSee] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const alreadyInIds = new Set(room.members.map((m) => m.userId))
  const candidates = allUsers.filter(
    (u) => u.id !== authUser.id && !alreadyInIds.has(u.id),
  )

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!pickedUserId) {
      return
    }

    setError('')
    setAdding(true)

    try {
      const updated = await apiRequest<ApiRoom>(`/rooms/${room.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          userId: pickedUserId,
          inviterUserId: authUser.id,
          canSeeHistory: canSee,
        }),
      })
      onUpdated(updated)
      setPickedUserId('')
      setCanSee(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  if (room.ownerId !== authUser.id) {
    return null
  }

  return (
    <form className="mt-2 grid gap-2" onSubmit={onSubmit}>
      <select
        className={inputCls}
        value={pickedUserId}
        onChange={(e) => setPickedUserId(e.target.value)}
      >
        <option value="">— inviter un utilisateur —</option>
        {candidates.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={canSee}
          onChange={(e) => setCanSee(e.target.checked)}
        />
        <span>Peut voir l'historique</span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button className={btnCls} type="submit" disabled={!pickedUserId || adding}>
        {adding ? 'Ajout...' : 'Ajouter'}
      </button>
    </form>
  )
}
