import type { PermissionRule } from "@opencode/client/promise"

/** Trim the editable fields and drop rows that would never match a tool action. */
export function normalizePermissionRules(rules: readonly PermissionRule[]): PermissionRule[] {
  return rules.flatMap((rule) => {
    const action = rule.action.trim()
    const resource = rule.resource.trim()

    if (!action || !resource) return []

    return [{ action, resource, effect: rule.effect }]
  })
}
