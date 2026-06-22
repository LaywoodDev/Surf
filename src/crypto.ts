const PRIV_KEY = 'e2e_private'
const PUB_KEY = 'e2e_public'
const USER_KEY = 'e2e_user_id'
const sharedCache = new Map<number, CryptoKey>()

export function hasKeys(userId: number): boolean {
  return localStorage.getItem(USER_KEY) === String(userId) && !!localStorage.getItem(PRIV_KEY)
}

export function clearCache(): void {
  sharedCache.clear()
}

export async function generateKeyPair(): Promise<void> {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey)
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey)
  localStorage.setItem(PRIV_KEY, JSON.stringify(priv))
  localStorage.setItem(PUB_KEY, JSON.stringify(pub))
}

export function getPublicKey(): JsonWebKey | null {
  const raw = localStorage.getItem(PUB_KEY)
  return raw ? JSON.parse(raw) : null
}

async function importPriv(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits'])
}

async function importPub(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

async function derive(theirPub: JsonWebKey): Promise<CryptoKey> {
  const privJwk = JSON.parse(localStorage.getItem(PRIV_KEY)!)
  const privKey = await importPriv(privJwk)
  const pubKey = await importPub(theirPub)
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: pubKey },
    privKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function getSharedKey(userId: number, token: string): Promise<CryptoKey | null> {
  if (sharedCache.has(userId)) return sharedCache.get(userId)!
  try {
    const res = await fetch(`/api/keys/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const data = await res.json()
    const key = await derive(data.publicKey)
    sharedCache.set(userId, key)
    return key
  } catch {
    return null
  }
}

export async function encrypt(sharedKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(plaintext)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, enc)
  const b64iv = btoa(String.fromCharCode(...iv))
  const b64ct = btoa(String.fromCharCode(...new Uint8Array(ct)))
  return `__E2EE__${b64iv}.${b64ct}`
}

export async function decrypt(sharedKey: CryptoKey, data: string): Promise<string> {
  if (!data.startsWith('__E2EE__')) return data
  const payload = data.slice(8)
  const dot = payload.indexOf('.')
  if (dot === -1) return data
  try {
    const iv = Uint8Array.from(atob(payload.slice(0, dot)), c => c.charCodeAt(0))
    const ct = Uint8Array.from(atob(payload.slice(dot + 1)), c => c.charCodeAt(0))
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, ct)
    return new TextDecoder().decode(dec)
  } catch {
    return '🔒 [Encrypted]'
  }
}

export function isEncrypted(text: string): boolean {
  return text.startsWith('__E2EE__')
}
