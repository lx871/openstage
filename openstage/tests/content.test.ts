import { describe, expect, it } from 'vitest'
import { ContentPart } from '@openstage/domain'

describe('ContentPart', () => {
  it('concatenates text blocks', () => {
    const c = ContentPart.fromBlocks([
      { type: 'text', text: '你好，' },
      { type: 'text', text: '世界' },
    ])
    expect(c.text()).toBe('你好，世界')
    expect(c.preview(10)).toBe('你好，世界')
  })

  it('preview truncates long text', () => {
    const c = ContentPart.text('a'.repeat(300))
    expect(c.preview(50).length).toBeLessThanOrEqual(51)
  })

  it('preview keeps short text intact', () => {
    const c = ContentPart.text('短文本')
    expect(c.preview(4)).toBe('短文本')
  })

  it('rawText excludes non-text blocks', () => {
    const c = ContentPart.fromBlocks([
      { type: 'text', text: '正文' },
      { type: 'custom', kind: 'dice', payload: { result: 6 }, sandboxed: true },
    ])
    expect(c.rawText()).toBe('正文')
  })
})