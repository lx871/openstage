import { useStore } from '../lib/store.js'

export default function SettingsPage(): React.ReactElement {
  const s = useStore.use()
  const set = (patch: Partial<typeof s.settings>): void => useStore.set((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
      <h2 style={{ margin: 0 }}>\u8BBE\u7F6E</h2>
      <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={s.settings.offline} onChange={(e) => set({ offline: e.target.checked })} /> \u79BB\u7EBF\u6A21\u5F0F\uFF08\u65E0\u9700\u5BC6\u94A5\uFF0C\u76F4\u63A5\u672C\u5730\u955C\u50CF\u56DE\u590D\uFF09
      </label>
      <label style={{ fontSize: 12 }}>API Endpoint
        <input value={s.settings.endpoint} onChange={(e) => set({ endpoint: e.target.value })} style={inp} placeholder="https://api.openai.com/v1/chat/completions" />
      </label>
      <label style={{ fontSize: 12 }}>Model
        <input value={s.settings.model} onChange={(e) => set({ model: e.target.value })} style={inp} />
      </label>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>\u5BC6\u94A5\u8BF7\u901A\u8FC7\u73AF\u5883\u53D8\u91CF OPENAI_API_KEY / OPENSTAGE_API_KEY \u6CE8\u5165\uFF1BWeb \u7AEF\u4E0D\u843D\u76D8\u660E\u6587\u5BC6\u94A5\u3002</div>
    </div>
  )
}
const inp: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }
