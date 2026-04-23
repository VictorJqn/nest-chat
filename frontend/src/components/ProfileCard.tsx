import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import type { ApiUser } from '../lib/types'
import { btnCls, cardCls, h2Cls, inputCls, smallCls } from '../lib/ui'

export function ProfileCard({
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
