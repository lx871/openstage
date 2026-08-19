import { describe, expect, it, beforeEach } from 'vitest'
import { create } from '../apps/web/src/lib/mini-store.js'
import * as chatMemory from '../apps/web/src/lib/chat-memory.js'

function memStore(){
  const m=new Map<string,string>()
  const g:any=globalThis
  g.localStorage={getItem(k:string){return m.get(k)??null},setItem(k:string,v:string){m.set(k,v)},removeItem(k:string){m.delete(k)},clear(){m.clear()}}
  return m
}

describe('mini-store',()=>{
  it('get/set/subscribe/use and unsubscribe',()=>{
    const s=create({a:1})
    expect(s.get().a).toBe(1)
    s.set({a:2}); expect(s.get().a).toBe(2)
      s.set((prev)=>({a:(prev as any).a+1})); expect(s.get().a).toBe(3)
    let seen=0; const off=s.subscribe(()=>seen++)
    s.set({a:4}); expect(seen).toBe(1)
    off(); s.set({a:5}); expect(seen).toBe(1)
    expect(s.get().a).toBe(5)
  })
})

describe('chat-memory & store key path',()=>{
  let mem: Map<string,string>
  beforeEach(()=>{mem=memStore()})
  it('save/load/list/delete + index cap 200',()=>{
    expect(chatMemory.listConversations()).toEqual([])
    chatMemory.saveConversation({id:'c1',characterId:'ch1',messages:[{id:'m1',role:'user',blocks:[] as any,at:new Date().toISOString()}],createdAt:new Date().toISOString()})
    expect(chatMemory.listConversations()).toContain('c1')
    expect(chatMemory.loadConversation('c1')!.id).toBe('c1')
    chatMemory.saveConversation({id:'c1',characterId:'ch1',messages:[],createdAt:new Date().toISOString()})
    expect(chatMemory.listConversations().filter(x=>x==='c1').length).toBe(1)
    chatMemory.deleteConversation('c1')
    expect(chatMemory.loadConversation('c1')).toBeNull()
    expect(chatMemory.listConversations()).not.toContain('c1')
  })
  it('too large conversation throws too_large',()=>{
    const big='x'.repeat(1_000_001)
    expect(()=>chatMemory.saveConversation({id:'big',characterId:'ch',messages:[{id:'m',role:'user',blocks:[] as any,at:''}],createdAt:big} as any)).toThrow(/too large/)
    try{chatMemory.saveConversation({id:'big',characterId:'ch',messages:[],createdAt:big} as any)}catch(e:any){expect(e.code).toBe('too_large')}
  })
  it('index cap 200 evicts oldest storage key',()=>{
    for(let i=0;i<201;i++) chatMemory.saveConversation({id:`c${i}`,characterId:'ch',messages:[],createdAt:new Date().toISOString()})
    const idx=chatMemory.listConversations()
    expect(idx.length).toBe(200)
    expect(idx).not.toContain('c0')
    expect(idx).toContain('c200')
    expect(mem.has('openstage.conv.c0')).toBe(false)
  })
  it('loadConversation corrupted JSON returns null',()=>{
    mem.set('openstage.conv.bad','{bad')
    expect(chatMemory.loadConversation('bad')).toBeNull()
    mem.set('openstage.conv.index','{bad')
    expect(chatMemory.listConversations()).toEqual([])
  })
  it('store.ts load/save via localStorage openstage.state.v1',async()=>{
    mem.clear()
    const {useStore} = await import('../apps/web/src/lib/store.js')
    expect(useStore.get().settings.offline).toBe(true)
    useStore.set({...useStore.get(), activeCharacterId:'char1'})
    const raw=mem.get('openstage.state.v1')
    expect(raw).toBeDefined()
    expect(JSON.parse(raw!).activeCharacterId).toBe('char1')
  })
})
