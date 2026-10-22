import { BoltrigShell } from "./shell"

export default {
  title: "Boltrig/Shell",
  id: "boltrig-shell",
  component: BoltrigShell,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Boltrig shell on mock data: the person's double as Home, the three modes (Learning, Doing, Interfacing) and the worlds they belong to. Built to the Concept · Boltrig frames in Figma.",
      },
    },
  },
}

export const Home = {
  render: () => (
    <div style={{ width: "1440px", height: "900px" }}>
      <BoltrigShell />
    </div>
  ),
}
