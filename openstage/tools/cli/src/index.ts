import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { Character } from '@openstage/contracts'
import { ConversationService } from '@openstage/context-engine'
import { addKnowledgeBase, createKnowledgeRepo, EventStore, importCharacterBlob, importCharacterJson, importWorldInfoJson, importWorldInfoJsonl, linkCharacterKb, SqliteEventStore } from '@openstage/storage'

const HELP = `openstage CLI（P0 兼容内核开发台）

用法:
  openstage import <角色文件.json|.png> [--world <世界书.json|jsonl>]
  openstage trace  <角色文件> [--turn N]
  openstage chat   <角色文件> [--seed 开场白] [--offline|--key <AK>] [--model <M>]
  openstage events
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
    console.log(cmd === 'hello' ? 'openstage P0 scaffold ready: 契约 + 事件存储 + 兼容上下文引擎 + OpenAI-compatible 网关' : HELP)
    return
  }

  if (cmd === 'events') {
    const ctx = loadStore(dataDir, false)
    for (const e of (ctx.store as EventStore).events) console.log(`#${e.seq} ${e.kind} conv=${e.conversationId ?? '-'}`)
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
  const summary = {
    conversationId: cid,
    mode: res.trace?.mode,
    stages: res.trace?.stages,
    budget: res.trace?.budget,
    cacheBreakpoints: res.trace?.cacheBreakpoints,
    wiActivated: res.trace?.queries,
    warnings: res.trace?.warnings,
  }
  console.log(JSON.stringify(summary, null, 2))
  for (const b of res.trace?.blocks ?? []) {
    console.log(`\n[${b.stage}/${b.slot}][${b.included ? 'IN' : 'OUT'}] token=${b.tokenCount} ${b.sourceRef.kind}:${b.sourceRef.name ?? ''}`)
    if (b.included) console.log(b.content.slice(0, 240))
    if (!b.included && b.exclusionReason) console.log(`  → 排除: ${b.exclusionReason}`)
  }
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