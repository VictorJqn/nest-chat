import type { ApiReaction, CurrentRoom, TypingUser } from './types'

export function formatTypingText(list: TypingUser[], myId: string | undefined) {
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

export function groupReactions(reactions: ApiReaction[] | undefined) {
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

export function reactionLabel(list: ApiReaction[]) {
  return list.map((r) => r.user?.name || r.user?.email || 'utilisateur').join(', ')
}

export function sameCurrentRoom(a: CurrentRoom, b: CurrentRoom) {
  if (a.kind === 'general' && b.kind === 'general') {
    return true
  }

  if (a.kind === 'room' && b.kind === 'room') {
    return a.roomId === b.roomId
  }

  return false
}
