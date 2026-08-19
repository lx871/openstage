import fs from 'node:fs'
import path from 'node:path'
import { convertJsonString, convertPngBytes } from '@openstage/card-converter'

const SRC = path.resolve('D:/edge/sillytavernassets-main/cards')
const OUT = path.resolve('D:/AIjs/templates/project_root1 (3)/openstage/converted/cards')

const AD_PATTERNS: RegExp[] = [
  /加[群微Q].*?\d{5,}/gi,
  /QQ群[:：]?\s*\d{5,}/gi,
  /微信[:：]?\s*[a-zA-Z0-9_]+/gi,
  /付费|赞助|打赏|众筹|patreon|爱发电|afdian/gi,
  /关注.*公众号/gi,
  /点击.*链接.*购买/gi,
]

function stripAds(s: string): string {
  let out = s
  for (const re of AD_PATTERNS) out = out.replace(re, '')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

function sanitizeJson(raw: string): string {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const data = (obj['data'] && typeof obj['data'] === 'object' ? obj['data'] : obj) as Record<string, unknown>
    for (const k of ['description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'post_history_instructions']) {
      if (typeof data[k] === 'string') data[k] = stripAds(data[k] as string)
    }
    if (Array.isArray(data['alternate_greetings'])) {
      data['alternate_greetings'] = (data['alternate_greetings'] as unknown[]).map((v) => typeof v === 'string' ? stripAds(v) : v)
    }
    return JSON.stringify(obj, null, 2)
  } catch { return raw }
}

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(full, out)
    else out.push(full)
  }
  return out
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true })
  const allFiles = collectFiles(SRC)
  let ok = 0, fail = 0, skipped = 0
  const report: Array<{ file: string; rel: string; status: string; detail?: string }> = []
  for (const full of allFiles) {
    const rel = path.relative(SRC, full)
    const lower = full.toLowerCase()
    if (!lower.endsWith('.json') && !lower.endsWith('.png')) { skipped++; continue }
    try {
      let record
      if (lower.endsWith('.png')) {
        const bytes = new Uint8Array(fs.readFileSync(full))
        if (bytes.length > 12 * 1024 * 1024) { report.push({ file: rel, rel, status: 'skip', detail: 'too large' }); skipped++; continue }
        record = convertPngBytes(bytes)
      } else {
        const raw = fs.readFileSync(full, 'utf8')
        const cleaned = sanitizeJson(raw)
        record = convertJsonString(cleaned)
      }
      const outRel = rel.replace(/\.(json|png)$/i, '.openstage.json')
      const outPath = path.join(OUT, outRel)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      const payload = {
        _openstage: { converted_from: rel, sourceVersion: record.sourceVersion, at: new Date().toISOString(), ads_stripped: true },
        character: record.character,
        knowledgeBase: record.knowledgeBase,
        warnings: record.warnings,
      }
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
      report.push({ file: rel, rel, status: 'ok', detail: record.character.identity.name })
      ok++
    } catch (e) {
      report.push({ file: rel, rel, status: 'fail', detail: String((e as Error).message).slice(0, 160) })
      fail++
    }
  }
  fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify({ total: allFiles.length, ok, fail, skipped, report }, null, 2), 'utf8')
  console.log(`done: total=${allFiles.length} ok=${ok} fail=${fail} skipped=${skipped}`)
  if (fail > 0) {
    const fails = report.filter((r) => r.status === 'fail')
    console.log(fails.slice(0, 20).map((r) => `  fail ${r.file}: ${r.detail}`).join('\n'))
    if (fails.length > 20) console.log(`  ... and ${fails.length - 20} more failures`)
    const byReason = new Map<string, number>()
    for (const r of fails) { const k = r.detail ?? 'unknown'; byReason.set(k, (byReason.get(k) ?? 0) + 1) }
    console.log('fail reasons:', [...byReason.entries()].map(([k, v]) => `${k} x${v}`).join(' | '))
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
