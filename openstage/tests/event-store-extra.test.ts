import { describe, expect, it } from 'vitest'
import { EventStore } from '@openstage/storage'
import { applyDelta, emptyScopedState, cloneState } from '../packages/domain/src/state.js'
import { createKnowledgeRepo, addKnowledgeBase, linkCharacterKb, entriesForCharacter } from '@openstage/storage'
describe('EventStore extra',()=>{
  it('appendMessages with invalid parent still records event (no validation at store layer)',async()=>{
    const s=new EventStore();await s.execute({type:'createConversation',conversationId:'c1',characterIds:[]})
    const r=await s.execute({type:'appendMessages',conversationId:'c1',parentId:'nope',messages:[{role:'user',blocks:[{type:'text',text:'hi'}]}]})
    expect(r.ok).toBe(true)
    const snap=await s.replay('c1')
    expect(snap).not.toBeNull()
  })
  it('setBranch empty path still records event at store layer',async()=>{
    const s=new EventStore();await s.execute({type:'createConversation',conversationId:'c2',characterIds:[]})
    await s.execute({type:'appendMessages',conversationId:'c2',parentId:null,messages:[{role:'user',blocks:[{type:'text',text:'a'}]}]})
    const r=await s.execute({type:'setBranch',conversationId:'c2',path:[]})
    expect(r.ok).toBe(true)
  })
  it('replay unknown returns null and stream fromSeq filter',async()=>{
    const s=new EventStore();expect(await s.replay('none')).toBeNull()
    await s.execute({type:'createConversation',conversationId:'cx',characterIds:[]})
    expect(s.stream('cx',9999)).toHaveLength(0)
    expect(s.stream('cx',1)).toHaveLength(1)
  })
  it('unsupported command returns error',async()=>{const s=new EventStore();const r=await s.execute({type:'importCharacter'} as any);expect(r.ok).toBe(false)})
})
describe('state deltas',()=>{
  it('set/unset/increment/append',()=>{
    const st=emptyScopedState();applyDelta(st,{scope:'conversation',key:'mood',op:'set',value:'happy',opId:'1'})
    expect(st.conversation['mood']).toBe('happy')
    applyDelta(st,{scope:'conversation',key:'mood',op:'unset',opId:'2'})
    expect(st.conversation['mood']).toBeUndefined()
    applyDelta(st,{scope:'conversation',key:'n',op:'increment',value:2,opId:'3'})
    applyDelta(st,{scope:'conversation',key:'n',op:'increment',opId:'4'})
    expect(st.conversation['n']).toBe(3)
    applyDelta(st,{scope:'conversation',key:'arr',op:'append',value:'a',opId:'5'})
    applyDelta(st,{scope:'conversation',key:'arr',op:'append',value:'b',opId:'6'})
    expect(st.conversation['arr']).toEqual(['a','b'])
  })
  it('cloneState deep',()=>{const s=emptyScopedState();s.conversation['x']=[1];const c=cloneState(s);(c.conversation['x'] as any).push(2);expect(s.conversation['x']).toEqual([1])})
})
describe('knowledge repo fallback',()=>{
  it('entriesForCharacter via knowledgeEntryIds fallback',()=>{
    const repo=createKnowledgeRepo()
    const kb={id:'kb1',name:'kb',entries:[{id:'e1',type:'fact',enabled:true,content:'c',activation:{mode:'keyword',keyword:{primary:['k'],secondary:[],combinator:'OR',caseSensitive:false,wholeWord:false,useRegex:false},time:{sticky:false,probability:1,reinsert:'after'},injection:{position:'beforeChar',depth:0,order:1,force:false}},relationTargets:[],unknownFields:{}} as any],vectorized:false} as any
    addKnowledgeBase(repo,kb)
    const char={id:'ch1',knowledgeEntryIds:['e1']} as any
    expect(entriesForCharacter(repo,char)).toHaveLength(1)
    linkCharacterKb(repo,'ch1',null)
    expect(entriesForCharacter(repo,{id:'no',knowledgeEntryIds:[]} as any)).toEqual([])
  })
})
