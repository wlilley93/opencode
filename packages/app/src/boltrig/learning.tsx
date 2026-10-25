import { createSignal, For } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { BoltrigConversation } from "./conversation"
import { Note } from "./parts"

const tabs = ["graph", "files", "leads", "review"] as const

// Learning (Figma 642:2): the conversation with the Head of Research, with the team's research account beside it.
// The account (graph, files, leads, review) is NOT served by the Client API today: no op reads the team's records,
// so the pane says so plainly instead of drawing invented data.
export function BoltrigLearning() {
  const language = useLanguage()
  const [tab, setTab] = createSignal<(typeof tabs)[number]>("graph")

  return (
    <div data-slot="boltrig-learning" class="flex min-h-0 flex-1">
      <BoltrigConversation teamId="research" />
      <aside class="flex w-[480px] shrink-0 flex-col border-s border-v2-border-border-base">
        <div class="flex h-10 shrink-0 items-center gap-1 border-b border-v2-border-border-base px-2.5 text-[12.5px]">
          <For each={tabs}>
            {(item) => (
              <button
                type="button"
                onClick={() => setTab(item)}
                class={`rounded-[5px] px-2.5 py-0.5 ${tab() === item ? "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base" : "text-v2-text-text-muted"}`}
              >
                {language.t(`boltrig.learning.tab.${item}`)}
              </button>
            )}
          </For>
        </div>
        <div class="flex flex-col gap-3 overflow-y-auto p-4">
          <Note title={language.t(`boltrig.learning.${tab()}.title`)} aside={language.t("boltrig.notServed")} dashed>
            {language.t(`boltrig.learning.${tab()}.body`)}
          </Note>
          <Note title={language.t("boltrig.learning.needs.title")}>
            <div class="font-mono text-[11.5px] leading-[var(--line-height-base)]">
              {language.t(`boltrig.learning.${tab()}.op`)}
            </div>
            <div class="mt-1">{language.t("boltrig.learning.needs.body")}</div>
          </Note>
        </div>
      </aside>
    </div>
  )
}
