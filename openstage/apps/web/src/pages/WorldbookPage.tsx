import { useState } from 'react'
import { useStore } from '../lib/store.js'

export default function WorldbookPage(): React.ReactElement {
  const store = useStore.get()
  const char = store.characters.find((c) => c.id === store.activeCharacterId) ?? store.characters[0]
  const kb = char ? store.knowledgeByChar[char.id] : null
  const entries = kb?.entries ?? []
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)

  const toggleEnabled = (id: string): void => {
    if (!char || !kb) return
    const next = { ...kb, entries: kb.entries.map((e) => e.id === id ? { ...e, enabled: !e.enabled } : e) }
    useStore.set((s) => ({ ...s, knowledgeByChar: { ...s.knowledgeByChar, [char.id]: next } }))
  }

  const startEdit = (id: string, content: string, enabled: boolean): void => { setEditId(id); setEditContent(content); setEditEnabled(enabled) }
  const saveEdit = (): void => {
    if (!char || !kb || !editId) return
    const next = { ...kb, entries: kb.entries.map((e) => e.id === editId ? { ...e, content: editContent, enabled: editEnabled } : e) }
    useStore.set((s) => ({ ...s, knowledgeByChar: { ...s.knowledgeByChar, [char.id]: next } }))
    setEditId(null)
  }

  const addEntry = (): void => {
    if (!char) return
    const id = Math.random().toString(36).slice(2, 10)
    const entry = { id, title: '新条目', content: '在此输入内容…', enabled: true, activation: { keyword: { primary: [], secondary: [], caseSensitive: false as const, wholeWord: false, useRegex: false }, time: { sticky: false, probability: 1, reinsert: 'after' as const }, injection: { position: 'beforeChar' as const, depth: 0, order: entries.length, force: false } }, relationTargets: [], unknownFields: {} } as unknown as typeof entries[number]
    const next = kb ? { ...kb, entries: [...kb.entries, entry] } : { id: Math.random().toString(36).slice(2, 8), name: char.identity.name, entries: [entry], vectorized: false } as typeof kb & { entries: typeof entries }
    useStore.set((s) => ({ ...s, knowledgeByChar: { ...s.knowledgeByChar, [char.id]: next! } }))
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0 }}>世界书</h2>
        {char && <button onClick={addEntry} style={btn}>+ 新增</button>}
      </div>
      {!char && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 10 }}>请先在“角色”页导入卡片。</div>}
      {char && <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 10px' }}>当前角色：{char.identity.name} · 条目 {entries.length}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e) => (
          <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, opacity: e.enabled ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title ?? e.id.slice(0, 8)} <span style={{ fontWeight: 400, color: '#6b7280' }}>· {e.activation.keyword.primary.join(', ') || '—'}</span></div>
              <label style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={e.enabled} onChange={() => toggleEnabled(e.id)} />启用</label>
            </div>
            {editId === e.id ? (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea value={editContent} onChange={(ev) => setEditContent(ev.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 6, fontSize: 12, minHeight: 60 }} />
                <label style={{ fontSize: 11 }}><input type="checkbox" checked={editEnabled} onChange={(ev) => setEditEnabled(ev.target.checked)} /> 启用</label>
                <div style={{ display: 'flex', gap: 6 }}><button onClick={saveEdit} style={btn}>保存</button><button onClick={() => setEditId(null)} style={btn}>取消</button></div>
              </div>
            ) : (
              <>
                <div onClick={() => setExpanded(expanded === e.id ? null : e.id)} style={{ fontSize: 12, color: '#374151', marginTop: 4, whiteSpace: 'pre-wrap', cursor: 'pointer' }}>{expanded === e.id ? e.content : e.content.slice(0, 240) + (e.content.length > 240 ? '…' : '')}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>order {e.activation.injection.order} · depth {e.activation.injection.depth} · {e.activation.injection.position}</span>
                  <button onClick={() => startEdit(e.id, e.content, e.enabled)} style={btnSm}>编辑</button>
                </div>
              </>
            )}
          </div>
        ))}
        {char && entries.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>该角色暂无世界书条目，点“新增”创建。</div>}
      </div>
    </div>
  )
}
const btn: React.CSSProperties = { fontSize: 11, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }
const btnSm: React.CSSProperties = { fontSize: 10, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }
