const PRIVATE_IP_RE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/
const LOOPBACK_HOST = new Set(['localhost', '127.0.0.1', '::1'])

const ALLOWED_HOSTS = new Set([
  'api.openai.com',
])

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (ALLOWED_HOSTS.has(h)) return true
  if (h.endsWith('.openai.azure.com')) return true
  if (h.endsWith('.openai.com')) return true
  return false
}

export function validateEndpoint(endpoint: string): void {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw Object.assign(new Error(`invalid endpoint URL: ${endpoint}`), { code: 'invalid_endpoint' })
  }
  if (url.protocol !== 'https:') {
    throw Object.assign(new Error('endpoint must use https'), { code: 'invalid_endpoint' })
  }
  const host = url.hostname.toLowerCase()
  if (PRIVATE_IP_RE.test(host) || LOOPBACK_HOST.has(host) || host === '0.0.0.0') {
    throw Object.assign(new Error(`endpoint host is not allowed: ${host}`), { code: 'invalid_endpoint' })
  }
  if (!isAllowedHost(host)) {
    const allowPrivate = process.env.OPENSTAGE_ALLOW_PRIVATE_ENDPOINTS === '1'
    if (!allowPrivate) {
      throw Object.assign(new Error(`endpoint host not in allowlist: ${host} (set OPENSTAGE_ALLOW_PRIVATE_ENDPOINTS=1 to override)`), { code: 'invalid_endpoint' })
    }
  }
}
