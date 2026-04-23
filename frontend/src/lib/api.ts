import type { ApiRoom, ApiUser } from './types'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export function fetchRooms(userId: string) {
  return apiRequest<ApiRoom[]>(`/rooms?userId=${userId}`)
}

export function fetchUsers() {
  return apiRequest<ApiUser[]>('/users')
}
