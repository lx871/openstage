import type { PromptBlockSpec, PromptRole } from '@openstage/contracts'

export interface PresetBlockRaw {
  id?: string
  role?: string
  marker?: string | null
  injection?: boolean
  injection_slots?: string[]
  injection_order?: number
  injection_depth?: number
  disabled?: boolean
  content?: string
  includedInPrompt?: boolean
}

/**
 * Convert a SillyTavern preset (Prompt Manager JSON) into canonical block
 * specs. Unknown slots/fields are preserved on the source; we normalize only
 * the fields we actually compile.
 */
export function presetToBlockSpecs(preset: unknown): PromptBlockSpec[] {
  const list = extractPromptArray(preset)
  const out: PromptBlockSpec[] = []
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] as PresetBlockRaw
    if (!raw || typeof raw !== 'object') continue
    const id = typeof raw.id === 'string' ? raw.id : `block-${i}`
    const marker = typeof raw.marker === 'string' ? raw.marker : null
    const content = typeof raw.content === 'string' ? raw.content : ''
    const role = normalizeRole(raw.role)
    const disabled = raw.disabled === true
    const includedInPrompt = raw.includedInPrompt !== false && !disabled
    out.push({
      id,
      role,
      injected: raw.injection === true,
      marker,
      injectionSlots: normalizeSlots(raw.injection_slots),
      injectionOrder: typeof raw.injection_order === 'number' ? raw.injection_order : i,
      injectionDepth: typeof raw.injection_depth === 'number' ? raw.injection_depth : 0,
      content,
      disabled,
      includedInPrompt,
    })
  }
  return out
}

function normalizeRole(role: unknown): PromptRole {
  if (role === 'system' || role === 'user' || role === 'assistant') return role
  return 'system'
}

function normalizeSlots(list: unknown): PromptBlockSpec['injectionSlots'] {
  const allowed: PromptBlockSpec['injectionSlots'] = [
    'systemPrompt',
    'beforeChar',
    'afterChar',
    'inDialogue',
    'beforeExamples',
    'afterExamples',
    'beforeHistory',
    'inHistory',
    'afterHistory',
    'postHistoryInstructions',
  ]
  if (!Array.isArray(list)) return []
  return list.filter((s): s is (typeof allowed)[number] => typeof s === 'string' && (allowed as string[]).includes(s))
}

function extractPromptArray(preset: unknown): unknown[] {
  if (Array.isArray(preset)) return preset
  if (preset && typeof preset === 'object') {
    const o = preset as Record<string, unknown>
    if (Array.isArray(o['order'])) return o['order'] as unknown[]
    if (Array.isArray(o['promptManager'])) return extractPromptArray(o['promptManager'])
    if (Array.isArray(o['blocks'])) return o['blocks'] as unknown[]
  }
  return []
}