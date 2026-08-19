import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store.js'
import { deleteConversation, listConversations, loadConversation, saveConversation, type Conversation } from '../lib/chat-memory.js'
import { compilePrompt } from '@openstage/context-engine'
import { planToReport } from '@openstage/inspector'
import { createOpenAICompatibleAdapter } from '@openstage/gateway'

function uid(): string { return Math.random().toString(36).slice(2, 10) }

export default function ChatPage(): React.ReactElement {
  const store = useStore.get()
  const chars = store.characters
  const activeChar = chars.find((c) => c.id === store.activeCharacterId) ?? chars[0]
  const [conv, setConv] = useState<Conversation | null>(() => {
    const cid = store.activeConversationId
    return cid ? loadConversation(cid) : null
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conv?.messages.length])

  const ensureConv = (): Conversation => {
    if (conv) return conv
    if (!activeChar) throw new Error('no character')
    const c: Conversation = { id: uid(), characterId: activeChar.id, messages: [], createdAt: new Date().toISOString() }
    if (activeChar.presentation.guide.greetingCandidates[0]) {
      c.messages.push({ id: uid(), role: 'assistant', name: activeChar.identity.name, blocks: [{ type: 'text', text: activeChar.presentation.guide.greetingCandidates[0].text() }], at: new Date().toISOString() })
    }
    saveConversation(c); setConv(c)
    useStore.set((s) => ({ ...s, activeConversationId: c.id }))
    return c
  }

  const [streamingText, setStreamingText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const stop = (): void => { abortRef.current?.abort(); abortRef.current = null; setBusy(false) }

  const send = async (): Promise<void> => {
    const text = input.trim(); if (!text || !activeChar) return
    setInput(''); setBusy(true); setStreamingText('')
    const ac = new AbortController(); abortRef.current = ac
    try {
      const c = ensureConv()
      const next: Conversation = { ...c, messages: [...c.messages, { id: uid(), role: 'user', name: '你', blocks: [{ type: 'text', text }], at: new Date().toISOString() }] }
      saveConversation(next); setConv(next)
      const dialogue = next.messages.map((m) => ({ role: m.role as 'user' | 'assistant', name: m.name, content: m.blocks.map((b) => b.type === 'text' ? b.text : '').join('') }))
      const kb = store.knowledgeByChar[activeChar.id]
      const plan = compilePrompt({
        conversationId: next.id,
        recipeId: 'compat-st-default',
        persona: '你',
        charName: activeChar.identity.name,
        charDescription: activeChar.identity.description,
        charPersonality: activeChar.identity.personality,
        scenario: activeChar.identity.scenario,
        knowledge: kb ? kb.entries : [],
        dialogue,
        budget: { contextTokens: 8000, reserveOutput: 1024 },
        turn: dialogue.length,
      }).plan
      const report = planToReport(plan)
      const system = report.blocks.filter((b) => b.slot === 'systemPrompt' && b.included).map((b) => b.contentPreview).join('\n')
      const adapter = createOpenAICompatibleAdapter({ offline: store.settings.offline, endpoint: store.settings.endpoint, model: store.settings.model })
      const req = adapter.createChatRequest({ system, dialogue: dialogue.slice(-12).map((d) => ({ role: d.role === 'assistant' ? 'assistant' : 'user', name: d.name, content: d.content })) })
      let reply = ''
      for await (const ch of adapter.stream(req, { signal: ac.signal })) {
        if (ch.kind === 'text' && ch.text) { reply += ch.text; setStreamingText(reply) }
        if (ch.kind === 'done') break
      }
      if (!reply) {
        const r = await adapter.complete(req); reply = r.text
      }
      setStreamingText('')
      const final: Conversation = { ...next, messages: [...next.messages, { id: uid(), role: 'assistant', name: activeChar.identity.name, blocks: [{ type: 'text', text: reply || '（无回复）' }], at: new Date().toISOString() }] }
      saveConversation(final); setConv(final)
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') setStreamingText('')
    } finally { setBusy(false); abortRef.current = null; setStreamingText('') }
  }

  const [showSessions, setShowSessions] = useState(false)
  const sessions = listConversations()

  if (!activeChar) return <div style={{ padding: 24 }}>请先在“角色”页导入一张卡片。</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>{activeChar.identity.name}</strong>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{activeChar.identity.scenario.slice(0, 48)}</span>
        <button onClick={() => setShowSessions((v) => !v)} style={{ marginLeft: 'auto', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', background: '#fff' }}>会话 {sessions.length ? `(${sessions.length})` : ''}</button>
        <span style={{ fontSize: 11, color: store.settings.offline ? '#059669' : '#2563eb' }}>{store.settings.offline ? 'offline' : store.settings.model}</span>
      </header>
      {showSessions && (
        <div style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { const c = { id: uid(), characterId: activeChar.id, messages: [], createdAt: new Date().toISOString() } as Conversation; if (activeChar.presentation.guide.greetingCandidates[0]) c.messages.push({ id: uid(), role: 'assistant', name: activeChar.identity.name, blocks: [{ type: 'text', text: activeChar.presentation.guide.greetingCandidates[0].text() }], at: new Date().toISOString() }); saveConversation(c); setConv(c); useStore.set((s) => ({ ...s, activeConversationId: c.id })) }} style={sessBtn}>+ 新建</button>
          </div>
          {sessions.map((id) => {
            const c = loadConversation(id)
            return (
              <div key={id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, border: conv?.id === id ? '1px solid #111827' : '1px solid #e5e7eb', borderRadius: 6, padding: '4px 6px', background: conv?.id === id ? '#f9fafb' : '#fff' }}>
                <button onClick={() => { const loaded = loadConversation(id); if (loaded) { setConv(loaded); useStore.set((s) => ({ ...s, activeConversationId: id })) } }} style={{ ...sessBtn, flex: 1, textAlign: 'left' }}>{c ? `${c.messages[0]?.blocks[0] ? String((c.messages[0].blocks[0] as { text: string }).text).slice(0, 18) : id.slice(0, 6)}… (${c.messages.length})` : id}</button>
                <button onClick={() => { deleteConversation(id); if (conv?.id === id) setConv(null) }} style={sessBtn}>删除</button>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(conv?.messages ?? []).map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%', background: m.role === 'user' ? '#111827' : '#fff', color: m.role === 'user' ? '#fff' : '#111827', border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 10px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{m.name ?? m.role}</div>
            {m.blocks.map((b, i) => b.type === 'text' ? <div key={i}>{b.text}</div> : <div key={i} style={{ fontSize: 11, color: '#9ca3af' }}>[{b.type}]</div>)}
          </div>
        ))}
        {busy && streamingText && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '78%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 10px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{activeChar.identity.name} ▊</div>
            <div>{streamingText}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder="输入消息，回车发送" style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', fontSize: 13 }} disabled={busy} />
        {busy ? <button onClick={stop} style={{ background: '#dc2626', color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>停止</button>
          : <button onClick={() => void send()} disabled={!input.trim()} style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>发送</button>}
      </div>
    </div>
  )
}
