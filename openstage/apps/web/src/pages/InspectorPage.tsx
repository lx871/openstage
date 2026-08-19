import { useState } from 'react'
import { useStore } from '../lib/store.js'
import { compilePrompt } from '@openstage/context-engine'
import { planToReport } from '@openstage/inspector'

export default function InspectorPage(): React.ReactElement {
  const store = useStore.use()
  const char = store.characters.find((c) => c.id === store.activeCharacterId) ?? store.characters[0]
  const [userText, setUserText] = useState('\u4F60\u597D\uFF0C\u804A\u804A\u53E4\u7C4D')
  if (!char) return <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>\u8BF7\u5148\u5BFC\u5165\u89D2\u8272\u5361\u3002</div>
  const kb = store.knowledgeByChar[char.id]
  const plan = compilePrompt({
    conversationId: 'inspector-preview',
    recipeId: 'compat-st-default',
    persona: '\u4F60',
    charName: char.identity.name,
    charDescription: char.identity.description,
    charPersonality: char.identity.personality,
    scenario: char.identity.scenario,
    knowledge: kb ? kb.entries : [],
    dialogue: [{ role: 'user', name: '\u4F60', content: userText }],
    budget: { contextTokens: 8000, reserveOutput: 1024 },
    turn: 1,
  }).plan
  const report = planToReport(plan)
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Inspector</h2>
      <label style={{ fontSize: 12 }}>\u9884\u89C8\u8F93\u5165\uFF08\u7528\u4E8E\u89E6\u53D1 WI\uFF09</label>
      <input value={userText} onChange={(e) => setUserText(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {report.budget.map((b) => (
          <div key={b.stage} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 11, minWidth: 120 }}>
            <div style={{ fontWeight: 700 }}>{b.stage}</div>
            <div>allotted {String(b.allotted)} \u00B7 used {String(b.used)} \u00B7 dropped {String(b.dropped)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>stable {String(report.stablePrefixTokens)} \u00B7 volatile {String(report.volatileTokens)} \u00B7 queries {String(report.queries.length)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {report.blocks.map((b) => (
          <div key={b.id} style={{ background: b.included ? '#fff' : '#fef2f2', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 11 }}>
            <div style={{ fontWeight: 600 }}>{b.stage}/{b.slot} \u00B7 {b.sourceRef.kind}{b.sourceRef.name ? ':' + b.sourceRef.name : ''} \u00B7 {b.included ? 'IN' : 'OUT'} \u00B7 {String(b.tokenCount)} tok</div>
            <div style={{ color: '#374151', whiteSpace: 'pre-wrap', marginTop: 4 }}>{b.contentPreview.slice(0, 160)}</div>
            {(b.inclusionReason || b.exclusionReason) && <div style={{ color: '#9ca3af', marginTop: 4 }}>{b.inclusionReason ?? b.exclusionReason}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
