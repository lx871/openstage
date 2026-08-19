# Clean-Room Policy

This project is a clean-room reimplementation of SillyTavern-compatible data and
interaction surfaces. SillyTavern is licensed under AGPL-3.0.

## Rules

- Do **not** read or copy SillyTavern source code.
- Base work only on public format specs (e.g. V1/V2/V3 card JSON, world-book JSON,
  PNG `chara` chunk layout, chat JSONL shape) and black-box observed behaviour.
- When in doubt, document the observed behaviour and the minimal format assumption
  instead of inspecting implementation.
- PRs must assert independent implementation. The CONTRIBUTING DCO sign-off covers this.

## Review

- Import/compat changes are reviewed for spec-only reasoning.
- Any contribution that appears to paste AGPL source will be rejected.
- Historical `.ai/` planning notes are local and not published; public docs are in `docs/`.
