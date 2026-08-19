export type Capability = 'read:messages' | 'write:messages' | 'read:context' | 'write:context' | 'network' | 'storage'
export interface ExtensionManifest {
  id: string
  name: string
  version: string
  capabilities: Capability[]
  entry?: string
}
export interface ExtensionHost {
  manifest: ExtensionManifest
  assertCapability(c: Capability): void
}
export function createExtensionHost(manifest: ExtensionManifest): ExtensionHost {
  const granted = new Set(manifest.capabilities)
  return {
    manifest,
    assertCapability(c) {
      if (!granted.has(c)) throw Object.assign(new Error(`capability denied: ${c}`), { code: 'capability_denied' })
    },
  }
}
