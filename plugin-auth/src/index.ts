interface Env {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  ASSETS: Fetcher
}

function safeJson(value: string) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function consentPage(env: Env) {
  const config = `{supabaseUrl:${safeJson(env.SUPABASE_URL)},publishableKey:${safeJson(env.SUPABASE_PUBLISHABLE_KEY)}}`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect HOME</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0f1012;color:#f5f5f5;font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(100%,520px);background:#17191d;border:1px solid #2a2d33;border-radius:24px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.3)}h1{font-size:32px;margin:0 0 6px}.sub{color:#a8abb3;margin:0 0 24px}.stack{display:grid;gap:12px}input,button{font:inherit;border-radius:14px;padding:13px 14px}input{width:100%;border:1px solid #343840;background:#101216;color:#fff;outline:none}input:focus{border-color:#707784}button{border:1px solid #343840;background:#24272d;color:#fff;font-weight:650;cursor:pointer}button.primary{background:#f3f3f3;color:#111;border-color:#f3f3f3}button.danger{background:transparent;color:#ffb8b8}.row{display:flex;gap:10px}.row>*{flex:1}.box{background:#101216;border:1px solid #2b2f36;border-radius:16px;padding:16px;margin:14px 0}.label{font-size:12px;color:#8f949e;text-transform:uppercase;letter-spacing:.08em}.value{margin-top:4px;word-break:break-word}ul{padding-left:20px}#message{min-height:24px;color:#b8bcc5;margin:14px 0 0}#message[data-error=true]{color:#ff9f9f}.fine{font-size:12px;color:#858a94;margin-top:22px}a{color:inherit}
  </style></head><body><main class="card"><div class="label">HOME · Personal OS</div><h1>Connect HOME</h1><p class="sub">Give ChatGPT or Codex access to the HOME account you choose.</p>
  <section id="auth-panel" class="stack" hidden><input id="email" type="email" autocomplete="email" placeholder="Email"><input id="password" type="password" autocomplete="current-password" minlength="8" placeholder="Password (8+ characters)"><div class="row"><button id="sign-up">Create account</button><button id="sign-in" class="primary">Sign in</button></div></section>
  <section id="consent-panel" hidden><div class="box"><div class="label">Application</div><div id="client-name" class="value"></div></div><div class="box"><div class="label">Redirect</div><div id="client-uri" class="value"></div></div><div class="box"><div class="label">Requested permissions</div><ul id="scopes"></ul></div><p>HOME will only expose data belonging to this signed-in HOME account. You can revoke access later.</p><div class="row"><button id="deny" class="danger">Deny</button><button id="approve" class="primary">Allow access</button></div><button id="sign-out" style="width:100%;margin-top:10px;background:transparent">Use another account</button></section>
  <p id="message"></p><p class="fine">By continuing you agree to the HOME terms and privacy policy. The public plugin does not read WhatsApp, notifications, contacts, or precise location.</p></main><script>window.HOME_AUTH_CONFIG=${config}</script><script type="module" src="/app.js"></script></body></html>`
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}})
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/oauth/consent') return consentPage(env)
    if (url.pathname === '/health') return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','cache-control':'no-store'}})
    return env.ASSETS.fetch(request)
  },
}
