import type { ApiRoom, CurrentRoom } from '../lib/types'
import { cardCls, h2Cls, smallCls } from '../lib/ui'

export function RoomsList({
  rooms,
  current,
  onSelect,
  onOpenCreate,
}: {
  rooms: ApiRoom[]
  current: CurrentRoom
  onSelect: (c: CurrentRoom) => void
  onOpenCreate: () => void
}) {
  const activeCls = 'bg-teal-800 text-teal-50'
  const idleCls = 'bg-white text-slate-700 hover:bg-slate-100'

  const generalActive = current.kind === 'general'

  return (
    <article className={cardCls}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={h2Cls + ' mb-0'}>Salons</h2>
        <button
          type="button"
          onClick={onOpenCreate}
          className="cursor-pointer rounded-md bg-teal-800 px-2 py-1 text-xs text-teal-50 hover:opacity-90"
        >
          + Nouveau
        </button>
      </div>

      <ul className="m-0 grid list-none gap-1 p-0">
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'general' })}
            className={`w-full cursor-pointer rounded-md border border-slate-300 px-2.5 py-1.5 text-left text-sm transition ${
              generalActive ? activeCls : idleCls
            }`}
          >
            # général
          </button>
        </li>

        {rooms.map((r) => {
          const isActive = current.kind === 'room' && current.roomId === r.id

          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: 'room', roomId: r.id })}
                className={`w-full cursor-pointer rounded-md border border-slate-300 px-2.5 py-1.5 text-left text-sm transition ${
                  isActive ? activeCls : idleCls
                }`}
              >
                # {r.name}
                <span className="ml-1 text-xs opacity-70">
                  ({r.members.length})
                </span>
              </button>
            </li>
          )
        })}

        {rooms.length === 0 && (
          <li className={smallCls}>Aucun salon perso pour le moment.</li>
        )}
      </ul>
    </article>
  )
}
