import fs from 'node:fs'
import path from 'node:path'
import { convertJsonString, convertPngBytes, exportToJson, exportToPng } from '@openstage/card-converter'

function assertSafePath(p: string): void {
  if (p.includes('\0')) throw Object.assign(new Error(`invalid path: ${p}`), { code: 'invalid_path' })
}

export async function runConvert(args: string[]): Promise<void> {
  const getOpt = (flag: string): string | undefined => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const input = args[1]
  if (!input) {
    console.log(`用法:
  openstage convert <卡片.json|.png> [--to v2|v3] [--out <输出路径>] [--png <底图.png>]

  将 ST V1/V2/V3 卡片转为 openstage 内部模型并导出为指定版本。
  .png 输入自动识别 PNG 内嵌 JSON；--png 可将 JSON 转写为 PNG。`)
    return
  }
  const to = (getOpt('--to') ?? 'v2') as 'v2' | 'v3'
  if (to !== 'v2' && to !== 'v3') throw new Error('--to must be v2 or v3')
  const out = getOpt('--out') ?? `openstage-${to}.json`
  const pngBase = getOpt('--png')
  assertSafePath(path.resolve(out))
  if (pngBase) assertSafePath(path.resolve(pngBase))
  const resolved = path.resolve(input)
  assertSafePath(resolved)
  const stat = fs.statSync(resolved)
  if (stat.size > 12 * 1024 * 1024) throw Object.assign(new Error(`input too large: ${stat.size} bytes`), { code: 'file_too_large' })
  const buf = fs.readFileSync(resolved)
  const isPng = resolved.toLowerCase().endsWith('.png')
  const result = isPng ? convertPngBytes(new Uint8Array(buf)) : convertJsonString(buf.toString('utf8'))
  console.log(`source: ${result.sourceVersion} → openstage · ${result.character.identity.name} · KB ${result.knowledgeBase ? result.knowledgeBase.entries.length : 0} 条`)
  if (result.warnings.length) console.log(`warnings: ${result.warnings.join('; ')}`)
  console.log(`unknown fields preserved: ${Object.keys(result.character.unknownFields).length} keys`)
  if (pngBase) {
    const baseBuf = fs.readFileSync(path.resolve(pngBase))
    if (baseBuf.length > 12 * 1024 * 1024) throw Object.assign(new Error('base PNG too large'), { code: 'file_too_large' })
    const pngOut = exportToPng(new Uint8Array(baseBuf), result.character, result.knowledgeBase, { targetVersion: to })
    const pngPath = out.replace(/\.json$/i, '.png')
    assertSafePath(path.resolve(pngPath))
    fs.writeFileSync(pngPath, pngOut)
    console.log(`PNG written: ${pngPath} (${pngOut.length} bytes)`)
  }
  const json = exportToJson(result.character, result.knowledgeBase, { targetVersion: to })
  if (json.length > 5 * 1024 * 1024) throw Object.assign(new Error('output JSON too large'), { code: 'file_too_large' })
  fs.writeFileSync(out, json, 'utf8')
  console.log(`JSON written: ${path.resolve(out)} (${json.length} chars)`)
  const roundtrip = convertJsonString(json)
  console.log(`round-trip OK: ${roundtrip.character.identity.name} (unknown preserved: ${Object.keys(roundtrip.character.unknownFields).length})`)
}
