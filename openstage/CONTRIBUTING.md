# Contributing

Thanks for your interest in openstage!

## Getting Started

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm smoke
```

See `QUICKSTART.md` for the 5-step green-light flow.

## Clean-Room & DCO

This project does **not** reference SillyTavern source (AGPL-3.0). Contributions must be
based on public format specs or black-box behaviour only — do not paste SillyTavern source.

By contributing you certify the Developer Certificate of Origin (DCO):

> I certify that the contribution is my original work or properly attributed and that
> I have the right to submit it under the project's license.

Sign off your commits: `git commit -s -m "feat: ..."` (adds `Signed-off-by`).

## Pull Requests

- Keep changes focused; include tests for new behaviour.
- Do not commit secrets, `.env`, or local databases (`.openstage/` is ignored).
- For endpoint or storage changes, ensure SSRF/path-traversal tests pass.

## Reporting Issues

Use GitHub Issues for bugs and feature requests. For security issues, see `SECURITY.md`.
