import { createSignal } from "solid-js"

// At 700px and below the shell is a phone: the sidebar is a drawer and two-pane screens show one pane at a time.
// The same breakpoint is written as `max-[700px]:` in the class lists, so CSS and this signal never disagree.
const query = typeof matchMedia === "function" ? matchMedia("(max-width: 700px)") : undefined
const [compact, setCompact] = createSignal(query?.matches ?? false)
query?.addEventListener("change", (event) => setCompact(event.matches))
export { compact }

// iOS Safari does not resize the layout viewport for the keyboard (interactive-widget is ignored there), so the
// root height follows the visual viewport instead: the composer, last in the column, stays above the keyboard.
export function followVisualViewport() {
  const viewport = typeof window === "undefined" ? undefined : window.visualViewport
  if (!viewport) return () => {}
  const apply = () => {
    document.documentElement.style.setProperty("--boltrig-vh", `${viewport.height}px`)
    if (viewport.offsetTop > 0) window.scrollTo(0, 0)
  }
  apply()
  viewport.addEventListener("resize", apply)
  viewport.addEventListener("scroll", apply)
  return () => {
    viewport.removeEventListener("resize", apply)
    viewport.removeEventListener("scroll", apply)
    document.documentElement.style.removeProperty("--boltrig-vh")
  }
}
