import { useState } from 'react'
import { convertJsonString, convertPngBytes, exportToJson, exportToPng } from '@openstage/card-converter'
import { useStore } from '../lib/store.js'

export default function ConverterPage(): React.ReactElement {
  const [log, setLog] = useState('')
  const [jsonOut, setJsonOut] = useState('')
  const [target, setTarget] = useState<'v2' | 'v3'>('v2')

  const onFile = async (f: File): Promise<void> => {
    if (f.size > 12 * 1024 * 1024) { setLog('文件过大（>12MB，已拒绝）'); return }
    const buf = new Uint8Array(await f.arrayBuffer())
    try {
      const res = f.name.toLowerCase().endsWith('.png') ? convertPngBytes(buf) : convertJsonString(new TextDecoder().decode(buf))
      const { character, knowledgeBase, sourceVersion, warnings } = res
      useStore.set((s) => ({ ...s, characters: [...s.characters.filter((c) => c.id !== character.id), character], knowledgeByChar: { ...s.knowledgeByChar, [character.id]: knowledgeBase }, activeCharacterId: character.id }))
      setLog(`转换成功：${sourceVersion} → openstage · ${character.identity.name} · KB ${knowledgeBase ? knowledgeBase.entries.length : 0} 条 · ${warnings.join('; ') || '无警告'}`)
      setJsonOut(exportToJson(character, knowledgeBase, { targetVersion: target }))
    } catch (e) { setLog(`转换失败：${String((e as Error).message)}`) }
  }

  const download = (): void => {
    if (!jsonOut) return
    const blob = new Blob([jsonOut], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `openstage-${target}.json`; a.click()
  }

  const [pngBase, setPngBase] = useState<Uint8Array | null>(null)

  const onPngBase = async (f: File): Promise<void> => { setPngBase(new Uint8Array(await f.arrayBuffer())) }

  const downloadPng = async (): Promise<void> => {
    if (!jsonOut) return
    const charId = useStore.get().activeCharacterId
    const char = charId ? useStore.get().characters.find((c) => c.id === charId) : null
    const kb = charId ? useStore.get().knowledgeByChar[charId] ?? null : null
    if (!char) return
    const base = pngBase ?? new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,255,255,63,0,5,254,2,254,220,67,181,142,0,0,0,0,73,69,78,68,174,66,96,130])
    const png = exportToPng(base, char, kb, { targetVersion: target })
    const blob = new Blob([new Uint8Array(png)], { type: 'image/png' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `card-${target}.png`; a.click()
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>卡片转换（ST V1/V2/V3 ↔ openstage · 可逆）</h2>
      <div style={{ fontSize: 12, color: '#6b7280' }}>上传 ST 角色卡（.json / .png），转为 openstage 内部模型；可再导出为 V2/V3 JSON 或 PNG。未知字段无损透传。</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>目标版本
          <select value={target} onChange={(e) => setTarget(e.target.value as 'v2' | 'v3')} style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 6, padding: 4 }}>
            <option value="v2">V2</option>
            <option value="v3">V3</option>
          </select>
        </label>
      </div>
      <label style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 14, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        上传 ST 卡片（.json / .png）
        <input type="file" accept=".json,.png" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
      </label>
      <label style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 10, background: '#fafafa', cursor: 'pointer', fontSize: 11 }}>
        底图 PNG（可选，用于导出 PNG 时保留原图；不选则用 1×1 占位）
        <input type="file" accept=".png" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPngBase(f) }} />
        {pngBase ? `已选择底图（${pngBase.length} bytes）` : '未选择底图'}
      </label>
      {log && <div style={{ fontSize: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>{log}</div>}
      {jsonOut && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} style={btn}>下载 {target.toUpperCase()} JSON</button>
            <button onClick={() => void downloadPng()} style={btn}>下载 {target.toUpperCase()} PNG</button>
          </div>
          <pre style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 11, maxHeight: 360, overflow: 'auto' }}>{jsonOut.slice(0, 6000)}</pre>
        </>
      )}
    </div>
  )
}
const btn: React.CSSProperties = { fontSize: 12, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }
