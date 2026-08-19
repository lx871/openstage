import { useStore } from '../lib/store.js'

export default function WorldbookPage(): React.ReactElement {
  const store = useStore.get()
  const char = store.characters.find((c) => c.id === store.activeCharacterId) ?? store.characters[0]
  const kb = char ? store.knowledgeByChar[char.id] : null
  const entries = kb?.entries ?? []
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>世界书</h2>
      {!char && <div style={{ fontSize: 13, color: '#6b7280' }}>请先在“角色”页导入卡片。</div>}
      {char && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>当前角色：{char.identity.name} · 条目 {entries.length} · 预算由上下文引擎按 token 自动裁剪</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e) => (
          <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title ?? e.id.slice(0, 8)} <span style={{ fontWeight: 400, color: '#6b7280' }}>· {e.activation.keyword.primary.join(', ') || '—'}</span></div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.content.slice(0, 240)}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>order {e.activation.injection.order} · depth {e.activation.injection.depth} · pos {e.activation.injection.position} · prob {e.activation.time.probability}</div>
          </div>
        ))}
        {char && entries.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>该角色暂无世界书条目。</div>}
      </div>
    </div>
  )
}
