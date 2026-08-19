import { useState } from 'react'
import { useStore } from '../lib/store.js'

export default function WorldbookPage(): React.ReactElement {
  const store = useStore.use()
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
    const entry = { id, title: '\u65B0\u6761\u76EE', content: '\u5728\u6B64\u8F93\u5165\u5185\u5BB9\u2026', enabled: true, activation: { keyword: { primary: [], secondary: [], caseSensitive: false as const, wholeWord: false, useRegex: false }, time: { sticky: false, probability: 1, reinsert: 'after' as const }, injection: { position: 'beforeChar' as const, depth: 0, order: entries.length, force: false } }, relationTargets: [], unknownFields: {} } as unknown as typeof entries[number]
    const next = kb ? { ...kb, entries: [...kb.entries, entry] } : { id: Math.random().toString(36).slice(2, 8), name: char.identity.name, entries: [entry], vectorized: false } as typeof kb & { entries: typeof entries }
    useStore.set((s) => ({ ...s, knowledgeByChar: { ...s.knowledgeByChar, [char.id]: next! } }))
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0 }}>\u4E16\u754C\u4E66</h2>
        {char && <button onClick={addEntry} style={btn}>+ \u65B0\u589E</button>}
      </div>
      {!char && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 10 }}>\u8BF7\u5148\u5728\u201C\u89D2\u8272\u201D\u9875\u5BFC\u5165\u5361\u7247\u3002</div>}
      {char && <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 10px' }}>\u5F53\u524D\u89D2\u8272\uFF1A{char.identity.name} \u00B7 \u6761\u76EE {String(entries.length)}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e) => (
          <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, opacity: e.enabled ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title ?? e.id.slice(0, 8)} <span style={{ fontWeight: 400, color: '#6b7280' }}>\u00B7 {e.activation.keyword.primary.join(', ') || '\u2014'}</span></div>
              <label style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={e.enabled} onChange={() => toggleEnabled(e.id)} />\u542F\u7528</label>
            </div>
            {editId === e.id ? (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea value={editContent} onChange={(ev) => setEditContent(ev.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 6, fontSize: 12, minHeight: 60 }} />
                <label style={{ fontSize: 11 }}><input type="checkbox" checked={editEnabled} onChange={(ev) => setEditEnabled(ev.target.checked)} /> \u542F\u7528</label>
                <div style={{ display: 'flex', gap: 6 }}><button onClick={saveEdit} style={btn}>\u4FDD\u5B58</button><button onClick={() => setEditId(null)} style={btn}>\u53D6\u6D88</button></div>
              </div>
            ) : (
              <>
                <div onClick={() => setExpanded(expanded === e.id ? null : e.id)} style={{ fontSize: 12, color: '#374151', marginTop: 4, whiteSpace: 'pre-wrap', cursor: 'pointer' }}>{expanded === e.id ? e.content : e.content.slice(0, 240) + (e.content.length > 240 ? '\u2026' : '')}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>order {String(e.activation.injection.order)} \u00B7 depth {String(e.activation.injection.depth)} \u00B7 {e.activation.injection.position}</span>
                  <button onClick={() => startEdit(e.id, e.content, e.enabled)} style={btnSm}>\u7F16\u8F91</button>
                </div>
              </>
            )}
          </div>
        ))}
        {char && entries.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>\u8BE5\u89D2\u8272\u6682\u65E0\u4E16\u754C\u4E66\u6761\u76EE\uFF0C\u70B9\u201C\u65B0\u589E\u201D\u521B\u5EFA\u3002</div>}
      </div>
    </div>
  )
}
const btn: React.CSSProperties = { fontSize: 11, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }
const btnSm: React.CSSProperties = { fontSize: 10, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }
