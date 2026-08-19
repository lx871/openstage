import { describe, expect, it } from 'vitest'
import { macroEval, engineMacroContext, CONTEXT_MACROS } from '@openstage/context-engine'
describe('macros',()=>{
  it('expands known and reports remaining',()=>{const {expanded,remaining}=macroEval('hi {{char}} {{missing}}', {char:'A'});expect(expanded).toBe('hi A {{missing}}');expect(remaining).toContain('missing')})
  it('handles non-string var via String()',()=>{expect(macroEval('{{n}}', {n:42}).expanded).toBe('42')})
  it('ignores malformed {{}}',()=>{expect(macroEval('{{}} {{ char }}', {char:'x'}).expanded).toBe('{{}} x')})
  it('engineMacroContext adds engine',()=>{expect(engineMacroContext({a:1}).engine).toBe('openstage-esr')})
  it('CONTEXT_MACROS has expected keys',()=>{expect(CONTEXT_MACROS['{{char}}']).toBeDefined();expect(CONTEXT_MACROS['{{roll}}']).toBeDefined()})
  it('empty template',()=>{expect(macroEval('',{}).expanded).toBe('')})
})
