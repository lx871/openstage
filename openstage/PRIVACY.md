# Privacy

- No telemetry is collected by openstage.
- API keys, when used, are read from environment variables (`OPENAI_API_KEY` /
  `OPENSTAGE_API_KEY`) or passed transiently via CLI and are not persisted.
  Avoid ` --key <secret>` in shell history; prefer env vars.
- Chat content and local databases under `.openstage/` are local-only and ignored
  by `.gitignore`.
- Web frontend: `localStorage` keys `openstage.state.v1` / `openstage.conv.*` persist characters, knowledge and settings locally only; clear via browser storage settings or `localStorage.clear()`.
- File uploads (card JSON/PNG) are processed in-memory in the browser; no file is sent to a server. Large files (>12 MB) are rejected before parsing.
- `settings.endpoint` controls where chat requests are sent; when offline mode is off, requests go to the configured endpoint.
