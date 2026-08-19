import { useState } from 'react'
import { useStore } from '../lib/store.js'
import { compilePrompt } from '@openstage/context-engine'
import { planToReport } from '@openstage/inspector'

export default function InspectorPage(): React.ReactElement {
  const store = useStore.get()
  const char = store.characters.find((c) => c.id === store.activeCharacterId) ?? store.characters[0]
  const [userText, setUserText] = useState('你好，聊聊古籍')
  if (!char) return <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>请先导入角色卡。</div>
  const kb = store.knowledgeByChar[char.id]
  const plan = compilePrompt({
    conversationId: 'inspector-preview',
    recipeId: 'compat-st-default',
    persona: '你',
    charName: char.identity.name,
    charDescription: char.identity.description,
    charPersonality: char.identity.personality,
    scenario: char.identity.scenario,
    knowledge: kb ? kb.entries : [],
    dialogue: [{ role: 'user', name: '你', content: userText }],
    budget: { contextTokens: 8000, reserveOutput: 1024 },
    turn: 1,
  }).plan
  const report = planToReport(plan)
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Inspector</h2>
      <label style={{ fontSize: 12 }}>预览输入（用于触发 WI）</label>
      <input value={userText} onChange={(e) => setUserText(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {report.budget.map((b) => (
          <div key={b.stage} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 11, minWidth: 120 }}>
            <div style={{ fontWeight: 700 }}>{b.stage}</div>
            <div>allotted {b.allotted} · used {b.used} · dropped {b.dropped}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>stable {report.stablePrefixTokens} · volatile {report.volatileTokens} · queries {report.queries.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {report.blocks.map((b) => (
          <div key={b.id} style={{ background: b.included ? '#fff' : '#fef2f2', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 11 }}>
            <div style={{ fontWeight: 600 }}>{b.stage}/{b.slot} · {b.sourceRef.kind}{b.sourceRef.name ? `:${b.sourceRef.name}` : ''} · {b.included ? 'IN' : 'OUT'} · {b.tokenCount} tok</div>
            <div style={{ color: '#374151', whiteSpace: 'pre-wrap', marginTop: 4 }}>{b.contentPreview.slice(0, 160)}</div>
            {(b.inclusionReason || b.exclusionReason) && <div style={{ color: '#9ca3af', marginTop: 4 }}>{b.inclusionReason ?? b.exclusionReason}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
