// Sign-in for the Boltrig Client API: OIDC authorization code with PKCE (S256) against Authentik, in the browser.
//
// The web client is public (no secret). Authentik accepts exactly one redirect for it,
// http://127.0.0.1:42813/callback (measured 25 October 2026: any other redirect is refused with 400), so the
// code flow only completes when this app is served from that origin. Elsewhere the sign-in screen offers a
// development fallback: an access token pasted by hand.
//
// Tokens live in sessionStorage only (gone when the tab closes), are never logged and never written to a file.

import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import { activeCompany, allowsRedirect } from "./companies"

// The issuer and client id belong to the active company (companies.ts); each company keeps its own session.
const ISSUER = activeCompany().issuer
const CLIENT_ID = activeCompany().clientId
// The return addresses registered for the active company's client, for the sign-in screen's message; empty when not known.
export const registeredRedirect = () => (activeCompany().redirects ?? []).join(" or ")

const SESSION_KEY = `boltrig.session.${activeCompany().id}`
const PENDING_KEY = "boltrig.oidc.pending"
const RETURN_TO = "/boltrig"

export type SessionSource = "oidc" | "pasted"
type Session = { token: string; expiresAt: number; source: SessionSource }

function readSession(): Session | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
    const session = JSON.parse(raw) as Session
    if (typeof session.token !== "string" || session.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }
    return session
  } catch {
    return
  }
}

const auth = createRoot(() => {
  const [state, setState] = createStore<{ session?: Session; reason?: "expired" | "refused" }>({
    session: typeof sessionStorage === "object" ? readSession() : undefined,
  })
  return { state, setState }
})

export const session = () => auth.state.session
export const signedOutReason = () => auth.state.reason
export const token = () => {
  const current = auth.state.session
  if (!current) return
  if (current.expiresAt <= Date.now()) {
    signOut("expired")
    return
  }
  return current.token
}

function keep(next: Session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
  } catch {}
  auth.setState({ session: next, reason: undefined })
}

export function signOut(reason?: "expired" | "refused") {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
  auth.setState({ session: undefined, reason })
}

// The expiry of a JWT access token, read from its payload without verifying it (the server verifies).
function expiryOf(jwt: string) {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    if (typeof payload.exp === "number") return payload.exp * 1000
  } catch {}
  return Date.now() + 3600_000
}

// Development fallback: a token pasted into the sign-in screen. Held in sessionStorage like any other.
export function acceptPastedToken(raw: string) {
  const value = raw.trim().replace(/^Bearer\s+/i, "")
  if (value.split(".").length !== 3) return false
  keep({ token: value, expiresAt: expiryOf(value), source: "pasted" })
  return true
}

// ---- OIDC authorization code + PKCE ---------------------------------------------------------------------------

type Discovery = { authorization_endpoint: string; token_endpoint: string }

async function discover(): Promise<Discovery> {
  const response = await fetch(`${ISSUER}.well-known/openid-configuration`)
  if (!response.ok) throw new Error(`discovery ${response.status}`)
  return (await response.json()) as Discovery
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function random(length: number) {
  return base64url(crypto.getRandomValues(new Uint8Array(length)))
}

export const redirectUri = () => `${location.origin}/callback`
export const originRegistered = () => allowsRedirect(activeCompany(), redirectUri())

export async function beginSignIn() {
  const config = await discover()
  const verifier = random(48)
  const state = random(16)
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, redirect: redirectUri() }))

  const url = new URL(config.authorization_endpoint)
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()
  location.assign(url.toString())
}

// Completes the flow on /callback. Returns where to go next, or an error code to show; never the token.
export async function completeSignIn(search: string): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  const params = new URLSearchParams(search)
  const pendingRaw = sessionStorage.getItem(PENDING_KEY)
  sessionStorage.removeItem(PENDING_KEY)
  if (params.get("error")) return { ok: false, error: params.get("error")! }
  if (!pendingRaw) return { ok: false, error: "no_pending_sign_in" }
  const pending = JSON.parse(pendingRaw) as { verifier: string; state: string; redirect: string }
  if (params.get("state") !== pending.state) return { ok: false, error: "state_mismatch" }
  const code = params.get("code")
  if (!code) return { ok: false, error: "no_code" }

  const config = await discover()
  const response = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirect,
      client_id: CLIENT_ID,
      code_verifier: pending.verifier,
    }).toString(),
  })
  if (!response.ok) return { ok: false, error: `token_${response.status}` }
  const body = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!body.access_token) return { ok: false, error: "no_access_token" }
  keep({
    token: body.access_token,
    expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : expiryOf(body.access_token),
    source: "oidc",
  })
  return { ok: true, next: RETURN_TO }
}
