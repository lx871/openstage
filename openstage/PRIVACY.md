# Privacy

- No telemetry is collected by openstage.
- API keys, when used, are read from environment variables (`OPENAI_API_KEY` /
  `OPENSTAGE_API_KEY`) or passed transiently via CLI and are not persisted.
  Avoid ` --key <secret>` in shell history; prefer env vars.
- Chat content and local databases under `.openstage/` are local-only and ignored
  by `.gitignore`.
