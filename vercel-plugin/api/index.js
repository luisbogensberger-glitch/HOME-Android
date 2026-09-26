import { Readable } from 'node:stream'

const SUPABASE_ORIGIN = 'https://skgmgxthymnzubbobqxu.supabase.co'
const MCP_UPSTREAM = `${SUPABASE_ORIGIN}/functions/v1/home-mcp`
const AUTH_SERVER = `${SUPABASE_ORIGIN}/auth/v1`

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]))
}

function originFor(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  res.statusCode = status
  res.setHeader('content-type', contentType)
  res.setHeader('x-content-type-options', 'nosniff')
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value)
  res.end(body)
}

function page(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>html{background:#000;color:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{max-width:760px;margin:0 auto;padding:72px 24px 96px}header{display:flex;align-items:center;gap:18px;margin-bottom:52px}.mark{width:46px;height:46px;border:1px solid #2c2c2c;border-radius:12px;display:grid;place-items:center;font-size:25px;font-weight:200}h1{font-size:42px;line-height:1.05;margin:0 0 18px;font-weight:600;letter-spacing:-.03em}h2{margin-top:38px;font-size:20px}p,li{color:#b9b9b9;line-height:1.7}a{color:#fff;text-underline-offset:3px}.nav{display:flex;gap:18px;flex-wrap:wrap;margin-top:34px}.muted{color:#777;font-size:14px;margin-top:48px}</style></head><body><header><div class="mark">V</div><div>Veqrya</div></header>${content}</body></html>`
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function proxyMcp(req, res, origin) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || ['host', 'content-length', 'connection'].includes(key.toLowerCase())) continue
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else headers.set(key, value)
  }

  const method = req.method || 'GET'
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(req)
  const upstream = await fetch(MCP_UPSTREAM, { method, headers, body, redirect: 'manual' })

  res.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) return
    res.setHeader(key, value)
  })
  if (upstream.status === 401) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`)
  }

  if (!upstream.body) return res.end()
  Readable.fromWeb(upstream.body).pipe(res)
}

function routedPath(url) {
  const route = url.searchParams.get('_vroute')
  return ({
    home: '/',
    privacy: '/privacy',
    terms: '/terms',
    support: '/support',
    mcp: '/mcp',
    oauth: '/.well-known/oauth-protected-resource',
    challenge: '/.well-known/openai-apps-challenge'
  })[route] || url.pathname
}

export default async function handler(req, res) {
  const origin = originFor(req)
  const url = new URL(req.url || '/', origin)
  const path = routedPath(url)
  const publisher = escapeHtml((process.env.PUBLISHER_NAME || 'Veqrya').trim())
  const supportEmail = (process.env.SUPPORT_EMAIL || '').trim()
  const support = supportEmail.includes('@')
    ? `<a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>`
    : 'A monitored support address will be published before public release.'

  if (path === '/mcp') return proxyMcp(req, res, origin)

  if (path === '/.well-known/oauth-protected-resource') {
    return send(res, 200, JSON.stringify({
      resource: `${origin}/mcp`,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ['openid', 'email', 'profile'],
      bearer_methods_supported: ['header']
    }), 'application/json; charset=utf-8', { 'cache-control': 'public, max-age=300' })
  }

  if (path === '/.well-known/openai-apps-challenge') {
    const token = (process.env.OPENAI_APPS_CHALLENGE || '').trim()
    if (!token) return send(res, 404, 'Not configured', 'text/plain; charset=utf-8', { 'cache-control': 'no-store' })
    return send(res, 200, token, 'text/plain; charset=utf-8', { 'cache-control': 'no-store' })
  }

  if (path === '/' || path === '/website') {
    return send(res, 200, page('Veqrya – Personal OS', `<h1>Your personal execution layer.</h1><p>Veqrya connects your tasks, planning and deliberate learning with supported AI assistants while keeping each user's data isolated behind their own account.</p><p>The public mobile builds do not require users to paste reusable AI-provider API keys into the app.</p><div class="nav"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></div><p class="muted">Publisher: ${publisher}</p>`), 'text/html; charset=utf-8', { 'cache-control': 'public, max-age=300' })
  }

  if (path === '/support') {
    return send(res, 200, page('Veqrya Support', `<h1>Support</h1><p>For Veqrya support, contact ${support}</p><div class="nav"><a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>`), 'text/html; charset=utf-8', { 'cache-control': 'public, max-age=300' })
  }

  if (path === '/privacy') {
    return send(res, 200, page('Veqrya Privacy Policy', `<h1>Privacy Policy</h1><p><strong>Pre-release policy baseline — updated 26 September 2026.</strong></p><p>Veqrya may process account identifiers, tasks, task notes and status, optional due times and priorities, learning cards, reflections, feedback and settings that users choose to store.</p><p>The public Veqrya mobile and AI-connector builds do not require precise location, contacts, SMS, WhatsApp content, Android Accessibility data or notification scraping.</p><h2>Purpose</h2><p>Stored data is used to provide the task, planning and learning actions requested by the signed-in user.</p><h2>Infrastructure</h2><p>Veqrya currently uses Supabase for authentication and account-isolated application data, and Vercel for the public gateway. Supported AI assistants remain subject to their own terms and privacy controls.</p><h2>User controls</h2><p>Users can sign out or disconnect integrations and can use the supported account-deletion flow. For privacy requests, contact ${support}</p><h2>Security</h2><p>Authenticated access, encrypted transport and per-user Row Level Security are used to isolate user data.</p><p class="muted">Final controller identity, retention details and jurisdiction-specific disclosures will be completed before public release.</p>`), 'text/html; charset=utf-8', { 'cache-control': 'public, max-age=300' })
  }

  if (path === '/terms') {
    return send(res, 200, page('Veqrya Terms of Service', `<h1>Terms of Service</h1><p><strong>Pre-release terms baseline — updated 26 September 2026.</strong></p><p>Veqrya provides tools for storing and managing personal tasks and learning information through supported mobile clients and AI integrations.</p><h2>User responsibility</h2><p>Users are responsible for information they choose to store and for reviewing important actions and AI-generated output. Veqrya is not a substitute for professional medical, legal, financial or emergency advice.</p><h2>Account security</h2><p>Users must protect their authentication credentials and may not attempt to access another person's data or bypass security controls.</p><h2>Third-party services</h2><p>Veqrya relies on third-party infrastructure and may integrate with third-party AI services, which can have separate terms, account requirements and privacy controls.</p><h2>Contact</h2><p>${support}</p><p class="muted">Final publisher identity, consumer-law wording and governing-law provisions will be completed before public release.</p>`), 'text/html; charset=utf-8', { 'cache-control': 'public, max-age=300' })
  }

  return send(res, 404, 'Not Found')
}
