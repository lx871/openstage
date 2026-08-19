import { useStore } from '../lib/store.js'

export default function SettingsPage(): React.ReactElement {
  const s = useStore.get()
  const set = (patch: Partial<typeof s.settings>): void => useStore.set((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
      <h2 style={{ margin: 0 }}>设置</h2>
      <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={s.settings.offline} onChange={(e) => set({ offline: e.target.checked })} /> 离线模式（无需密钥，直接本地镜像回复）
      </label>
      <label style={{ fontSize: 12 }}>API Endpoint
        <input value={s.settings.endpoint} onChange={(e) => set({ endpoint: e.target.value })} style={inp} placeholder="https://api.openai.com/v1/chat/completions" />
      </label>
      <label style={{ fontSize: 12 }}>Model
        <input value={s.settings.model} onChange={(e) => set({ model: e.target.value })} style={inp} />
      </label>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>密钥请通过环境变量 OPENAI_API_KEY / OPENSTAGE_API_KEY 注入；Web 端不落盘明文密钥。</div>
    </div>
  )
}
const inp: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }
