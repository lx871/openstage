import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { importCharacterJson, importWorldInfoJson, createKnowledgeRepo, addKnowledgeBase, linkCharacterKb, entriesForCharacter } from '@openstage/storage'
import { compilePrompt, presetToBlockSpecs, macroEval } from '@openstage/context-engine'

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'linwan.json'), 'utf8')

describe('V2 角色卡导入', () => {
  it('解析身份/呈现/行为四分离', () => {
    const { data, knowledgeBase } = importCharacterJson(fixture)
    expect(data.identity.name).toBe('林晚')
    expect(data.identity.description).toContain('图书管理员')
    expect(data.presentation.guide.greetingCandidates.length).toBe(2)
    expect(data.presentation.guide.exampleMessages.length).toBe(1)
    expect(data.behavior.systemOverrides['system_prompt']).toContain('林晚')
    expect(knowledgeBase?.entries).toHaveLength(2)
  })

  it('未知字段无损保留', () => {
    const { data } = importCharacterJson(fixture)
    expect(data.unknownFields['tags']).toEqual(['图书馆', '治愈'])
    expect(data.identity.meta?.['creator']).toBe('openstage-fixture')
  })
})

describe('知识条目导入', () => {
  it('世界书 JSON 解析并接入角色', () => {
    const { data, knowledgeBase } = importCharacterJson(fixture)
    const repo = createKnowledgeRepo()
    if (knowledgeBase) {
      addKnowledgeBase(repo, knowledgeBase)
      linkCharacterKb(repo, data.id, knowledgeBase)
    }
    const entries = entriesForCharacter(repo, data)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.activation.keyword.primary).toContain('古籍')
    expect(entries[1]!.activation.injection.position).toBe('beforeExamples')
  })
})

describe('预设 → 块映射', () => {
  it('marker 与注入槽位映射', () => {
    const preset = {
      order: [
        { id: 'sys', role: 'system', content: '你是一个助手', marker: 'system', injection_order: 0 },
        { id: 'wi', role: 'system', content: '[WI]', marker: 'worldInfoBefore', injection_order: 1 },
      ],
    }
    const specs = presetToBlockSpecs(preset)
    expect(specs).toHaveLength(2)
    expect(specs[0]!.marker).toBe('system')
  })
})

describe('宏求值', () => {
  it('展开已知宏并报告未解析', () => {
    const { expanded, remaining } = macroEval('{{char}} 和 {{user}} 还有 {{unknown}}', { char: '林晚', user: '读者' })
    expect(expanded).toContain('林晚')
    expect(expanded).toContain('读者')
    expect(remaining).toContain('unknown')
  })
})

describe('提示词编译（兼容模式）', () => {
  it('稳定区→易变区顺序 + 缓存断点 + 预算', () => {
    const { data, knowledgeBase } = importCharacterJson(fixture)
    const repo = createKnowledgeRepo()
    if (knowledgeBase) {
      addKnowledgeBase(repo, knowledgeBase)
      linkCharacterKb(repo, data.id, knowledgeBase)
    }
    const knowledge = entriesForCharacter(repo, data)
    const result = compilePrompt({
      conversationId: 'c-1',
      recipeId: 'compat-st-default',
      persona: '读者',
      charName: data.identity.name,
      charDescription: data.identity.description,
      charPersonality: data.identity.personality,
      scenario: data.identity.scenario,
      preset: undefined,
      knowledge,
      examples: data.presentation.guide.exampleMessages,
      systemOverride: data.behavior.systemOverrides['system_prompt'],
      postHistoryInstructions: data.behavior.systemOverrides['post_history_instructions'],
      dialogue: [
        { role: 'user', name: '读者', content: '这里有什么古籍吗？' }, // 命中"古籍"
        { role: 'assistant', name: '林晚', content: '第三排有《星图手札》。' },
      ],
      budget: { contextTokens: 8000, reserveOutput: 1024 },
      turn: 2,
    })

    const plan = result.plan
    expect(plan.mode).toBe('compat')
    // WI「古籍修复」应被激活
    const lore = plan.queries.filter((q) => q.mode === 'keyword')
    expect(lore.length).toBeGreaterThan(0)
    expect(lore.some((q) => q.matchedKeys.includes('古籍'))).toBe(true)

    // 顺序：system/identity/lore 在 history 之前
    const order = plan.blocks.map((b) => b.stage)
    const sysIdx = order.indexOf('identity')
    const histIdx = order.indexOf('history')
    expect(sysIdx).toBeGreaterThanOrEqual(0)
    expect(histIdx).toBeGreaterThanOrEqual(0)
    expect(sysIdx).toBeLessThan(histIdx)

    // 预算行 & 缓存断点
    expect(plan.budget.some((b) => b.stage === 'lore')).toBe(true)
    expect(plan.cacheBreakpoints.some((c) => c.slot === 'systemPrompt' && c.reason === 'stable')).toBe(true)
    expect(plan.cacheBreakpoints.some((c) => c.slot === 'afterHistory' && c.reason === 'volatile')).toBe(true)
  })

  it('预算裁剪超额历史', () => {
    const dialogue = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: '这是一段足够长的对话内容，用来测试预算裁剪逻辑是否如期工作。'.repeat(3),
    }))
    const result = compilePrompt({
      conversationId: 'c-2',
      recipeId: 'compat-st-default',
      persona: 'user',
      charName: '角色',
      charDescription: '',
      charPersonality: '',
      scenario: '',
      knowledge: [],
      dialogue,
      budget: { contextTokens: 2000, reserveOutput: 100 },
      turn: 50,
    })
    const includedHistory = result.plan.blocks.filter((b) => b.stage === 'history' && b.included)
    const total = includedHistory.reduce((a, b) => a + b.tokenCount, 0)
    expect(result.plan.warnings.length).toBe(0) // 无 WI，无裁切警告
    expect(total).toBeLessThan(1900)
  })
})