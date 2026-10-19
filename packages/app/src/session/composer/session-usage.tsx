import { Show, createMemo, type Component } from "solid-js"
import { useParams } from "@solidjs/router"
import { Tooltip } from "@opencode/ui/tooltip"
import { useLanguage } from "@/runtime/i18n/language"
import { useData } from "@/runtime/server/current"
import { useLocal } from "@/providers/models/selection"
import { contextPercent, formatCost, formatTokens, sessionUsage } from "./usage"

export const SessionUsage: Component = () => {
  const params = useParams()
  const data = useData()
  const local = useLocal()
  const language = useLanguage()

  const usage = createMemo(() => {
    const id = params.id

    if (!id) return undefined

    const value = sessionUsage(data.session.message.list(id))

    if (value.cost === 0 && value.tokens === 0) return undefined

    return value
  })

  const context = createMemo(() => {
    const value = usage()

    if (!value) return undefined

    const limit = local.model.current()?.limit.context
    const percent = contextPercent(value.context, limit)

    if (percent === undefined || limit === undefined) return undefined

    return { percent, limit, used: value.context }
  })

  return (
    <Show when={usage()}>
      {(value) => (
        <div
          class="flex items-center justify-end gap-2 px-1 text-11-regular tabular-nums text-v2-text-text-faint"
          data-component="session-usage"
        >
          <span aria-label={language.t("session.usage.cost")}>{formatCost(value().cost)}</span>
          <span aria-hidden="true">·</span>
          <span aria-label={language.t("session.usage.tokens")}>{formatTokens(value().tokens)} tokens</span>
          <Show when={context()}>
            {(meter) => (
              <>
                <span aria-hidden="true">·</span>
                <Tooltip
                  placement="top"
                  gutter={4}
                  value={language.t("session.usage.contextTooltip", {
                    used: formatTokens(meter().used),
                    limit: formatTokens(meter().limit),
                  })}
                >
                  <span aria-label={language.t("session.usage.context")}>{meter().percent}% context</span>
                </Tooltip>
              </>
            )}
          </Show>
        </div>
      )}
    </Show>
  )
}
