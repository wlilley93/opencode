import { Button } from "@opencode/ui/button"
import { Show } from "solid-js"
import { useLocal } from "@/providers/models/selection"
import { useServerSDK } from "@/runtime/server/client"
import { useLanguage } from "@/runtime/i18n/language"
import { showToast } from "@/shell/notifications/toast"
import type { SessionModel } from "../model"
import { planApprovalReady, sessionMode, sessionModeAgent, sessionModeCopy, SESSION_MODES } from "./mode"

export function SessionMode(props: { session: SessionModel }) {
  const local = useLocal()
  const server = useServerSDK()
  const language = useLanguage()
  const mode = () => sessionMode(props.session.data.info()?.agent)

  const select = async (value: (typeof SESSION_MODES)[number]) => {
    const info = props.session.data.info()
    if (!info || info.agent === sessionModeAgent(value)) return

    try {
      await server.api.session.switchAgent({ sessionID: info.id, agent: sessionModeAgent(value) })
      local.agent.set(sessionModeAgent(value))
    } catch (error) {
      showToast({ variant: "error", title: language.t("session.mode.changeFailed"), description: String(error) })
    }
  }

  const approvePlan = () => select("auto")

  return (
    <div class="flex flex-wrap items-center justify-between gap-2 px-1" aria-label={language.t("session.mode.label")}>
      <div
        class="flex items-center gap-1 rounded-lg bg-v2-background-bg-layer-01 p-1"
        role="group"
        aria-label={language.t("session.mode.label")}
      >
        {SESSION_MODES.map((value) => {
          const copy = sessionModeCopy(value)
          return (
            <Button
              size="small"
              variant={mode() === value ? "contrast" : "ghost-muted"}
              aria-pressed={mode() === value}
              title={language.t(copy.description)}
              onClick={() => void select(value)}
            >
              {language.t(copy.label)}
            </Button>
          )
        })}
      </div>
      <Show when={planApprovalReady(mode(), props.session.data.working(), props.session.history.messages())}>
        <div class="flex items-center gap-2 text-12-regular text-v2-text-text-muted">
          <span>{language.t("session.mode.plan.approveHint")}</span>
          <Button size="small" variant="submit" onClick={() => void approvePlan()}>
            {language.t("session.mode.plan.approve")}
          </Button>
        </div>
      </Show>
    </div>
  )
}
