import type { Block, MessageContent, TextBlock, UnknownRecord } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'

export class ContentPart implements MessageContent {
  readonly textBlocks: TextBlock[]

  constructor(blocks: Block[]) {
    this.textBlocks = blocks.filter((b): b is TextBlock => b.type === 'text')
  }

  static text(text: string): MessageContent {
    return new ContentPart([{ type: 'text', text }])
  }

  static fromBlocks(blocks: Block[]): MessageContent {
    return new ContentPart(blocks)
  }

  rawText(): string {
    return this.textBlocks.map((b) => b.text).join('')
  }

  text(_trimTrailingWhitespace = true): string {
    return this.rawText()
  }

  preview(max = 120): string {
    const raw = this.rawText().replace(/\s+/g, ' ').trim()
    return raw.length > max ? `${raw.slice(0, max)}…` : raw
  }

  clone(): MessageContent {
    return new ContentPart(structuredClone(this.textBlocks))
  }
}

/** Bloom-filter style dedupe cursor; for message-replay idempotence checks */
export interface ReplayCursor {
  dedupeSet: Set<string>
  createdTodayCount: number
}

export { uuid }
export type { UnknownRecord }