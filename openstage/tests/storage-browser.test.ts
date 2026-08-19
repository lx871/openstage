import { describe, expect, it } from 'vitest'
import { SqliteEventStore as BrowserStore } from '../packages/storage/src/sqlite-store.browser.js'
import { assertSafeImportBuffer, assertEntryCount, assertFileSizeWithinLimit, assertWithinRoot } from '../packages/storage/src/validate-path.browser.js'
import { importCharacterBlob, importCharacterJson, importCharacterObj } from '../packages/storage/src/character-import.browser.js'
import { importWorldInfoJson, importWorldInfoJsonl } from '../packages/storage/src/world-info-import.browser.js'
import { extractPngTextChunk } from '../packages/storage/src/codecs.js'
import { embedCardInPng } from '../packages/card-converter/src/png.js'

function png():Uint8Array{const sig=Uint8Array.from([137,80,78,71,13,10,26,10]);const len=Uint8Array.from([0,0,0,13]);const type=Uint8Array.from([73,72,68,82]);const data=Uint8Array.from([0,0,0,1,0,0,0,1,8,6,0,0,0]);const crc=Uint8Array.from([0,0,0,0]);const ihdr=new Uint8Array(4+4+13+4);let o=0;ihdr.set(len,o);o+=4;ihdr.set(type,o);o+=4;ihdr.set(data,o);o+=13;ihdr.set(crc,o);const iend=Uint8Array.from([0,0,0,0,73,69,78,68,174,66,96,130]);const out=new Uint8Array(sig.length+ihdr.length+iend.length);o=0;out.set(sig,o);o+=sig.length;out.set(ihdr,o);o+=ihdr.length;out.set(iend,o);return out}

describe('storage browser smoke',()=>{
  it('SqliteEventStore browser stub delegates to mem',async()=>{
    const s=new BrowserStore({file:':memory:'})
    expect(s.filePath).toBe(':memory:')
    const r=await s.execute({type:'createConversation',payload:{title:'hi'}, conversationId:'c1'} as any)
    expect(s.latestSeq()).toBeGreaterThanOrEqual(0)
    expect(s.stream().length).toBeGreaterThanOrEqual(0)
    expect(await s.replay('unknown-id')).toBeNull()
    expect(await s.load('unknown-id')).toBeNull()
    s.close()
  })
  it('validate-path.browser no-ops and limits',()=>{
    expect(()=>assertFileSizeWithinLimit('a',999)).not.toThrow()
    expect(()=>assertWithinRoot('a','b')).not.toThrow()
    expect(()=>assertSafeImportBuffer(new Uint8Array([1,2]),10)).not.toThrow()
    expect(()=>assertSafeImportBuffer(new Uint8Array(6),5)).toThrow(/too large/)
    expect(()=>assertEntryCount(5,10)).not.toThrow()
    expect(()=>assertEntryCount(11,10)).toThrow(/exceeds/)
  })
  it('character-import.browser JSON / Blob PNG',()=>{
    const r1=importCharacterJson(JSON.stringify({name:'B',description:'d'}))
    expect(r1.data.identity.name).toBe('B')
    expect(r1.knowledgeBase).toBeNull()
    const withPng=embedCardInPng(png(),'{"name":"P2","description":"d"}','chara')
    const r2=importCharacterBlob(withPng)
    expect(r2.data.identity.name).toBe('P2')
  })
  it('character-import.browser Blob without chara throws invalid_card',()=>{
    const bad=png()
    expect(()=>importCharacterBlob(bad)).toThrow(/PNG card missing/)
  })
  it('character-import.browser overly large JSON throws',()=>{
    expect(()=>importCharacterJson('x'.repeat(6*1024*1024))).toThrow(/too large/)
  })
  it('character-import.browser with character_book KB',()=>{
    const raw={name:'KB',description:'d',character_book:{entries:[{keys:['k'],content:'c',enabled:true,insertion_order:1}]}}
    const r=importCharacterObj(raw as any)
    expect(r.knowledgeBase!.entries.length).toBe(1)
    const tooMany={name:'x',description:'d',character_book:{entries:Array.from({length:2001},()=>({keys:['k'],content:'c'}))}}
    expect(()=>importCharacterObj(tooMany as any)).toThrow(/exceeds/)
  })
  it('world-info-import.browser Jsonl/Json',()=>{
    const jl='{"keys":["a"],"content":"c"}\ninvalid\n{"keys":["b"],"content":"c2"}'
    const kb=importWorldInfoJsonl(jl,'test')
    expect(kb.entries.length).toBe(2)
    const j=JSON.stringify({entries:[{keys:['k'],content:'c'}]})
    expect(importWorldInfoJson(j).entries.length).toBe(1)
    expect(importWorldInfoJson(jl).entries.length).toBe(2)
    expect(()=>importWorldInfoJsonl('x'.repeat(6*1024*1024))).toThrow(/too large/)
    expect(()=>importWorldInfoJson('x'.repeat(6*1024*1024))).toThrow(/too large/)
  })
  it('index.browser re-exports codecs',()=>{
    expect(extractPngTextChunk(png()).length).toBe(0)
  })
})
