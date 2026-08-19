import { useState } from 'react'
import { useStore } from '../lib/store.js'
import { convertJsonString, convertPngBytes, exportToJson } from '@openstage/card-converter'

export default function CharactersPage(): React.ReactElement {
  const [msg, setMsg] = useState('')
  const chars = useStore.get().characters
  const activeId = useStore.get().activeCharacterId

  const onFile = async (f: File): Promise<void> => {
    if (f.size > 12 * 1024 * 1024) { setMsg('文件过大（>12MB，已拒绝）'); return }
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
      setMsg(`已导入 ${res.character.identity.name}（${res.sourceVersion} → openstage），${res.warnings.join('; ') || '无警告'}`)
    } catch (e) { setMsg(`导入失败：${String((e as Error).message)}`) }
  }

  const exportCard = (id: string, version: 'v2' | 'v3'): void => {
    const ch = chars.find((c) => c.id === id); if (!ch) return
    const kb = useStore.get().knowledgeByChar[id] ?? null
    const json = exportToJson(ch, kb, { targetVersion: version })
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${ch.identity.name}.${version}.json`; a.click()
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>角色</h2>
      <label style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 14, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        点击或拖拽上传角色卡（.json / .png，V1/V2/V3）
        <input type="file" accept=".json,.png" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
      </label>
      {msg && <div style={{ fontSize: 12, color: '#374151', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 10 }}>
        {chars.map((c) => (
          <div key={c.id} style={{ background: '#fff', border: activeId === c.id ? '2px solid #111827' : '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>{c.identity.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', minHeight: 32, overflow: 'hidden' }}>{c.identity.description.slice(0, 120)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => useStore.set((s) => ({ ...s, activeCharacterId: c.id }))} style={btn}>设为当前</button>
              <button onClick={() => exportCard(c.id, 'v2')} style={btn}>导出 V2</button>
              <button onClick={() => exportCard(c.id, 'v3')} style={btn}>导出 V3</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = { fontSize: 11, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }
