import type { Character, KnowledgeBase, UnknownRecord } from '@openstage/contracts'

export type CardVersion = 'v1' | 'v2' | 'v3' | 'unknown'

export interface RawCard {
  version: CardVersion
  spec?: string
  spec_version?: string
  data: UnknownRecord
  raw: UnknownRecord
  warnings: string[]
}

export interface ConvertResult {
  character: Character
  knowledgeBase: KnowledgeBase | null
  sourceVersion: CardVersion
  warnings: string[]
  rawCard: RawCard
}

export interface ExportOptions {
  targetVersion: 'v2' | 'v3'
  includeExtensions?: boolean
}

export interface V2Data {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  creatorcomment?: string
  avatar?: string
  talkativeness?: number
  fav?: boolean
  tags?: string[]
  spec?: string
  spec_version?: string
  data?: UnknownRecord
  [k: string]: unknown
}
