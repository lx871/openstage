import { describe, expect, it, afterEach } from 'vitest'
import { validateEndpoint } from '../packages/gateway/src/allowlist.js'
import { createOpenAICompatibleAdapter } from '@openstage/gateway'
describe('allowlist',()=>{
  it('rejects non-https',()=>{expect(()=>validateEndpoint('http://api.openai.com/v1')).toThrow(/https/)})
  it('rejects invalid url',()=>{expect(()=>validateEndpoint('not-a-url')).toThrow(/invalid/)})
  it('rejects private ip and localhost',()=>{expect(()=>validateEndpoint('https://10.0.0.1/v1')).toThrow(/not allowed/);expect(()=>validateEndpoint('https://localhost/v1')).toThrow(/not allowed/);expect(()=>validateEndpoint('https://127.0.0.1/v1')).toThrow()})
  it('rejects non-allowlisted host without env override',()=>{expect(()=>validateEndpoint('https://evil.com/v1')).toThrow(/allowlist/)})
  it('allows openai.com and azure',()=>{expect(()=>validateEndpoint('https://api.openai.com/v1')).not.toThrow();expect(()=>validateEndpoint('https://my.openai.azure.com/v1')).not.toThrow();expect(()=>validateEndpoint('https://foo.openai.com/v1')).not.toThrow()})
  it('allows private when env override set',()=>{
    process.env.OPENSTAGE_ALLOW_PRIVATE_ENDPOINTS='1'
    expect(()=>validateEndpoint('https://evil.com/v1')).not.toThrow()
    delete process.env.OPENSTAGE_ALLOW_PRIVATE_ENDPOINTS
  })
})
describe('gateway retry/streaming',()=>{
  it('offline adapter complete returns text',async()=>{
    const a=createOpenAICompatibleAdapter({offline:true});const req=a.createChatRequest({system:'sys',dialogue:[{role:'user',content:'hello world'}]})
    const r=await a.complete(req);expect(r.text).toContain('(offline)')
  })
  it('offline completeWithRetry respects abort',async()=>{
    const a=createOpenAICompatibleAdapter({offline:true});const ac=new AbortController();ac.abort()
    await expect(a.completeWithRetry!({}, {signal:ac.signal})).rejects.toThrow()
  })
  it('createChatRequest includes system only when non-empty',()=>{
    const a=createOpenAICompatibleAdapter({offline:true}); expect((a.createChatRequest({system:'',dialogue:[]}) as any).messages).toHaveLength(0)
    expect((a.createChatRequest({system:'hi',dialogue:[]}) as any).messages[0].role).toBe('system')
  })
  it('retries on 429 then succeeds',async()=>{
    let calls=0
    const orig=globalThis.fetch
    globalThis.fetch = (async()=>{calls++; if(calls===1) return {ok:false,status:429} as any; return {ok:true,json:async()=>({choices:[{message:{content:'ok'}}],usage:{input:1,output:1}})} as any}) as any
    const a=createOpenAICompatibleAdapter({offline:false,apiKey:'sk-test',endpoint:'https://api.openai.com/v1/chat/completions'})
    const r=await a.completeWithRetry!({model:'test'} as any,{retries:2})
    expect(r.text).toBe('ok')
    globalThis.fetch=orig
  })
  it('retries exhausted throws',async()=>{
    const orig=globalThis.fetch
    globalThis.fetch = (async()=>({ok:false,status:500} as any)) as any
    const a=createOpenAICompatibleAdapter({offline:false,apiKey:'sk-test',endpoint:'https://api.openai.com/v1/chat/completions'})
    await expect(a.completeWithRetry!({} as any,{retries:1})).rejects.toThrow()
    globalThis.fetch=orig
  })
})
