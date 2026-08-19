import { describe, expect, it } from 'vitest'
import { estimateTokens, budgetDrop, stableKey } from '@openstage/context-engine'
import { presetToBlockSpecs } from '@openstage/context-engine'
import { compilePrompt } from '@openstage/context-engine'
describe('counting',()=>{
  it('estimateTokens empty 0 and CJK vs latin',()=>{expect(estimateTokens('')).toBe(0);expect(estimateTokens('hello world')).toBeGreaterThan(0);expect(estimateTokens('你好世界')).toBeGreaterThan(estimateTokens('hi'))})
  it('budgetDrop keeps within budget',()=>{const r=budgetDrop('a'.repeat(1000),10);expect(r.dropped).toBe(1);expect(r.kept.length).toBeLessThan(1000);expect(budgetDrop('hi',100).dropped).toBe(0)})
  it('stableKey deterministic',()=>{expect(stableKey({role:'user',content:'hi',order:1})).toBe('user|hi|1')})
})
describe('presetToBlockSpecs',()=>{
  it('handles array and object order/blocks',()=>{
    expect(presetToBlockSpecs([])).toEqual([])
    expect(presetToBlockSpecs({order:[{id:'a',role:'user',content:'hi'}]}).length).toBe(1)
    expect(presetToBlockSpecs({promptManager:[{order:[{id:'b'}]}]}).length).toBe(1)
    expect(presetToBlockSpecs({blocks:[{id:'c'}]}).length).toBe(1)
    expect(presetToBlockSpecs(null)).toEqual([])
  })
  it('disabled excluded and unknown role defaults to system',()=>{
    const specs = presetToBlockSpecs([{id:'x',disabled:true,role:'unknown',injection_slots:['systemPrompt','bogus']}])
    expect(specs[0]!.includedInPrompt).toBe(false)
    expect(specs[0]!.role).toBe('system')
    expect(specs[0]!.injectionSlots).toEqual(['systemPrompt'])
  })
})
describe('builder edge',()=>{
  it('wi disabled skips lore',()=>{
    const r=compilePrompt({conversationId:'c',recipeId:'r',persona:'',charName:'A',charDescription:'d',charPersonality:'',scenario:'',knowledge:[{id:'k1',type:'fact',enabled:true,content:'lore',activation:{mode:'keyword',keyword:{primary:['hi'],secondary:[],combinator:'OR',caseSensitive:false,wholeWord:false,useRegex:false},time:{sticky:false,probability:1,reinsert:'after'},injection:{position:'beforeChar',depth:0,order:1,force:false}},relationTargets:[],unknownFields:{}} as any],dialogue:[{role:'user',content:'hi'}],budget:{contextTokens:8000,reserveOutput:1024},turn:1,wi:{disabled:true}})
    expect(r.plan.queries).toHaveLength(0)
  })
  it('empty persona/dialogue not crash and history at least 1',()=>{
    const r=compilePrompt({conversationId:'c2',recipeId:'r',persona:'',charName:'',charDescription:'',charPersonality:'',scenario:'',knowledge:[],dialogue:[{role:'user',content:'a'.repeat(5000)}],budget:{contextTokens:100,reserveOutput:10},turn:1})
    expect(r.plan.blocks.some(b=>b.stage==='history'&&b.included)).toBe(true)
  })
  it('macro unresolved reported',()=>{
    const r=compilePrompt({conversationId:'c3',recipeId:'r',persona:'{{unknown}}',charName:'A',charDescription:'',charPersonality:'',scenario:'',knowledge:[],dialogue:[],budget:{contextTokens:8000,reserveOutput:1024},turn:0})
    expect(r.plan.blocks.some(b=>b.exclusionReason?.includes('unresolved'))).toBe(true)
  })
})
