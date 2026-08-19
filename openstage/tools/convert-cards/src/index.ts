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

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true })
  const files = fs.readdirSync(SRC)
  let ok = 0, fail = 0, skipped = 0
  const report: Array<{ file: string; status: string; detail?: string }> = []
  for (const name of files) {
    const full = path.join(SRC, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) { skipped++; continue }
    const lower = name.toLowerCase()
    if (!lower.endsWith('.json') && !lower.endsWith('.png')) { skipped++; continue }
    try {
      let record
      if (lower.endsWith('.png')) {
        const bytes = new Uint8Array(fs.readFileSync(full))
        if (bytes.length > 12 * 1024 * 1024) { report.push({ file: name, status: 'skip', detail: 'too large' }); skipped++; continue }
        record = convertPngBytes(bytes)
      } else {
        const raw = fs.readFileSync(full, 'utf8')
        const cleaned = sanitizeJson(raw)
        record = convertJsonString(cleaned)
      }
      const outName = name.replace(/\.(json|png)$/i, '.openstage.json')
      const payload = {
        _openstage: { converted_from: name, sourceVersion: record.sourceVersion, at: new Date().toISOString(), ads_stripped: true },
        character: record.character,
        knowledgeBase: record.knowledgeBase,
        warnings: record.warnings,
      }
      fs.writeFileSync(path.join(OUT, outName), JSON.stringify(payload, null, 2), 'utf8')
      report.push({ file: name, status: 'ok', detail: record.character.identity.name })
      ok++
    } catch (e) {
      report.push({ file: name, status: 'fail', detail: String((e as Error).message).slice(0, 120) })
      fail++
    }
  }
  fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify({ total: files.length, ok, fail, skipped, report }, null, 2), 'utf8')
  console.log(`done: total=${files.length} ok=${ok} fail=${fail} skipped=${skipped}`)
  if (fail > 0) console.log(report.filter((r) => r.status === 'fail').slice(0, 10).map((r) => `  fail ${r.file}: ${r.detail}`).join('\n'))
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
