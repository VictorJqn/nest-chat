export type ApiUser = {
  id: string
  email: string
  name: string | null
  color: string
  createdAt: string
  updatedAt: string
}

export type ApiReaction = {
  id: string
  messageId: string
  userId: string
  emoji: string
  createdAt: string
  user?: ApiUser
}

export type ApiMessage = {
  id: string
  content: string
  createdAt: string
  userId: string
  user: ApiUser
  reactions?: ApiReaction[]
}

export type ApiRoomMember = {
  id: string
  roomId: string
  userId: string
  joinedAt: string
  canSeeHistory: boolean
  user: ApiUser
}

export type ApiRoom = {
  id: string
  name: string
  ownerId: string
  createdAt: string
  owner: ApiUser
  members: ApiRoomMember[]
}

export type LoginResponse = {
  token: string
  user: ApiUser
}

export type TypingUser = {
  id: string
  name: string
}

export type CurrentRoom =
  | { kind: 'general' }
  | { kind: 'room'; roomId: string }
