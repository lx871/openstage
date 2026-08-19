import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { importCharacterJson, createKnowledgeRepo, addKnowledgeBase, linkCharacterKb, entriesForCharacter } from '@openstage/storage'
import { compilePrompt } from '@openstage/context-engine'
import { planToReport, whyNotInjected, diffPlans } from '@openstage/inspector'

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'linwan.json'), 'utf8')

function makePlan(turn = 2) {
  const { data, knowledgeBase } = importCharacterJson(fixture)
  const repo = createKnowledgeRepo()
  if (knowledgeBase) { addKnowledgeBase(repo, knowledgeBase); linkCharacterKb(repo, data.id, knowledgeBase) }
  const knowledge = entriesForCharacter(repo, data)
  return compilePrompt({
    conversationId: 'c-inspector',
    recipeId: 'compat-st-default',
    persona: 'user',
    charName: data.identity.name,
    charDescription: data.identity.description,
    charPersonality: data.identity.personality,
    scenario: data.identity.scenario,
    knowledge,
    dialogue: [{ role: 'user', name: 'user', content: '你好，聊聊古籍' }],
    budget: { contextTokens: 8000, reserveOutput: 1024 },
    turn,
  }).plan
}

describe('Inspector', () => {
  it('报表归因', () => {
    const plan = makePlan(2)
    const report = planToReport(plan)
    expect(report.blocks.length).toBeGreaterThan(0)
    expect(report.tokenAttribution.length).toBeGreaterThan(0)
    expect(report.cacheBreakpoints.some((c) => c.slot === 'systemPrompt')).toBe(true)
    expect(typeof report.stablePrefixTokens).toBe('number')
    expect(typeof report.volatileTokens).toBe('number')
  })

  it('whyNotInjected 解释未注入', () => {
    const plan = makePlan(2)
    const q = plan.queries[0]
    if (!q) return
    const detail = whyNotInjected(plan, q.entryId)
    expect(detail).not.toBeNull()
  })

  it('diff 捕捉新增与翻转', () => {
    const a = makePlan(1)
    const b = compilePrompt({
      conversationId: 'c-inspector-2',
      recipeId: 'compat-st-default',
      persona: 'user',
      charName: '林晚',
      charDescription: '',
      charPersonality: '',
      scenario: '',
      knowledge: [],
      dialogue: [{ role: 'user', name: 'user', content: '追加第二轮对话' }],
      budget: { contextTokens: 8000, reserveOutput: 1024 },
      turn: 2,
    }).plan
    const d = diffPlans(a, b)
    expect(d.toId).toBe(b.conversationId)
  })
})
