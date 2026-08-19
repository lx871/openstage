import { create } from './mini-store.js'
import type { Character, KnowledgeBase } from '@openstage/contracts'

export interface AppState {
  characters: Character[]
  knowledgeByChar: Record<string, KnowledgeBase | null>
  activeCharacterId: string | null
  activeConversationId: string | null
  settings: { offline: boolean; endpoint: string; model: string }
}

const defaultState: AppState = {
  characters: [],
  knowledgeByChar: {},
  activeCharacterId: null,
  activeConversationId: null,
  settings: { offline: true, endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
}

function load(): AppState {
  try {
    const raw = localStorage.getItem('openstage.state.v1')
    if (raw) return { ...defaultState, ...JSON.parse(raw) }
  } catch {}
  return defaultState
}

function save(s: AppState): void {
  try { localStorage.setItem('openstage.state.v1', JSON.stringify(s)) } catch {}
}

export const useStore = create<AppState>(load())
useStore.subscribe(save)
