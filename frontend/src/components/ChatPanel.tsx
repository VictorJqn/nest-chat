import type { FormEvent, ReactNode } from 'react'
import { formatTypingText, groupReactions, reactionLabel } from '../lib/helpers'
import type { ApiMessage, ApiUser, TypingUser } from '../lib/types'
import { btnCls, cardCls, EMOJI_CHOICES, h2Cls, inputCls, smallCls } from '../lib/ui'

export function ChatPanel({
  authUser,
  title,
  messages,
  typingList,
  messageInput,
  onMessageInput,
  onSend,
  onToggleReaction,
  extra,
}: {
  authUser: ApiUser
  title: string
  messages: ApiMessage[]
  typingList: TypingUser[]
  messageInput: string
  onMessageInput: (v: string) => void
  onSend: (e: FormEvent<HTMLFormElement>) => void
  onToggleReaction: (m: ApiMessage, emoji: string) => void
  extra?: ReactNode
}) {
  const myId = authUser.id

  return (
    <article className={`${cardCls} flex h-full flex-col`}>
      <h2 className={h2Cls}>{title}</h2>

      {extra}

      <ul className="m-0 mt-2 grid flex-1 list-none gap-2 overflow-auto p-0">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            myId={myId}
            onToggleReaction={onToggleReaction}
          />
        ))}

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

function MessageItem({
  message,
  myId,
  onToggleReaction,
}: {
  message: ApiMessage
  myId: string
  onToggleReaction: (m: ApiMessage, emoji: string) => void
}) {
  const groups = groupReactions(message.reactions)

  return (
    <li className="group rounded-[10px] border border-slate-300 bg-slate-50 p-2.5">
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
}
