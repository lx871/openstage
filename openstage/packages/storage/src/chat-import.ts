import type { Block, MessageRole, UnknownRecord } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { objOf } from './codecs.js'

export interface ParsedChatMessage {
  id: string
  role: MessageRole
  name?: string
  isSystem: boolean
  mes: string
  extra: UnknownRecord
  rawMeta: UnknownRecord
}

export interface ParsedChat {
  messages: ParsedChatMessage[]
  metadata: UnknownRecord
  src: 'jsonl' | 'txt'
}

const ROLE_MAP: Record<string, MessageRole> = {
  user: 'user',
  'user-quick': 'user',
  assistant: 'assistant',
  system: 'system',
  user_gm: 'user',
  gm: 'narrator',
  narrator: 'narrator',
  'editorial': 'system',
}

export function importChatJsonl(raw: string): ParsedChat {
  const messages: ParsedChatMessage[] = []
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  for (const line of lines) {
    let obj: unknown
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    const o = objOf(obj)
    const type = typeof o['type'] === 'string' ? (o['type'] as string) : 'user'
    const role = ROLE_MAP[type] ?? (type === 'system' ? 'system' : 'user')
    const mes = typeof o['mes'] === 'string' ? o['mes'] : String(o['mes'] ?? '')
    const extra: UnknownRecord = {}
    for (const k of ['swipe_id', 'swipes', 'extra', 'chat_metadata', 'is_system', 'is_user', 'send_date', 'edited']) {
      if (o[k] !== undefined) extra[k] = o[k]
    }
    messages.push({
      id: uuid(),
      role,
      name: typeof o['name'] === 'string' ? o['name'] : undefined,
      isSystem: o['is_system'] === true,
      mes,
      extra,
      rawMeta: o,
    })
  }
  return { messages, metadata: {}, src: 'jsonl' }
}

const TXT_SPLIT = /(?:^|\n)(?={{\/?(?:char|user)(?:\||}})[\s\S]*?)(?={{\/?(?:char|user)|\z)/gm

export function importChatTxt(raw: string): ParsedChat {
  const messages: ParsedChatMessage[] = []
  for (const m of Array.from(raw.matchAll(TXT_SPLIT))) {
    const piece = m[0]
    if (!piece) continue
    const speaker = detectTxtSpeaker(piece)
    const body = piece
      .replace(/^[^{]*{{/, '{{')
      .replace(/{{char}}/g, '{{char}}')
      .replace(/{{user}}/g, '{{user}}')
    if (!body.trim()) continue
    messages.push({
      id: uuid(),
      role: speaker === 'user' ? 'user' : speaker === 'narrator' ? 'narrator' : 'assistant',
      name: speaker === 'user' ? undefined : '{{char}}',
      isSystem: speaker === 'system',
      mes: body,
      extra: {},
      rawMeta: {},
    })
  }
  return { messages, metadata: {}, src: 'txt' }
}

function detectTxtSpeaker(block: string): 'user' | 'char' | 'narrator' | 'system' {
  const first = block.slice(0, 200)
  if (first.includes('{{/user}}') || first.includes('{{user}}')) return 'user'
  if (first.includes('{{/char}}') || first.includes('{{char}}')) return 'char'
  if (first.includes('{{/narrator}}') || first.includes('{{narrator}}')) return 'narrator'
  if (first.includes('<div class="mes system')) return 'system'
  return 'char'
}

export type { Block }