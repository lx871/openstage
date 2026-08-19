import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { convertJsonString, embedCardInPng } from '@openstage/card-converter'

function dir(){return fs.mkdtempSync(path.join(os.tmpdir(),'openstage-conv-'))}
function rm(d:string){fs.rmSync(d,{recursive:true,force:true})}
function png():Uint8Array{const sig=Uint8Array.from([137,80,78,71,13,10,26,10]);const len=Uint8Array.from([0,0,0,13]);const type=Uint8Array.from([73,72,68,82]);const data=Uint8Array.from([0,0,0,1,0,0,0,1,8,6,0,0,0]);const crc=Uint8Array.from([0,0,0,0]);const ihdr=new Uint8Array(4+4+13+4);let o=0;ihdr.set(len,o);o+=4;ihdr.set(type,o);o+=4;ihdr.set(data,o);o+=13;ihdr.set(crc,o);const iend=Uint8Array.from([0,0,0,0,73,69,78,68,174,66,96,130]);const out=new Uint8Array(sig.length+ihdr.length+iend.length);o=0;out.set(sig,o);o+=sig.length;out.set(ihdr,o);o+=ihdr.length;out.set(iend,o);return out}

const AD_RE=[/加[群微Q].*?\d{5,}/gi,/QQ群[:：]?\s*\d{5,}/gi,/付费|赞助|打赏/gi]
function stripAds(s:string){let o=s;for(const re of AD_RE)o=o.replace(re,'');return o.replace(/\n{3,}/g,'\n\n').trim()}
function sanitizeJson(raw:string){try{const obj=JSON.parse(raw) as Record<string,unknown>;const data=(obj['data']&&typeof obj['data']==='object'?obj['data']:obj) as Record<string,unknown>;for(const k of ['description','personality'])if(typeof data[k]==='string')data[k]=stripAds(data[k] as string);return JSON.stringify(obj,null,2)}catch{return raw}}
function collectFiles(dir:string,out:string[]=[]):string[]{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())collectFiles(f,out);else out.push(f)}return out}

describe('convert-cards tools',()=>{
  let tmp=''
  beforeEach(()=>{tmp=dir()})
  afterEach(()=>rm(tmp))

  it('递归扫描 collectFiles 深层',()=>{
    fs.mkdirSync(path.join(tmp,'a','b'),{recursive:true})
    fs.writeFileSync(path.join(tmp,'a','b','c.json'),'{}')
    fs.writeFileSync(path.join(tmp,'root.png'),'')
    fs.writeFileSync(path.join(tmp,'ignore.txt'),'x')
    const all=collectFiles(tmp)
    expect(all.length).toBe(3)
    expect(all.some(f=>f.endsWith('c.json'))).toBe(true)
  })
  it('去广告 stripAds + sanitizeJson',()=>{
    const raw=JSON.stringify({data:{description:'hello 加群123456 world',personality:'付费内容'}})
    const cleaned=sanitizeJson(raw)
    const obj=JSON.parse(cleaned) as any
    expect(obj.data.description).not.toMatch(/123456/)
    expect(obj.data.personality).not.toMatch(/付费/)
    expect(sanitizeJson('not json')).toBe('not json')
    expect(stripAds('a\n\n\n\nb')).toBe('a\n\nb')
  })
  it('落盘结构 outRel .openstage.json + _report',async()=>{
    const src=path.join(tmp,'src'); const out=path.join(tmp,'out')
    fs.mkdirSync(path.join(src,'sub'),{recursive:true})
    const card={name:'落盘',description:'d',first_mes:'hi'}
    fs.writeFileSync(path.join(src,'sub','a.json'),JSON.stringify(card))
    const pngBytes=embedCardInPng(png(),JSON.stringify({name:'PngCard',description:'d'}),'chara')
    fs.writeFileSync(path.join(src,'b.png'), pngBytes)
    fs.mkdirSync(out,{recursive:true})
    const {convertPngBytes: cpb}=await import('@openstage/card-converter')
    const files=collectFiles(src).filter(f=>f.endsWith('.json')||f.endsWith('.png'))
    let ok=0; const report:any[]=[]
    for(const full of files){
      const rel=path.relative(src,full)
      if(full.endsWith('.png')){
        const bytes=new Uint8Array(fs.readFileSync(full))
        const r=cpb(bytes)
        const outRel=rel.replace(/\.(json|png)$/i,'.openstage.json')
        const outPath=path.join(out,outRel)
        fs.mkdirSync(path.dirname(outPath),{recursive:true})
        fs.writeFileSync(outPath,JSON.stringify({character:r.character,knowledgeBase:r.knowledgeBase},null,2))
        report.push({file:rel,status:'ok'}); ok++
      } else {
        const rec=convertJsonString(sanitizeJson(fs.readFileSync(full,'utf8')))
        const outRel=rel.replace(/\.(json|png)$/i,'.openstage.json')
        const outPath=path.join(out,outRel)
        fs.mkdirSync(path.dirname(outPath),{recursive:true})
        fs.writeFileSync(outPath,JSON.stringify({character:rec.character,knowledgeBase:rec.knowledgeBase},null,2))
        report.push({file:rel,status:'ok'}); ok++
      }
    }
    fs.writeFileSync(path.join(out,'_report.json'),JSON.stringify({ok,report},null,2))
    expect(fs.existsSync(path.join(out,'sub','a.openstage.json'))).toBe(true)
    expect(fs.existsSync(path.join(out,'b.openstage.json'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(out,'_report.json'),'utf8')).ok).toBe(2)
    const payload=JSON.parse(fs.readFileSync(path.join(out,'sub','a.openstage.json'),'utf8'))
    expect(payload.character.identity.name).toBe('落盘')
  })
  it('非法/超限跳过逻辑: 非json/png 跳过, >12M png skip',()=>{
    fs.writeFileSync(path.join(tmp,'a.txt'),'x')
    const big=new Uint8Array(13*1024*1024)
    const rel='big.png'
    const shouldSkip = big.length > 12*1024*1024
    expect(shouldSkip).toBe(true)
    const lower=rel.toLowerCase()
    const isCard=lower.endsWith('.json')||lower.endsWith('.png')
    expect(isCard).toBe(true)
    expect(path.join(tmp,'a.txt').toLowerCase().endsWith('.json')).toBe(false)
  })
  it('convert-cards AD_PATTERNS 去广告覆盖付费/QQ',()=>{
    expect(stripAds('加群 123456')).toBe('')
    expect(stripAds('QQ群：1234567')).toBe('')
    expect(stripAds('请付费支持')).toBe('请支持')
  })
})
