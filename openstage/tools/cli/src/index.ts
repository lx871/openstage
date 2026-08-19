import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { Character } from '@openstage/contracts'
import { ConversationService } from '@openstage/context-engine'
import { addKnowledgeBase, createKnowledgeRepo, EventStore, importCharacterBlob, importCharacterJson, importWorldInfoJson, importWorldInfoJsonl, linkCharacterKb, SqliteEventStore } from '@openstage/storage'
import { planToReport, whyNotInjected, estimatePlanCost } from '@openstage/inspector'

const HELP = `openstage — 兼容迁移平台

用法:
  openstage import <角色文件.json|.png> [--world <世界书.json|jsonl>] [-d <数据目录>]
  openstage trace  <角色文件> [--turn N] [-d <数据目录>]   详细 trace（含 Inspector 报表）
  openstage chat   <角色文件> [--seed 开场白] [--offline|--key <KEY>] [--model <M>] [-d <数据目录>]
  openstage events [-d <数据目录>]                            列出最近事件
  openstage branch <角色文件> [--turn N] [-d <数据目录>]       演示分支+状态回滚
`

interface CliCtx {
  dataDir: string
  store: EventStore | SqliteEventStore
  characters: Map<string, Character>
  knowledge: ReturnType<typeof createKnowledgeRepo>
}

function loadStore(dataDir: string, useSqlite: boolean): CliCtx {
  const characters = new Map<string, Character>()
  const knowledge = createKnowledgeRepo()
  const store = useSqlite
    ? new SqliteEventStore({ file: path.join(dataDir, 'openstage.db') })
    : new EventStore()
  return { dataDir, store, characters, knowledge }
}

function importCharacterInto(ctx: CliCtx, file: string): Character {
  const resolved = path.resolve(file)
  const buf = fs.readFileSync(resolved)
  const result = /\.json$/i.test(resolved)
    ? importCharacterJson(buf.toString('utf8'), resolved)
    : importCharacterBlob(buf, resolved)
  if (result.knowledgeBase) {
    addKnowledgeBase(ctx.knowledge, result.knowledgeBase)
    linkCharacterKb(ctx.knowledge, result.data.id, result.knowledgeBase)
  }
  ctx.characters.set(result.data.id, result.data)
  return result.data
}

function importWorld(ctx: CliCtx, file: string): void {
  const resolved = path.resolve(file)
  const raw = fs.readFileSync(resolved, 'utf8')
  const kb = /\.jsonl$/i.test(resolved) ? importWorldInfoJsonl(raw) : importWorldInfoJson(raw)
  addKnowledgeBase(ctx.knowledge, kb as never)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const cmd = args[0] ?? 'hello'
  const getOpt = (flag: string): string | undefined => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const has = (flag: string): boolean => args.includes(flag)
  const dataDir = getOpt('-d') ?? '.openstage'
  fs.mkdirSync(dataDir, { recursive: true })

  if (cmd === 'hello' || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(cmd === 'hello' ? 'openstage P0 scaffold ready: 契约 + 事件存储 + 兼容上下文引擎 + OpenAI-compatible 网关 + Inspector/分支校验' : HELP)
    return
  }

  if (cmd === 'events') {
    const ctx = loadStore(dataDir, has('--sqlite'))
    const evs = ctx.store instanceof EventStore ? ctx.store.events : ctx.store.stream()
    for (const e of evs.slice(-20)) console.log(`#${e.seq} ${e.kind} conv=${e.conversationId ?? '-'}`)
    return
  }

  const charFile = args[1]
  if (!charFile) {
    console.log(HELP)
    return
  }

  const ctx = loadStore(dataDir, has('--sqlite'))
  const worldFile = getOpt('--world')
  if (worldFile) importWorld(ctx, worldFile)
  const character = importCharacterInto(ctx, charFile)
  const service = new ConversationService({ store: ctx.store, knowledge: ctx.knowledge, characters: ctx.characters, defaultCharName: character.identity.name })

  if (cmd === 'import') {
    console.log(`imported: ${character.identity.name} (${character.id})`)
    console.log(`knowledge: ${character.knowledgeEntryIds.length} entries; unknown fields preserved: ${Object.keys(character.unknownFields).length}`)
    return
  }

  if (cmd === 'trace') {
    await trace(ctx, service, character, Number(getOpt('--turn') ?? 2))
    return
  }

  if (cmd === 'chat') {
    await chat(service, character, { seed: getOpt('--seed'), offline: has('--offline'), apiKey: getOpt('--key'), model: getOpt('--model') })
    return
  }

  if (cmd === 'branch') {
    await branchDemo(service, character, Number(getOpt('--turn') ?? 2))
    return
  }

  console.log(HELP)
}

