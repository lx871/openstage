import { useState } from 'react'
import { convertJsonString, convertPngBytes, exportToJson, exportToPng } from '@openstage/card-converter'
import { useStore } from '../lib/store.js'

export default function ConverterPage(): React.ReactElement {
  const [log, setLog] = useState('')
  const [jsonOut, setJsonOut] = useState('')
  const [target, setTarget] = useState<'v2' | 'v3'>('v2')
  const store = useStore.use()

  const onFile = async (f: File): Promise<void> => {
    if (f.size > 12 * 1024 * 1024) { setLog('\u6587\u4EF6\u8FC7\u5927\uFF0812MB\uFF0C\u5DF2\u62D2\u7EDD\uFF09'); return }
    const buf = new Uint8Array(await f.arrayBuffer())
    try {
      const res = f.name.toLowerCase().endsWith('.png') ? convertPngBytes(buf) : convertJsonString(new TextDecoder().decode(buf))
      const { character, knowledgeBase, sourceVersion, warnings } = res
      useStore.set((s) => ({ ...s, characters: [...s.characters.filter((c) => c.id !== character.id), character], knowledgeByChar: { ...s.knowledgeByChar, [character.id]: knowledgeBase }, activeCharacterId: character.id }))
      setLog('\u8F6C\u6362\u6210\u529F\uFF1A' + sourceVersion + ' -> openstage \u00B7 ' + character.identity.name + ' \u00B7 KB ' + (knowledgeBase ? String(knowledgeBase.entries.length) : '0') + ' \u6761 \u00B7 ' + (warnings.join('; ') || '\u65E0\u8B66\u544A'))
      setJsonOut(exportToJson(character, knowledgeBase, { targetVersion: target }))
    } catch (e) { setLog('\u8F6C\u6362\u5931\u8D25\uFF1A' + String((e as Error).message)) }
  }

  const download = (): void => {
    if (!jsonOut) return
    const blob = new Blob([jsonOut], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'openstage-' + target + '.json'; a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
  }

  const [pngBase, setPngBase] = useState<Uint8Array | null>(null)
  const onPngBase = async (f: File): Promise<void> => { setPngBase(new Uint8Array(await f.arrayBuffer())) }

  const downloadPng = (): void => {
    if (!jsonOut) return
    const charId = store.activeCharacterId
    const char = charId ? store.characters.find((c) => c.id === charId) : null
    const kb = charId ? store.knowledgeByChar[charId] ?? null : null
    if (!char) return
    const base = pngBase ?? new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,255,255,63,0,5,254,2,254,220,67,181,142,0,0,0,0,73,69,78,68,174,66,96,130])
    const png = exportToPng(base, char, kb, { targetVersion: target })
    const blob = new Blob([new Uint8Array(png)], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'card-' + target + '.png'; a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>\u5361\u7247\u8F6C\u6362\uFF08ST V1/V2/V3 \u2194 openstage \u00B7 \u53EF\u9006\uFF09</h2>
      <div style={{ fontSize: 12, color: '#6b7280' }}>\u4E0A\u4F20 ST \u89D2\u8272\u5361\uFF08.json / .png\uFF09\uFF0C\u8F6C\u4E3A openstage \u5185\u90E8\u6A21\u578B\uFF1B\u53EF\u518D\u5BFC\u51FA\u4E3A V2/V3 JSON \u6216 PNG\u3002\u672A\u77E5\u5B57\u6BB5\u65E0\u635F\u900F\u4F20\u3002</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>\u76EE\u6807\u7248\u672C
          <select value={target} onChange={(e) => setTarget(e.target.value as 'v2' | 'v3')} style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 6, padding: 4 }}>
            <option value="v2">V2</option>
            <option value="v3">V3</option>
          </select>
        </label>
      </div>
      <label style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 14, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        \u4E0A\u4F20 ST \u5361\u7247\uFF08.json / .png\uFF09
        <input type="file" accept=".json,.png" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
      </label>
      <label style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 10, background: '#fafafa', cursor: 'pointer', fontSize: 11 }}>
        \u5E95\u56FE PNG\uFF08\u53EF\u9009\uFF0C\u7528\u4E8E\u5BFC\u51FA PNG \u65F6\u4FDD\u7559\u539F\u56FE\uFF1B\u4E0D\u9009\u5219\u7528 1x1 \u5360\u4F4D\uFF09
        <input type="file" accept=".png" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPngBase(f) }} />
        {pngBase ? '\u5DF2\u9009\u62E9\u5E95\u56FE\uFF08' + String(pngBase.length) + ' bytes\uFF09' : '\u672A\u9009\u62E9\u5E95\u56FE'}
      </label>
      {log && <div style={{ fontSize: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>{log}</div>}
      {jsonOut && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={download} style={btn}>\u4E0B\u8F7D {target.toUpperCase()} JSON</button>
            <button onClick={downloadPng} style={btn}>\u4E0B\u8F7D {target.toUpperCase()} PNG</button>
          </div>
          <pre style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 11, maxHeight: 360, overflow: 'auto' }}>{jsonOut.slice(0, 6000)}</pre>
        </>
      )}
    </div>
  )
}
const btn: React.CSSProperties = { fontSize: 12, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }
