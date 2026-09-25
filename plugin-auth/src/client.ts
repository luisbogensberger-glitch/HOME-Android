import { createClient } from '@supabase/supabase-js'

declare global {
  interface Window {
    HOME_AUTH_CONFIG?: { supabaseUrl: string; publishableKey: string }
  }
}

const config = window.HOME_AUTH_CONFIG
if (!config?.supabaseUrl || !config?.publishableKey) throw new Error('HOME authentication is not configured.')

const supabase = createClient(config.supabaseUrl, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

const params = new URLSearchParams(location.search)
const authorizationId = params.get('authorization_id') || ''
const byId = (id: string) => document.getElementById(id) as HTMLElement
const email = byId('email') as HTMLInputElement
const password = byId('password') as HTMLInputElement
const authPanel = byId('auth-panel')
const consentPanel = byId('consent-panel')
const message = byId('message')
const clientName = byId('client-name')
const clientUri = byId('client-uri')
const scopes = byId('scopes')

function setMessage(text: string, error = false) {
  message.textContent = text
  message.dataset.error = error ? 'true' : 'false'
}

async function loadConsent() {
  if (!authorizationId) {
    setMessage('Missing OAuth authorization request.', true)
    return
  }

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    authPanel.hidden = false
    consentPanel.hidden = true
    setMessage('Sign in or create a HOME account to continue.')
    return
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !data) {
    setMessage(error?.message || 'This authorization request is invalid or expired.', true)
    return
  }

  if (!('authorization_id' in data)) {
    location.assign(data.redirect_url)
    return
  }

  authPanel.hidden = true
  consentPanel.hidden = false
  clientName.textContent = data.client?.name || 'ChatGPT / Codex'
  clientUri.textContent = data.redirect_uri || ''
  scopes.replaceChildren()
  const requested = (data.scope || '').split(/\s+/).filter(Boolean)
  for (const scope of requested) {
    const li = document.createElement('li')
    li.textContent = scope
    scopes.appendChild(li)
  }
  setMessage('Review the requested access before continuing.')
}

byId('sign-in').addEventListener('click', async () => {
  setMessage('Signing in…')
  const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
  if (error) return setMessage(error.message, true)
  await loadConsent()
})

byId('sign-up').addEventListener('click', async () => {
  setMessage('Creating your HOME account…')
  const { data, error } = await supabase.auth.signUp({ email: email.value.trim(), password: password.value })
  if (error) return setMessage(error.message, true)
  if (!data.session) {
    setMessage('Account created. Confirm the verification email, then return here and sign in.')
    return
  }
  await loadConsent()
})

byId('approve').addEventListener('click', async () => {
  setMessage('Approving access…')
  const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId)
  if (error || !data) return setMessage(error?.message || 'Could not approve access.', true)
  location.assign(data.redirect_url)
})

byId('deny').addEventListener('click', async () => {
  setMessage('Declining access…')
  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId)
  if (error || !data) return setMessage(error?.message || 'Could not decline access.', true)
  location.assign(data.redirect_url)
})

byId('sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut()
  await loadConsent()
})

supabase.auth.onAuthStateChange(() => void loadConsent())
void loadConsent()
