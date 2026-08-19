import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { convertJsonString, exportToJson } from '@openstage/card-converter'

const fixturePath = path.join(__dirname, 'fixtures', 'linwan.json')
const fixtureJson = fs.readFileSync(fixturePath, 'utf8')

describe('card-converter', () => {
  it('V2 JSON → openstage → V2 round-trip preserves identity', () => {
    const r1 = convertJsonString(fixtureJson)
    expect(r1.sourceVersion).toBe('v2')
    expect(r1.character.identity.name).toBe('林晚')
    const v2Json = exportToJson(r1.character, r1.knowledgeBase, { targetVersion: 'v2' })
    const r2 = convertJsonString(v2Json)
    expect(r2.character.identity.name).toBe('林晚')
    expect(r2.character.identity.description).toBe(r1.character.identity.description)
  })

  it('V2 → V3 export carries spec', () => {
    const r1 = convertJsonString(fixtureJson)
    const v3Json = exportToJson(r1.character, r1.knowledgeBase, { targetVersion: 'v3' })
    const parsed = JSON.parse(v3Json) as { spec: string }
    expect(parsed.spec).toBe('chara_card_v3')
  })

  it('V1-like flat card fallback', () => {
    const flat = JSON.stringify({ name: 'Flat', description: 'desc', personality: 'p', scenario: 's', first_mes: 'hi', mes_example: '' })
    const r = convertJsonString(flat)
    expect(r.character.identity.name).toBe('Flat')
  })
})
