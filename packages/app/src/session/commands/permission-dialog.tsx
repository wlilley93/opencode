import { Button } from "@opencode/ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { useDialog } from "@opencode/ui/context/dialog"
import { For, Show, createSignal, type Component } from "solid-js"
import { useParams } from "@solidjs/router"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { showToast } from "@/shell/notifications/toast"
import type { PermissionRule } from "@opencode/client/promise"
import { normalizePermissionRules } from "./permission-rules"

const EFFECTS = ["ask", "allow", "deny"] as const

export const DialogPermissionRules: Component = () => {
  const params = useParams()
  const data = useData()
  const sdk = useServerSDK()
  const dialog = useDialog()
  const language = useLanguage()

  const sessionID = () => params.id

  const info = () => {
    const id = sessionID()

    return id ? data.session.get(id) : undefined
  }

  const [rules, setRules] = createSignal<PermissionRule[]>([...(info()?.permissions ?? [])])
  const [saving, setSaving] = createSignal(false)

  const add = () => setRules([...rules(), { action: "bash", resource: "*", effect: "ask" }])

  const remove = (index: number) => setRules(rules().filter((_, at) => at !== index))

  const edit = (index: number, patch: Partial<PermissionRule>) =>
    setRules(rules().map((rule, at) => (at === index ? { ...rule, ...patch } : rule)))

  const save = async () => {
    const id = sessionID()

    if (!id) return

    const normalized = normalizePermissionRules(rules())

    setSaving(true)

    try {
      await sdk.api.session.update({ sessionID: id, permissions: normalized })
      const current = data.session.get(id)

      if (current) data.session.remember({ ...current, permissions: normalized })
      dialog.close()
      showToast({ variant: "success", title: language.t("session.permissions.saved") })
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("session.permissions.saveFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>{language.t("session.permissions.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p class="text-12-regular text-v2-text-text-muted">{language.t("session.permissions.description")}</p>
        <div class="flex flex-col gap-2">
          <Show
            when={rules().length > 0}
            fallback={<p class="text-12-regular text-v2-text-text-muted">{language.t("session.permissions.empty")}</p>}
          >
            <For each={rules()}>
              {(rule, index) => (
                <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem_auto] items-center gap-2">
                  <input
                    value={rule.action}
                    aria-label={language.t("session.permissions.action")}
                    class="h-8 min-w-0 rounded-md border border-v2-border-border-base bg-v2-background-bg-base px-2 text-13-regular outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-border-border-focus"
                    onInput={(event) => edit(index(), { action: event.currentTarget.value })}
                  />
                  <input
                    value={rule.resource}
                    aria-label={language.t("session.permissions.resource")}
                    class="h-8 min-w-0 rounded-md border border-v2-border-border-base bg-v2-background-bg-base px-2 font-mono text-12-regular outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-border-border-focus"
                    onInput={(event) => edit(index(), { resource: event.currentTarget.value })}
                  />
                  <select
                    value={rule.effect}
                    aria-label={language.t("session.permissions.effect")}
                    class="h-8 rounded-md border border-v2-border-border-base bg-v2-background-bg-base px-2 text-12-regular outline-none"
                    onChange={(event) => edit(index(), { effect: EFFECTS.find((value) => value === event.currentTarget.value) ?? "ask" })}
                  >
                    <For each={EFFECTS}>{(effect) => <option value={effect}>{effect}</option>}</For>
                  </select>
                  <Button size="small" variant="ghost-muted" onClick={() => remove(index())}>
                    {language.t("common.remove")}
                  </Button>
                </div>
              )}
            </For>
          </Show>
          <Button size="small" variant="neutral" class="self-start" onClick={add}>
            {language.t("session.permissions.add")}
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
        <Button variant="submit" disabled={saving()} onClick={() => void save()}>
          {language.t("common.save")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
