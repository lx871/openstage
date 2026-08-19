import fs from 'node:fs'
import path from 'node:path'
import { compilePrompt, type CompileInput } from '@openstage/context-engine'
import { importCharacterJson, createKnowledgeRepo, addKnowledgeBase, linkCharacterKb, entriesForCharacter } from '@openstage/storage'
import { planToReport, diffPlans } from '@openstage/inspector'

const HELP = `compat-check — 导入等价校验器（P0 信任基石）

用法:
  compat-check <角色卡.json|spec.json> [--turn N]

在 compat/native 双模式下分别生成 PromptPlan，对比：
- 未知字段往返（card.* / world_info.*）
- 块包含与顺序（PromptBlock[]）
并输出 report + diff，便于与 ST 黑盒基准逐块对照。`

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(HELP)
    return
  }
  const cardPath = args[0]!
  const turn = Number(args[args.indexOf('--turn') + 1] ?? 1)
  const raw = fs.readFileSync(path.resolve(cardPath), 'utf8')
  const { data, knowledgeBase } = importCharacterJson(raw)
  const repo = createKnowledgeRepo()
  if (knowledgeBase) { addKnowledgeBase(repo, knowledgeBase); linkCharacterKb(repo, data.id, knowledgeBase) }
  const knowledge = entriesForCharacter(repo, data)

  const baseInput: CompileInput = {
    conversationId: 'compat-check',
    recipeId: 'compat-st-default',
    persona: 'user',
    charName: data.identity.name,
    charDescription: data.identity.description,
    charPersonality: data.identity.personality,
    scenario: data.identity.scenario,
    preset: undefined,
    knowledge,
    examples: data.presentation.guide.exampleMessages,
    systemOverride: data.behavior.systemOverrides['system_prompt'],
    postHistoryInstructions: data.behavior.systemOverrides['post_history_instructions'],
    dialogue: [{ role: 'user', name: 'user', content: '你好，聊聊古籍' }],
    budget: { contextTokens: 8000, reserveOutput: 1024 },
    turn,
  }

  const compat = compilePrompt({ ...baseInput, recipeId: 'compat-st-default' })
  const native = compilePrompt({ ...baseInput, recipeId: 'native-modern' })

  const compatReport = planToReport(compat.plan)
  const diff = diffPlans(compat.plan, native.plan)

  const unknownSummary = {
    characterUnknownKeys: Object.keys(data.unknownFields),
    knowledgeUnknownKeys: knowledge.flatMap((e) => Object.keys(e.unknownFields)).slice(0, 10),
  }

  const out = {
    conversationId: compat.plan.conversationId,
    character: data.identity.name,
    unknownPassthrough: unknownSummary,
    compat: {
      blocks: compatReport.blocks.map((b) => ({ id: b.id, slot: b.slot, stage: b.stage, included: b.included, tokens: b.tokenCount, reason: b.inclusionReason ?? b.exclusionReason })),
      budget: compatReport.budget,
      cacheBreakpoints: compatReport.cacheBreakpoints,
      stablePrefixTokens: compatReport.stablePrefixTokens,
      volatileTokens: compatReport.volatileTokens,
    },
    diff: {
      added: diff.added.map((b) => b.id),
      removed: diff.removed.map((b) => b.id),
      moved: diff.moved,
      renamed: diff.renamed,
    },
    warnings: compat.plan.warnings,
  }

  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => { console.error(err); process.exitCode = 1 })
