// The companies this app can sign in to. A company is one Boltrig server with its own sign-in provider
// (decision D041: direct, per client), so a person can belong to several and each keeps its own session.
//
// Only configuration lives here (name, API base, issuer, client id), in localStorage. No token is ever stored
// in this module. Switching company reloads the page, so nothing one company sent can stay in memory and appear
// in another company's view.

// `redirects` are the return addresses the company's sign-in provider has registered for this client, when we know them.
// Unknown (an added company) means the app does not guess: it lets the sign-in attempt go and shows the provider's refusal.
export type Company = {
  id: string
  name: string
  apiBase: string
  issuer: string
  clientId: string
  redirects?: string[]
}
export type CompanyInput = { name: string; apiBase: string; issuer: string; clientId: string }

// The server this app was built against: the dev stack, signed in through Authentik.
const builtIn: Company = {
  id: "boltrig-dev",
  name: "Boltrig dev",
  apiBase: (import.meta.env.VITE_BOLTRIG_API as string | undefined) ?? "/boltrig-api",
  issuer: "https://id.boltrig.ai/application/o/boltrig-os/",
  clientId: "GWyQq45Sp4AnHxaD1Wr4AaHxJPJ8a1KZ1YRJIjJx",
  // Registered in Authentik for this client: this Mac, and its tailnet https address (served by `tailscale serve --https=11443`)
  // so a phone on the tailnet can sign in; a browser allows PKCE only over https or localhost.
  redirects: ["http://127.0.0.1:42813/callback", "https://mac-mini-m4-pro.tailb4b671.ts.net:11443/callback"],
}

/** Whether this app's return address may be tried for a company: always, unless the company's registered addresses are known. */
export const allowsRedirect = (company: Company, redirect: string) =>
  company.redirects === undefined || company.redirects.includes(redirect)

const LIST_KEY = "boltrig.companies"
const ACTIVE_KEY = "boltrig.company"

function readAdded(): Company[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as unknown
    if (!Array.isArray(list)) return []
    return list.filter(isCompany).filter((company) => company.id !== builtIn.id)
  } catch {
    return []
  }
}

function isCompany(value: unknown): value is Company {
  if (typeof value !== "object" || value === null) return false
  const company = value as Record<string, unknown>
  const text = ["id", "name", "apiBase", "issuer", "clientId"].every((key) => typeof company[key] === "string" && company[key])
  const redirects = company.redirects
  return text && (redirects === undefined || (Array.isArray(redirects) && redirects.every((r) => typeof r === "string")))
}

function writeAdded(list: Company[]) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch {}
}

export const companies = (): Company[] => [builtIn, ...readAdded()]

export function activeCompany(): Company {
  try {
    const id = localStorage.getItem(ACTIVE_KEY)
    return companies().find((company) => company.id === id) ?? builtIn
  } catch {
    return builtIn
  }
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

// An API base is a same-origin path (served by a proxy, because the Client API sends no CORS headers) or an
// https URL. The issuer is an https URL. Anything else is refused before it can reach a fetch or a redirect.
export function checkCompany(input: CompanyInput): "name" | "apiBase" | "issuer" | "clientId" | undefined {
  if (!slug(input.name)) return "name"
  if (!/^\/[A-Za-z0-9._~\-/]*$/.test(input.apiBase) && !/^https:\/\/[^\s/]+[^\s]*$/.test(input.apiBase)) return "apiBase"
  if (!/^https:\/\/[^\s/]+[^\s]*$/.test(input.issuer)) return "issuer"
  if (!input.clientId.trim()) return "clientId"
}

export function addCompany(input: CompanyInput): Company | "name" | "apiBase" | "issuer" | "clientId" | "exists" {
  const bad = checkCompany(input)
  if (bad) return bad
  const id = slug(input.name)
  if (companies().some((company) => company.id === id)) return "exists"
  const company: Company = {
    id,
    name: input.name.trim(),
    apiBase: input.apiBase.replace(/\/+$/, ""),
    issuer: input.issuer.endsWith("/") ? input.issuer : `${input.issuer}/`,
    clientId: input.clientId.trim(),
  }
  writeAdded([...readAdded(), company])
  return company
}

export function removeCompany(id: string) {
  writeAdded(readAdded().filter((company) => company.id !== id))
  try {
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY)
    sessionStorage.removeItem(`boltrig.session.${id}`)
  } catch {}
}

export function switchCompany(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id)
  } catch {}
  location.assign("/boltrig")
}