async function trace(ctx: CliCtx, service: ConversationService, character: Character, turns: number): Promise<void> {
  const cid = `demo-${character.id.slice(0, 8)}`
  await service.create({ characterId: character.id, conversationId: cid, person: 'user' })
  const greeting = await service.greeting(cid)
  await service.append(cid, 'assistant', greeting, character.identity.name)
  for (let i = 0; i < turns; i++) {
    await service.append(cid, 'user', `第 ${i + 1} 条用户消息`, '用户')
    await service.append(cid, 'assistant', `第 ${i + 1} 条回复`, character.identity.name)
  }
  const res = await service.send({ conversationId: cid, content: 'trace 触发' })
  const plan = res.trace
  if (!plan) { console.log(JSON.stringify(res, null, 2)); return }
  const report = planToReport(plan)
  const cost = estimatePlanCost(plan)
  const summary = {
    conversationId: cid,
    mode: report.mode,
    stages: report.stages,
    budget: report.budget,
    tokenAttribution: report.tokenAttribution,
    cacheBreakpoints: report.cacheBreakpoints,
    stablePrefixTokens: report.stablePrefixTokens,
    volatileTokens: report.volatileTokens,
    cost,
    wiActivated: report.queries,
    warnings: report.warnings,
  }
  console.log(JSON.stringify(summary, null, 2))
  for (const b of plan.blocks) {
    console.log(`\n[${b.stage}/${b.slot}][${b.included ? 'IN' : 'OUT'}] token=${b.tokenCount} ${b.sourceRef.kind}:${b.sourceRef.name ?? b.sourceRef.id ?? ''}`)
    if (b.included) console.log(b.content.slice(0, 240))
    if (!b.included && b.exclusionReason) console.log(`  → 排除: ${b.exclusionReason}`)
  }
  for (const q of report.queries.slice(0, 3)) {
    const detail = whyNotInjected(plan, q.entryId)
    if (detail) console.log(`\n[explain] ${q.title ?? q.entryId}: ${detail.reason ?? 'no reason'}`)
  }
}

async function branchDemo(service: ConversationService, character: Character, _turn: number): Promise<void> {
  const cid = `branch-${character.id.slice(0, 8)}`
  await service.create({ characterId: character.id, conversationId: cid, person: 'user' })
  await service.append(cid, 'assistant', await service.greeting(cid), character.identity.name)
  await service.append(cid, 'user', '我们去图书馆吗？', '用户')
  await service.append(cid, 'assistant', '好呀，去三楼吧。', character.identity.name)
  const before = await service.buildDialogue(cid)
  console.log('对话长度（分支前）:', before.length)
  const store: unknown = service.getStore()
  const replay = await (store as { replay(id: string): Promise<{ conversation: { activePath: string[] }; messages: Array<{ id: string }> }> }).replay(cid)
  const path = replay.conversation.activePath
  const forkPoint = path[1]!
  const altId = `alt-${Date.now()}`
  // new branch from fork point
  await (store as { execute(c: { type: string; conversationId: string; path: string[] }): Promise<void> }).execute({ type: 'setBranch', conversationId: cid, path: [path[0]!, forkPoint] })
  await service.append(cid, 'assistant', '其实今晚下雨，在馆里喝茶更好。', character.identity.name)
  console.log('分支切换完成，新 activePath 长度:', (await (store as { replay(id: string): Promise<{ conversation: { activePath: string[] } }> }).replay(cid)).conversation.activePath.length)
  void altId
}

async function chat(service: ConversationService, character: Character, opts: { seed?: string; offline?: boolean; apiKey?: string; model?: string }): Promise<void> {
  const cid = `chat-${character.id.slice(0, 8)}`
  await service.create({ characterId: character.id, conversationId: cid, person: 'user' })
  await service.append(cid, 'assistant', opts.seed ?? (await service.greeting(cid)), character.identity.name)
  console.log(`${character.identity.name}: ${opts.seed ?? (await service.greeting(cid))}`)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve))

  try {
    for (;;) {
      const line = (await ask('你 > ')).trim()
      if (line === 'exit' || line === 'quit') break
      if (!line) continue
      const appended = await service.append(cid, 'user', line, '用户')
      const res = await service.send({ conversationId: cid, content: line })
      if (res.error) {
        console.error('error:', res.error)
        continue
      }
      const reply = res.block && res.block.type === 'text' ? res.block.text : '(无回复)'
      console.log(`${character.identity.name}: ${reply}`)
      await service.append(cid, 'assistant', reply, character.identity.name)
      void appended
    }
  } finally {
    rl.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
