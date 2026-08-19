import { describe, expect, it } from 'vitest'
import { extractPngTextChunk, readIntBE, parseCharacterJson, parseStringMap, optionalString, objOf, arrOf, asNumber } from '@openstage/storage'
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
describe('storage codecs',()=>{
  it('readIntBE out of bounds returns 0',()=>{expect(readIntBE(new Uint8Array([1,2]),0)).toBe(0);expect(readIntBE(new Uint8Array([0,0,0,5]),0)).toBe(5)})
  it('extractPngTextChunk empty/short returns []',()=>{expect(extractPngTextChunk(new Uint8Array([]))).toEqual([]);expect(extractPngTextChunk(new Uint8Array([1,2,3]))).toEqual([])})
  it('throws on too large buffer',()=>{expect(()=>extractPngTextChunk(new Uint8Array(13*1024*1024))).toThrow(/too large/)})
  it('extracts tEXt chara chunk via embedCardInPng',()=>{
    const png = minimalPng()
    const out = embedCardInPng(png,'{"name":"a"}','chara')
    const chunks = extractPngTextChunk(out)
    expect(chunks[0]).toBe('{"name":"a"}')
  })
  it('ignores non-chara keyword',()=>{
    const png = minimalPng()
    const out = embedCardInPng(png,'{"x":1}','note')
    expect(extractPngTextChunk(out)).toEqual([])
  })
  it('parseCharacterJson unwraps spec/data',()=>{
    expect(parseCharacterJson(JSON.stringify({spec:'chara_card_v2',data:{name:'a'}}))).toEqual({name:'a'})
    expect(parseCharacterJson(JSON.stringify({name:'b'}))).toEqual({name:'b'})
    expect(parseCharacterJson(JSON.stringify([1,2]))).toEqual({})
  })
  it('parseCharacterJson throws on invalid JSON',()=>{expect(()=>parseCharacterJson('{bad')).toThrow()})
  it('parseStringMap/optionalString/objOf/arrOf/asNumber boundaries',()=>{
    expect(parseStringMap({a:'v'},['b','a'],'d')).toBe('v')
    expect(parseStringMap({},['a'],'d')).toBe('d')
    expect(optionalString({k:''},['k'])).toBeUndefined()
    expect(optionalString({k:'hi'},['k'])).toBe('hi')
    expect(objOf(null)).toEqual({});expect(objOf([1])).toEqual({});expect(objOf({x:1})).toEqual({x:1})
    expect(arrOf('x')).toEqual([]);expect(arrOf([1])).toEqual([1])
    expect(asNumber(NaN,5)).toBe(5);expect(asNumber(Infinity,5)).toBe(5);expect(asNumber(3)).toBe(3)
  })
})
