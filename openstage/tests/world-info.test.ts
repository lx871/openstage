import { describe, expect, it } from 'vitest'
import { createWIState, scanEntry, rankEntries, matchKey, deriveWeightedGroup } from '@openstage/context-engine'
import type { KnowledgeEntry } from '@openstage/contracts'
function mkEntry(over: Partial<KnowledgeEntry['activation']>&{title?:string;content?:string;primary?:string[];useRegex?:boolean;wholeWord?:boolean;selectiveLogic?:number;selective?:boolean;probability?:number;group?:{key:string;weight:number}}={}):KnowledgeEntry{
  return {
    id:'id-'+Math.random(),type:'fact',enabled:true,title:over.title??'t',content:over.content??'content',
    activation:{
      mode:'keyword',
      keyword:{primary:over.primary??['hello'],secondary:[],combinator:'OR',caseSensitive:false,wholeWord:over.wholeWord??false,useRegex:over.useRegex??false,scanDepth:2},
      time:{sticky:false,probability:over.probability??1,reinsert:'after'},
      injection:{position:'beforeChar',depth:0,order:1,force:false},
      group:over.group,
    },relationTargets:[],unknownFields:{...(over.selective!==undefined?{selective:over.selective}:{}),...(over.selectiveLogic!==undefined?{selectiveLogic:over.selectiveLogic}:{})}
  }
}
describe('world-info',()=>{
  it('matchKey plain case-insensitive',()=>{const kw:any={useRegex:false,caseSensitive:false,wholeWord:false};expect(matchKey('Hello World','hello',kw)).toBe(true);expect(matchKey('hi','hello',kw)).toBe(false)})
  it('matchKey wholeWord',()=>{const kw:any={useRegex:false,caseSensitive:false,wholeWord:true};expect(matchKey('say hello world','hello',kw)).toBe(true);expect(matchKey('helloworld','hello',kw)).toBe(false)})
  it('matchKey regex valid and ReDoS guards',()=>{
    const kw:any={useRegex:true,caseSensitive:false,wholeWord:false}
    expect(matchKey('abc123','abc\\d+',kw)).toBe(true)
    expect(matchKey('anything','a'.repeat(201),kw)).toBe(false)
    expect(matchKey('anything','a++',kw)).toBe(false)
    expect(matchKey('hi','[unclosed',kw)).toBe(false)
    const long = 'a'.repeat(9000)
    expect(matchKey(long,'a',kw)).toBe(true)
  })
  it('selective modes',()=>{
    const state=createWIState()
    const eOr = mkEntry({primary:['a','b'],title:'or'})
    const eAnd = mkEntry({primary:['a','b'],selective:true,selectiveLogic:3,title:'and'})
    const eNot = mkEntry({primary:['a'],selective:true,selectiveLogic:2,title:'not'})
    expect(scanEntry(eOr,['a'],{turn:1,state,weightedGroup:{}}).skipped).toBe(false)
    expect(scanEntry(eAnd,['a'],{turn:1,state: createWIState(),weightedGroup:{}}).skipped).toBe(true)
    expect(scanEntry(eAnd,['a b'],{turn:1,state:createWIState(),weightedGroup:{}}).skipped).toBe(false)
    expect(scanEntry(eNot,['x'],{turn:1,state:createWIState(),weightedGroup:{}}).skipped).toBe(false)
    expect(scanEntry(eNot,['a'],{turn:1,state:createWIState(),weightedGroup:{}}).skipped).toBe(true)
  })
  it('probability drop when random above threshold',()=>{
    const e = mkEntry({probability:0.5})
    const r = scanEntry(e,['hello'],{turn:1,state:createWIState(),weightedGroup:{},random:()=>0.9})
    expect(r.skipped).toBe(true);expect(r.reason).toMatch(/probability/)
  })
  it('group weight suppression',()=>{
    const eLow = mkEntry({primary:['hello'],group:{key:'g',weight:1},title:'low'})
    const eHigh = mkEntry({primary:['hello'],group:{key:'g',weight:10},title:'high'})
    const wg = deriveWeightedGroup([eLow,eHigh])
    expect(wg['g']).toBe(10)
    const r = scanEntry(eLow,['hello'],{turn:1,state:createWIState(),weightedGroup:wg})
    expect(r.skipped).toBe(true)
  })
  it('empty primary yields wildcard *',()=>{
    const e = mkEntry({primary:[]}); (e.activation.keyword as any).secondary=[]
    const r = scanEntry(e,['anything'],{turn:1,state:createWIState(),weightedGroup:{}})
    expect(r.skipped).toBe(false);expect(r.matchedKeys).toContain('*')
  })
  it('rankEntries sorts by order then score and filters skipped',()=>{
    const a=mkEntry({title:'a'}); a.activation.injection.order=2
    const b=mkEntry({title:'b'}); b.activation.injection.order=1
    const ranked = rankEntries([a,b],['hello'],{turn:1,state:createWIState(),weightedGroup:{}})
    expect(ranked[0]!.entry.title).toBe('a')
  })
})
