export type ModelLabel = { provider?: string; model: string; variants: string[] }

const limit = 32

/** The remembered labels with `key` newest, dropping the oldest past the bound; undefined when nothing changes. */
export function rememberModelLabel(labels: Record<string, ModelLabel>, key: string, value: ModelLabel) {
  const current = labels[key]

  if (
    current?.provider === value.provider &&
    current.model === value.model &&
    current.variants.join("\n") === value.variants.join("\n")
  )
    return

  const rest = Object.entries(labels).filter(([item]) => item !== key)

  return Object.fromEntries([...rest.slice(1 - limit), [key, value]])
}
