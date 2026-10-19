# OpenCode Drive Desktop prototype

This prototype uses OpenCode Drive as the owner of an isolated real OpenCode server while Electron is the frontend:

```text
OpenCode Drive
  ├─ isolated project, config, database, and service registration
  ├─ real OpenCode server
  └─ simulated LLM and controlled tools
          │ authenticated HTTP/SSE
          ▼
OpenCode Desktop
          │ Chrome DevTools Protocol
          ▼
Playwright scenario and screenshots
```

Desktop's `--service-file` development option adopts Drive's authenticated service registration without starting,
replacing, or owning that server. The script gives Desktop a separate `OPENCODE_DESKTOP_TEST_ROOT`, connects Playwright
to Electron's development CDP endpoint, drives the real composer, and terminates the Desktop process group when done.
Drive retains ownership of server and simulation cleanup.

Run it from an OpenCode checkout with dependencies installed:

```bash
OPENCODE_DEV="$PWD" \
  opencode-drive start \
  --name desktop-prototype \
  --dev "$PWD" \
  --script script/drive/desktop.ts
```

The final screenshot is written to the system temporary directory and its path is printed. Override it when needed:

```bash
OPENCODE_DESKTOP_DRIVE_SCREENSHOT=/absolute/path/desktop.png \
  OPENCODE_DEV="$PWD" \
  opencode-drive start --name desktop-prototype --dev "$PWD" --script script/drive/desktop.ts
```

The prototype intentionally keeps Playwright orchestration in the scenario. A production abstraction should move
Desktop launch, CDP discovery, process-tree cleanup, and screenshot reporting into an OpenCode Drive frontend adapter,
leaving scenarios with only semantic UI actions and simulated model/tool behavior.
