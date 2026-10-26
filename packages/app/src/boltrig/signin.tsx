import { useNavigate } from "@solidjs/router"
import { createStore } from "solid-js/store"
import { For, onMount, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { acceptPastedToken, beginSignIn, completeSignIn, originRegistered, registeredRedirect, signedOutReason } from "./auth"
import { activeCompany, addCompany, companies, removeCompany, switchCompany } from "./companies"
import { Tile } from "./parts"

// The signed-out screen: sign in with the estate's Authentik, or (development only) paste an access token.
export function BoltrigSignIn() {
  const language = useLanguage()
  const [form, setForm] = createStore({ pasted: "", error: "", busy: false })
  const [add, setAdd] = createStore({ open: false, name: "", apiBase: "", issuer: "", clientId: "", error: "" })

  const signIn = async () => {
    setForm({ busy: true, error: "" })
    try {
      await beginSignIn()
    } catch {
      setForm({ busy: false, error: language.t("boltrig.signin.discoveryFailed") })
    }
  }

  return (
    <div data-slot="boltrig-signin" class="flex h-full w-full items-center justify-center bg-v2-background-bg-deep text-[13px]">
      <div class="w-[420px] max-w-[calc(100%-32px)] rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base p-6">
        <div class="mb-4 flex items-center gap-3">
          <Tile large>B</Tile>
          <div>
            <div class="text-lg font-medium text-v2-text-text-base">{language.t("boltrig.signin.title")}</div>
            <div class="text-v2-text-text-faint">{language.t("boltrig.signin.subtitle")}</div>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-2">
          <select
            aria-label={language.t("boltrig.company.label")}
            class="h-8 min-w-0 flex-1 rounded-[7px] max-[700px]:h-11 max-[700px]:text-base border border-v2-border-border-strong bg-v2-background-bg-layer-01 px-2 text-v2-text-text-base"
            onChange={(event) => switchCompany(event.currentTarget.value)}
          >
            <For each={companies()}>
              {(company) => (
                <option value={company.id} selected={company.id === activeCompany().id}>
                  {company.name}
                </option>
              )}
            </For>
          </select>
          <button
            type="button"
            class="h-8 rounded-[7px] border border-v2-border-border-strong px-3 max-[700px]:h-11 max-[700px]:px-4 text-v2-text-text-muted"
            onClick={() => setAdd({ open: !add.open, error: "" })}
          >
            {language.t("boltrig.company.add")}
          </button>
        </div>
        <Show when={activeCompany().redirects === undefined}>
          <button
            type="button"
            class="mb-4 -mt-2 text-xs text-v2-text-text-faint underline max-[700px]:h-11"
            onClick={() => {
              removeCompany(activeCompany().id)
              switchCompany("boltrig-dev")
            }}
          >
            {language.t("boltrig.company.remove", { name: activeCompany().name })}
          </button>
        </Show>
        <Show when={add.open}>
          <form
            class="mb-4 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const result = addCompany({ name: add.name, apiBase: add.apiBase, issuer: add.issuer, clientId: add.clientId })
              if (typeof result === "string") return setAdd({ error: language.t(`boltrig.company.error.${result}`) })
              switchCompany(result.id)
            }}
          >
            <For each={["name", "apiBase", "issuer", "clientId"] as const}>
              {(field) => (
                <input
                  type="text"
                  autocomplete="off"
                  value={add[field]}
                  onInput={(event) => setAdd(field, event.currentTarget.value)}
                  placeholder={language.t(`boltrig.company.field.${field}`)}
                  aria-label={language.t(`boltrig.company.field.${field}`)}
                  class="h-8 rounded-[7px] max-[700px]:h-11 max-[700px]:text-base border border-v2-border-border-strong bg-v2-background-bg-layer-01 px-2.5 text-xs text-v2-text-text-base outline-none"
                />
              )}
            </For>
            <button
              type="submit"
              class="h-8 rounded-[7px] border border-v2-border-border-strong px-3 max-[700px]:h-11 text-v2-text-text-muted"
            >
              {language.t("boltrig.company.save")}
            </button>
            <Show when={add.error}>
              <div class="text-xs text-v2-text-text-muted">{add.error}</div>
            </Show>
          </form>
        </Show>
        <Show when={signedOutReason()}>
          {(reason) => (
            <div class="mb-3 text-v2-text-text-muted">{language.t(`boltrig.signin.reason.${reason()}`)}</div>
          )}
        </Show>
        <button
          type="button"
          disabled={form.busy || !originRegistered()}
          onClick={() => void signIn()}
          class="h-8 w-full rounded-[7px] max-[700px]:h-11 bg-v2-text-text-base font-medium text-v2-background-bg-base disabled:opacity-40"
        >
          {language.t("boltrig.signin.button")}
        </button>
        <Show when={!originRegistered()}>
          <div class="mt-2 text-xs text-v2-text-text-faint">
            {language.t("boltrig.signin.originNotRegistered", { redirect: registeredRedirect() })}
          </div>
        </Show>

        <div class="mt-6 border-t border-dashed border-v2-border-border-strong pt-4">
          <div class="mb-1 text-xs font-medium tracking-wide text-v2-text-text-faint uppercase">
            {language.t("boltrig.signin.dev.label")}
          </div>
          <div class="mb-2 text-xs text-v2-text-text-faint">{language.t("boltrig.signin.dev.hint")}</div>
          <form
            class="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const ok = acceptPastedToken(form.pasted)
              setForm({ pasted: "", error: ok ? "" : language.t("boltrig.signin.dev.invalid") })
            }}
          >
            <input
              type="password"
              autocomplete="off"
              value={form.pasted}
              onInput={(event) => setForm({ pasted: event.currentTarget.value })}
              placeholder={language.t("boltrig.signin.dev.placeholder")}
              aria-label={language.t("boltrig.signin.dev.placeholder")}
              class="h-8 min-w-0 flex-1 rounded-[7px] max-[700px]:h-11 max-[700px]:text-base border border-v2-border-border-strong bg-v2-background-bg-layer-01 px-2.5 font-mono text-xs text-v2-text-text-base outline-none"
            />
            <button
              type="submit"
              class="h-8 rounded-[7px] border border-v2-border-border-strong px-3 max-[700px]:h-11 max-[700px]:px-4 text-v2-text-text-muted"
            >
              {language.t("boltrig.signin.dev.use")}
            </button>
          </form>
        </div>
        <Show when={form.error}>
          <div class="mt-2 text-xs text-v2-text-text-muted">{form.error}</div>
        </Show>
      </div>
    </div>
  )
}

// /callback: Authentik returns here with ?code&state; exchange it and go to the shell.
export function BoltrigCallback() {
  const language = useLanguage()
  const navigate = useNavigate()
  const [view, setView] = createStore({ error: "" })

  onMount(async () => {
    const result = await completeSignIn(location.search).catch(() => ({ ok: false as const, error: "exchange_failed" }))
    if (result.ok) navigate(result.next, { replace: true })
    else setView({ error: result.error })
  })

  return (
    <div class="flex h-dvh w-full items-center justify-center bg-v2-background-bg-deep text-[13px] text-v2-text-text-muted">
      <Show when={view.error} fallback={language.t("boltrig.signin.completing")}>
        <div class="text-center">
          <div>{language.t("boltrig.signin.failed", { code: view.error })}</div>
          <a href="/boltrig" class="mt-2 inline-block text-v2-text-text-base underline">
            {language.t("boltrig.signin.back")}
          </a>
        </div>
      </Show>
    </div>
  )
}
