import { describe, expect, it } from 'vitest'
import { assertSafeImportBuffer, assertEntryCount, assertWithinRoot, MAX_IMPORT_BYTES } from '../packages/storage/src/validate-path.js'
import path from 'node:path'
describe('validate-path',()=>{
  it('safe buffer rejects over limit',()=>{expect(()=>assertSafeImportBuffer(new Uint8Array(MAX_IMPORT_BYTES+1))).toThrow(/too large/)})
  it('safe buffer passes at limit',()=>{expect(()=>assertSafeImportBuffer(new Uint8Array(10))).not.toThrow()})
  it('entry count overflow throws',()=>{expect(()=>assertEntryCount(2001)).toThrow(/exceeds/);expect(()=>assertEntryCount(2000)).not.toThrow()})
  it('assertWithinRoot blocks escape',()=>{
    const root = path.resolve('/tmp/root')
    expect(()=>assertWithinRoot(path.join(root,'..','etc/passwd'),root)).toThrow(/escapes/)
    expect(()=>assertWithinRoot(path.join(root,'sub/file.json'),root)).not.toThrow()
  })
})
