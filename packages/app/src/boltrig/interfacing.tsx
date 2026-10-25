import { For } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { Note, Tile } from "./parts"

const connectors = ["microsoft", "linear", "granola", "crm"] as const

// Interfacing (Figma 617:2), a placeholder: Boltrig connects to the person's own mail, calendar, issues, notes and
// CRM and surfaces only what needs them. The Client API serves no connector or approval op yet
// (approvals.read and approvals.decide are reserved and not implemented), so nothing here is live.
export function BoltrigInterfacing() {
  const language = useLanguage()
  return (
    <div data-slot="boltrig-interfacing" class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-[640px] max-w-[calc(100%-48px)] py-10">
        <div class="mb-6 flex items-start gap-3.5">
          <Tile large>I</Tile>
          <div>
            <div class="text-xl font-medium text-v2-text-text-base">{language.t("boltrig.iface.title")}</div>
            <div class="text-v2-text-text-faint">{language.t("boltrig.iface.subtitle")}</div>
          </div>
        </div>
        <div class="mb-5 flex flex-col">
          <For each={connectors}>
            {(item) => (
              <div class="flex min-h-[52px] items-center gap-3 border-b border-v2-border-border-base px-1 py-2">
                <Tile>{language.t(`boltrig.iface.${item}.initial`)}</Tile>
                <div class="min-w-0 flex-1">
                  <div class="text-v2-text-text-base">{language.t(`boltrig.iface.${item}.name`)}</div>
                  <div class="text-xs text-v2-text-text-faint">{language.t(`boltrig.iface.${item}.holds`)}</div>
                </div>
                <span class="shrink-0 text-xs text-v2-text-text-faint">{language.t("boltrig.notServed")}</span>
              </div>
            )}
          </For>
        </div>
        <Note title={language.t("boltrig.iface.will.title")} aside={language.t("boltrig.notServed")} dashed>
          {language.t("boltrig.iface.will.body")}
        </Note>
        <div class="mt-3">
          <Note title={language.t("boltrig.learning.needs.title")}>
            <div class="font-mono text-[11.5px] leading-[var(--line-height-base)]">{language.t("boltrig.iface.op")}</div>
          </Note>
        </div>
      </div>
    </div>
  )
}
