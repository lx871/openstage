import { describe, expect, it } from 'vitest'
import { detectVersion, normalizeRaw } from '@openstage/card-converter'
import { convertJsonString, convertPngBytes, exportToJson, exportToPng } from '@openstage/card-converter'
import { embedCardInPng } from '@openstage/card-converter'
function png():Uint8Array{const sig=Uint8Array.from([137,80,78,71,13,10,26,10]);const len=Uint8Array.from([0,0,0,13]);const type=Uint8Array.from([73,72,68,82]);const data=Uint8Array.from([0,0,0,1,0,0,0,1,8,6,0,0,0]);const crc=Uint8Array.from([0,0,0,0]);const ihdr=new Uint8Array(4+4+13+4);let o=0;ihdr.set(len,o);o+=4;ihdr.set(type,o);o+=4;ihdr.set(data,o);o+=13;ihdr.set(crc,o);const iend=Uint8Array.from([0,0,0,0,73,69,78,68,174,66,96,130]);const out=new Uint8Array(sig.length+ihdr.length+iend.length);o=0;out.set(sig,o);o+=sig.length;out.set(ihdr,o);o+=ihdr.length;out.set(iend,o);return out}
describe('detect',()=>{
  it('detects v1/v2/v3/unknown',()=>{
    expect(detectVersion({spec:'chara_card_v3'})).toBe('v3')
    expect(detectVersion({spec:'chara_card_v2'})).toBe('v2')
    expect(detectVersion({spec:'chara_card_v1'})).toBe('v1')
    expect(detectVersion({name:'a',description:'d',first_mes:'hi'} as any)).toBe('v2')
    expect(detectVersion({name:'a',description:'d'} as any)).toBe('v1')
    expect(detectVersion({x:1} as any)).toBe('unknown')
    expect(detectVersion({data:{name:'a',description:'d'}} as any)).toBe('v2')
  })
  it('normalizeRaw invalid returns unknown',()=>{
    expect(normalizeRaw(null).version).toBe('unknown')
    expect(normalizeRaw([] as any).warnings.length).toBeGreaterThan(0)
    expect(normalizeRaw({spec:'unknown',name:'a'} as any).version).toBe('unknown')
  })
})
describe('converter edge',()=>{
  it('invalid JSON throws invalid_json',()=>{expect(()=>convertJsonString('{bad')).toThrow(/invalid JSON/)})
  it('png without card throws',()=>{expect(()=>convertPngBytes(png())).toThrow(/no embedded/)})
  it('png round-trip',()=>{
    const r=convertJsonString(JSON.stringify({name:'P',description:'d',personality:'p',scenario:'s',first_mes:'hi',mes_example:''}))
    const withPng=exportToPng(png(), r.character, r.knowledgeBase, {targetVersion:'v2'})
    const r2=convertPngBytes(withPng)
    expect(r2.character.identity.name).toBe('P')
  })
  it('export v3 spec',()=>{
    const r=convertJsonString(JSON.stringify({name:'Q',description:'d'}))
    const j=exportToJson(r.character, r.knowledgeBase,{targetVersion:'v3'})
    expect(JSON.parse(j).spec).toBe('chara_card_v3')
  })
  it('v1 data path',()=>{
    const r=convertJsonString(JSON.stringify({spec:'chara_card_v1',data:{name:'V1',description:'d1'}}))
    expect(r.sourceVersion).toBe('v1')
  })
  it('embedCardInPng throws if IEND missing',()=>{expect(()=>embedCardInPng(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]),'{}')).toThrow(/IEND/)})
})
