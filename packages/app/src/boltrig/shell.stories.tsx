import { BoltrigRoute } from "./shell"

export default {
  title: "Boltrig/Shell",
  id: "boltrig-shell",
  component: BoltrigRoute,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Boltrig shell, reading a live Boltrig server through the Client API (boltrig.human 2.2, and 2.3 for the research view). Signed out it shows the sign-in screen. Built to the Concept · Boltrig frames in Figma.",
      },
    },
  },
}

export const Home = {
  render: () => (
    <div style={{ width: "1440px", height: "900px" }}>
      <BoltrigRoute />
    </div>
  ),
}
