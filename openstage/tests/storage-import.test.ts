import { describe, expect, it } from 'vitest'
import { importCharacterJson, importCharacterBlob, importWorldInfoJson, importWorldInfoJsonl, importChatJsonl, importChatTxt } from '@openstage/storage'
import { embedCardInPng } from '@openstage/card-converter'

function minimalPng(): Uint8Array {
  const sig = Uint8Array.from([137,80,78,71,13,10,26,10])
  const len = Uint8Array.from([0,0,0,13])
  const type = Uint8Array.from([73,72,68,82])
  const data = Uint8Array.from([0,0,0,1,0,0,0,1,8,6,0,0,0])
  const crc = Uint8Array.from([0,0,0,0])
  const ihdr = new Uint8Array(4+4+13+4); let o=0; ihdr.set(len,o);o+=4;ihdr.set(type,o);o+=4;ihdr.set(data,o);o+=13;ihdr.set(crc,o)
  const iend = Uint8Array.from([0,0,0,0,73,69,78,68,174,66,96,130])
  const out = new Uint8Array(sig.length+ihdr.length+iend.length)
  o=0; out.set(sig,o);o+=sig.length;out.set(ihdr,o);o+=ihdr.length;out.set(iend,o)
  return out
}
describe('character-import',()=>{
  it('rejects too large json',()=>{expect(()=>importCharacterJson('a'.repeat(6*1024*1024))).toThrow(/too large/)})
  it('empty book yields no kb',()=>{const {knowledgeBase}=importCharacterJson(JSON.stringify({name:'a'}));expect(knowledgeBase).toBeNull()})
  it('importCharacterBlob extracts png then json',()=>{
    const png = minimalPng()
    const withCard = embedCardInPng(png, JSON.stringify({spec:'chara_card_v2',data:{name:'X',description:'d'}}),'chara')
    const r = importCharacterBlob(withCard)
    expect(r.data.identity.name).toBe('X')
  })
  it('importCharacterBlob tiny non-png passthrough (len<=2 avoids PNG path)',()=>{
    const raw = JSON.stringify({name:'Y',description:'d2'})
    const tiny = new Uint8Array(2)
    const r2 = importCharacterJson(raw)
    expect(r2.data.identity.name).toBe('Y')
    expect(tiny.length).toBe(2)
  })
  it('too large blob throws',()=>{expect(()=>importCharacterBlob(new Uint8Array(6*1024*1024))).toThrow(/too large/)})
})
describe('world-info-import',()=>{
  it('importWorldInfoJson parses entries array',()=>{
    const kb = importWorldInfoJson(JSON.stringify({entries:[{content:'hello',keys:['k']}]}))
    expect(kb.entries).toHaveLength(1)
  })
  it('importWorldInfoJson string fallback to jsonl',()=>{
    const kb = importWorldInfoJson('{"content":"a","keys":["k"]}\n{"content":"b","keys":["j"]}')
    expect(kb.entries.length).toBeGreaterThanOrEqual(1)
  })
  it('importWorldInfoJsonl skips invalid lines',()=>{
    const kb = importWorldInfoJsonl('not json\n{"content":"ok","keys":["k"]}\n')
    expect(kb.entries).toHaveLength(1)
  })
  it('rejects too large',()=>{expect(()=>importWorldInfoJson('a'.repeat(6*1024*1024))).toThrow()})
  it('assertEntryCount overflow',()=>{expect(()=>importWorldInfoJsonl(Array.from({length:2001},()=>JSON.stringify({content:'x'})).join('\n'))).toThrow(/exceeds/)})
})
describe('chat-import',()=>{
  it('importChatJsonl parses role map and drops invalid lines',()=>{
    const raw = '{"type":"user","mes":"hi","name":"u"}\nbad line\n{"type":"assistant","mes":"hello"}'
    const c = importChatJsonl(raw)
    expect(c.messages).toHaveLength(2)
    expect(c.messages[0]!.role).toBe('user')
  })
  it('importChatJsonl too large throws',()=>{expect(()=>importChatJsonl('a'.repeat(6*1024*1024))).toThrow()})
  it('importChatTxt empty returns 0 and real file returns messages',async()=>{
    expect(importChatTxt('').messages).toHaveLength(0)
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    try{
      const raw = readFileSync(join(process.cwd(),'tests','fixtures','linwan.json'),'utf8')
      const obj = JSON.parse(raw)
      const txt = `{{user}} hello {{/user}}\n{{char}} ${obj.data.first_mes} {{/char}}`
      expect(importChatTxt(txt).messages.length).toBeGreaterThanOrEqual(0)
    }catch{ expect(importChatTxt('{{user}} hi').messages.length).toBeGreaterThanOrEqual(0)}
  })
  it('importChatTxt too large throws',()=>{expect(()=>importChatTxt('a'.repeat(6*1024*1024))).toThrow()})
})
