import { useState } from 'react'
import { useStore } from '../lib/store.js'
import { convertJsonString, convertPngBytes, exportToJson } from '@openstage/card-converter'

export default function CharactersPage(): React.ReactElement {
  const [msg, setMsg] = useState('')
  const store = useStore.use()
  const chars = store.characters
  const activeId = store.activeCharacterId

  const onFile = async (f: File): Promise<void> => {
    if (f.size > 12 * 1024 * 1024) { setMsg('\u6587\u4EF6\u8FC7\u5927\uFF0812MB\uFF0C\u5DF2\u62D2\u7EDD\uFF09'); return }
    const buf = new Uint8Array(await f.arrayBuffer())
    try {
      let res
      if (f.name.toLowerCase().endsWith('.png')) res = convertPngBytes(buf)
      else res = convertJsonString(new TextDecoder().decode(buf))
      const kb = res.knowledgeBase
      useStore.set((s) => ({
        ...s,
        characters: [...s.characters.filter((c) => c.id !== res.character.id), res.character],
        knowledgeByChar: { ...s.knowledgeByChar, [res.character.id]: kb },
        activeCharacterId: res.character.id,
      }))
      setMsg('\u5DF2\u5BFC\u5165 ' + res.character.identity.name + '\uFF08' + res.sourceVersion + ' -> openstage\uFF09\uFF0C' + (res.warnings.join('; ') || '\u65E0\u8B66\u544A'))
    } catch (e) { setMsg('\u5BFC\u5165\u5931\u8D25\uFF1A' + String((e as Error).message)) }
  }

  const exportCard = (id: string, version: 'v2' | 'v3'): void => {
    const ch = chars.find((c) => c.id === id); if (!ch) return
    const kb = store.knowledgeByChar[id] ?? null
    const json = exportToJson(ch, kb, { targetVersion: version })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = ch.identity.name + '.' + version + '.json'; a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>\u89D2\u8272</h2>
      <label style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 14, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        \u70B9\u51FB\u6216\u62D6\u62FD\u4E0A\u4F20\u89D2\u8272\u5361\uFF08.json / .png\uFF0CV1/V2/V3\uFF09
        <input type="file" accept=".json,.png" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
      </label>
      {msg && <div style={{ fontSize: 12, color: '#374151', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 10 }}>
        {chars.map((c) => (
          <div key={c.id} style={{ background: '#fff', border: activeId === c.id ? '2px solid #111827' : '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>{c.identity.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', minHeight: 32, overflow: 'hidden' }}>{c.identity.description.slice(0, 120)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => useStore.set((s) => ({ ...s, activeCharacterId: c.id }))} style={btn}>\u8BBE\u4E3A\u5F53\u524D</button>
              <button onClick={() => exportCard(c.id, 'v2')} style={btn}>\u5BFC\u51FA V2</button>
              <button onClick={() => exportCard(c.id, 'v3')} style={btn}>\u5BFC\u51FA V3</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = { fontSize: 11, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }
