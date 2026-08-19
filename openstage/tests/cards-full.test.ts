import { describe, expect, it } from 'vitest'
import { deflate } from 'pako'
import { extractPngTextChunk, readIntBE, parseCharacterJson } from '@openstage/storage'
import { convertJsonString, convertPngBytes, convertRaw, exportToJson, exportToPng, embedCardInPng, normalizeRaw, detectVersion } from '@openstage/card-converter'

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
function buildChunk(typeStr: string, data: Uint8Array): Uint8Array {
  const type = new TextEncoder().encode(typeStr)
  const len = data.length
  const chunk = new Uint8Array(4+4+len+4)
  chunk[0]=(len>>>24)&0xff;chunk[1]=(len>>>16)&0xff;chunk[2]=(len>>>8)&0xff;chunk[3]=len&0xff
  chunk.set(type,4); chunk.set(data,8)
  const combined = new Uint8Array(4+len); combined.set(type,0); combined.set(data,4)
  let crc=0xffffffff; for(const b of combined){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1}
  crc=(crc^0xffffffff)>>>0
  chunk[8+len]=(crc>>>24)&0xff;chunk[8+len+1]=(crc>>>16)&0xff;chunk[8+len+2]=(crc>>>8)&0xff;chunk[8+len+3]=crc&0xff
  return chunk
}
function insertBeforeIEND(png: Uint8Array, chunk: Uint8Array): Uint8Array {
  const iendPos = png.length-12
  const out = new Uint8Array(png.length+chunk.length)
  out.set(png.subarray(0,iendPos),0); out.set(chunk,iendPos); out.set(png.subarray(iendPos),iendPos+chunk.length)
  return out
}
function textChunk(keyword: string, text: string): Uint8Array {
  const kb=new TextEncoder().encode(keyword), tb=new TextEncoder().encode(text)
  const d=new Uint8Array(kb.length+1+tb.length); d.set(kb,0); d[kb.length]=0; d.set(tb,kb.length+1)
  return buildChunk('tEXt', d)
}
function zTXtChunk(keyword: string, json: string): Uint8Array {
  const kb=new TextEncoder().encode(keyword), comp=deflate(new TextEncoder().encode(json))
  const d=new Uint8Array(kb.length+1+1+comp.length); d.set(kb,0); d[kb.length]=0; d[kb.length+1]=0; d.set(comp,kb.length+2)
  return buildChunk('zTXt', d)
}
function iTXtCompressed(keyword: string, json: string): Uint8Array {
  const kb=new TextEncoder().encode(keyword), comp=deflate(new TextEncoder().encode(json))
  const header=new Uint8Array(kb.length+1+1+1+1+1+comp.length)
  let p=0; header.set(kb,p); p+=kb.length; header[p++]=0; header[p++]=1; header[p++]=0; header[p++]=0; header[p++]=0; header.set(comp,p)
  return buildChunk('iTXt', header)
}
function iTXtUncompressed(keyword: string, json: string): Uint8Array {
  const kb=new TextEncoder().encode(keyword), tb=new TextEncoder().encode(json)
  const d=new Uint8Array(kb.length+1+1+1+1+1+tb.length)
  let p=0; d.set(kb,p); p+=kb.length; d[p++]=0; d[p++]=0; d[p++]=0; d[p++]=0; d[p++]=0; d.set(tb,p)
  return buildChunk('iTXt', d)
}

describe('cards V1/V2/V3/unknown/空/非法',()=>{
  it('V1 spec vera',()=>{
    const r=convertJsonString(JSON.stringify({spec:'chara_card_v1',data:{name:'V1N',description:'d'}}))
    expect(r.sourceVersion).toBe('v1')
  })
  it('V1 flat only name+description',()=>{
    const r=convertJsonString(JSON.stringify({name:'FlatV1',description:'d1'}))
    expect(r.sourceVersion).toBe('v1')
    expect(r.character.identity.name).toBe('FlatV1')
  })
  it('V2 flat with first_mes',()=>{
    const r=convertJsonString(JSON.stringify({name:'F2',description:'d',first_mes:'hi'}))
    expect(r.sourceVersion).toBe('v2')
  })
  it('V2 spec+data',()=>{
    const r=convertJsonString(JSON.stringify({spec:'chara_card_v2',spec_version:'2.0',data:{name:'V2',description:'d',personality:'p',scenario:'s',first_mes:'hi',mes_example:'',tags:['a']}}))
    expect(r.sourceVersion).toBe('v2')
    expect(r.character.identity.name).toBe('V2')
  })
  it('V2 data includes character_book -> kb',()=>{
    const raw={spec:'chara_card_v2',data:{name:'KB',description:'d',personality:'',scenario:'',first_mes:'hi',mes_example:'',character_book:{entries:[{keys:['k'],content:'c',enabled:true,insertion_order:100}]}}}
    const r=convertJsonString(JSON.stringify(raw))
    expect(r.knowledgeBase).not.toBeNull()
    expect(r.knowledgeBase!.entries.length).toBe(1)
    expect(r.character.knowledgeEntryIds.length).toBe(1)
  })
  it('V3 import preserves unknownFields and warning',()=>{
    const raw={spec:'chara_card_v3',data:{name:'V3',description:'d',personality:'',scenario:'',first_mes:'hi',mes_example:'',nickname:'nick',character_version:'1.2.3'}}
    const r=convertJsonString(JSON.stringify(raw))
    expect(r.sourceVersion).toBe('v3')
    expect(r.warnings.join()).toMatch(/V3/)
    expect(r.character.unknownFields['nickname']).toBe('nick')
  })
  it('unknown version fallback best-effort',()=>{
    const r=convertJsonString(JSON.stringify({x:1}))
    expect(r.sourceVersion).toBe('unknown')
    expect(r.warnings.join()).toMatch(/unknown/)
  })
  it('empty object unknown',()=>{
    const r=convertRaw({} as any)
    expect(r.sourceVersion).toBe('unknown')
  })
  it('null / array normalized to unknown with warning',()=>{
    expect(normalizeRaw(null).version).toBe('unknown')
    expect(normalizeRaw([] as any).warnings.length).toBeGreaterThan(0)
    expect(normalizeRaw('' as any).version).toBe('unknown')
  })
  it('illegal JSON throws invalid_json with code',()=>{
    expect(()=>convertJsonString('{bad')).toThrow(/invalid JSON/)
    try{convertJsonString('{bad')}catch(e:any){expect(e.code).toBe('invalid_json')}
  })
  it('illegal png missing IEND throws',()=>{
    expect(()=>embedCardInPng(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]),'{}')).toThrow(/IEND/)
  })
  it('detectVersion branches',()=>{
    expect(detectVersion({spec:'chara_card_v3'} as any)).toBe('v3')
    expect(detectVersion({spec:'chara_card_v1'} as any)).toBe('v1')
    expect(detectVersion({name:'a',description:'d'} as any)).toBe('v1')
    expect(detectVersion({x:1} as any)).toBe('unknown')
    expect(detectVersion({data:{name:'a',description:'d'}} as any)).toBe('v2')
  })
})

describe('PNG tEXt/zTXt/iTXt/base64/超限/空',()=>{
  it('tEXt chara raw JSON',()=>{
    const p=insertBeforeIEND(minimalPng(), textChunk('chara','{"name":"t"}'))
    const c=extractPngTextChunk(p)
    expect(c[0]).toBe('{"name":"t"}')
    const r=convertPngBytes(p); expect(r.character.identity.name).toBe('t')
  })
  it('tEXt ccv3 keyword',()=>{
    const p=insertBeforeIEND(minimalPng(), textChunk('ccv3','{"name":"cc3"}'))
    expect(extractPngTextChunk(p)[0]).toBe('{"name":"cc3"}')
    expect(convertPngBytes(p).character.identity.name).toBe('cc3')
  })
  it('tEXt base64 JSON decoded',()=>{
    const json='{"name":"b64","description":"d"}'
    const b64=Buffer.from(json).toString('base64')
    const p=insertBeforeIEND(minimalPng(), textChunk('chara',b64))
    const c=extractPngTextChunk(p)
    expect(JSON.parse(c[0]!).name).toBe('b64')
    expect(convertPngBytes(p).character.identity.name).toBe('b64')
  })
  it('tEXt non-base64 passthrough trimmed',()=>{
    const p=insertBeforeIEND(minimalPng(), textChunk('chara','  {"name":"trim"}  '))
    expect(extractPngTextChunk(p)[0]).toBe('{"name":"trim"}')
  })
  it('zTXt chara decompress',()=>{
    const json='{"name":"z","description":"d","first_mes":"hi"}'
    const p=insertBeforeIEND(minimalPng(), zTXtChunk('chara',json))
    const c=extractPngTextChunk(p)
    expect(JSON.parse(c[0]!).name).toBe('z')
    expect(convertPngBytes(p).character.identity.name).toBe('z')
  })
  it('iTXt compressed chara',()=>{
    const json='{"name":"itxtC","description":"d"}'
    const p=insertBeforeIEND(minimalPng(), iTXtCompressed('chara',json))
    const c=extractPngTextChunk(p)
    expect(JSON.parse(c[0]!).name).toBe('itxtC')
  })
  it('iTXt uncompressed chara',()=>{
    const json='{"name":"itxtU","description":"d"}'
    const p=insertBeforeIEND(minimalPng(), iTXtUncompressed('chara',json))
    expect(extractPngTextChunk(p)[0]).toBe(json)
  })
  it('iTXt ccv3 uncompressed',()=>{
    const json='{"name":"ccv3itxt","description":"d"}'
    const p=insertBeforeIEND(minimalPng(), iTXtUncompressed('ccv3',json))
    expect(extractPngTextChunk(p)[0]).toBe(json)
  })
  it('ignores non-chara keyword for tEXt/zTXt/iTXt',()=>{
    let p=insertBeforeIEND(minimalPng(), textChunk('note','{"name":"x"}'))
    expect(extractPngTextChunk(p)).toEqual([])
    p=insertBeforeIEND(minimalPng(), zTXtChunk('note','{"name":"x"}'))
    expect(extractPngTextChunk(p)).toEqual([])
    p=insertBeforeIEND(minimalPng(), iTXtCompressed('note','{"name":"x"}'))
    expect(extractPngTextChunk(p)).toEqual([])
  })
  it('PNG without chara chunk convertPngBytes throws no_card',()=>{
    expect(()=>convertPngBytes(minimalPng())).toThrow(/no embedded/)
    try{convertPngBytes(minimalPng())}catch(e:any){expect(e.code).toBe('no_card_in_png')}
  })
  it('empty/short buffer returns []',()=>{
    expect(extractPngTextChunk(new Uint8Array([]))).toEqual([])
    expect(extractPngTextChunk(new Uint8Array([1,2,3,4,5]))).toEqual([])
  })
  it('超限 buffer >12M throws file_too_large',()=>{
    expect(()=>extractPngTextChunk(new Uint8Array(13*1024*1024))).toThrow(/too large/)
    try{extractPngTextChunk(new Uint8Array(13*1024*1024))}catch(e:any){expect(e.code).toBe('file_too_large')}
  })
  it('readIntBE large length breaks gracefully',()=>{
    expect(readIntBE(new Uint8Array([0,0,0,5]),0)).toBe(5)
    expect(readIntBE(new Uint8Array([1]),0)).toBe(0)
  })
  it('parseCharacterJson unwrap and edge',()=>{
    expect(parseCharacterJson(JSON.stringify({spec:'chara_card_v2',data:{name:'unwrapped'}}))).toEqual({name:'unwrapped'})
    expect(parseCharacterJson(JSON.stringify([1]))).toEqual({})
    expect(()=>parseCharacterJson('{bad')).toThrow()
  })
  it('exportToJson v2/v3 and exportToPng round-trip',()=>{
    const r=convertJsonString(JSON.stringify({name:'E',description:'d',personality:'p',scenario:'s',first_mes:'hi',mes_example:'ex'}))
    const v2=exportToJson(r.character,r.knowledgeBase,{targetVersion:'v2'})
    expect(JSON.parse(v2).spec).toBe('chara_card_v2')
    const v3=exportToJson(r.character,r.knowledgeBase,{targetVersion:'v3'})
    expect(JSON.parse(v3).spec).toBe('chara_card_v3')
    const png2=exportToPng(minimalPng(), r.character, r.knowledgeBase, {targetVersion:'v2'})
    expect(convertPngBytes(png2).character.identity.name).toBe('E')
    const png3=exportToPng(minimalPng(), r.character, r.knowledgeBase, {targetVersion:'v3'})
    const chunks=extractPngTextChunk(png3)
    expect(chunks[0]).toContain('chara_card_v3')
  })
  it('exportToJson with KB embeds character_book',()=>{
    const r=convertJsonString(JSON.stringify({spec:'chara_card_v2',data:{name:'KB2',description:'d',character_book:{entries:[{keys:['k'],content:'c',enabled:true,insertion_order:10}]}}}))
    const j=JSON.parse(exportToJson(r.character, r.knowledgeBase!, {targetVersion:'v2'}))
    expect(j.data.character_book.entries.length).toBe(1)
  })
})
