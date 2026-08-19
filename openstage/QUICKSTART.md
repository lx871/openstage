# Quickstart（新 clone 5 步绿灯）

> 要求：Node >= 20、pnpm >= 10。无需真实模型密钥即可完成全部验证（离线镜像）。

```bash
pnpm install
pnpm typecheck                          # tsc --noEmit
pnpm test                               # 21+ 用例

pnpm exec tsx tools/cli/src/index.ts import tests/fixtures/linwan.json
pnpm exec tsx tools/cli/src/index.ts trace  tests/fixtures/linwan.json --turn 1
pnpm exec tsx tools/compat-check/src/index.ts tests/fixtures/linwan.json
pnpm exec tsx tools/cli/src/index.ts branch tests/fixtures/linwan.json

pnpm smoke                              # 一键全量冒烟（typecheck+test+三个 CLI）
```

接真实模型：`OPENAI_API_KEY=sk-... pnpm exec tsx tools/cli/src/index.ts chat tests/fixtures/linwan.json --model gpt-4o-mini`。
SQLite 文件持久化：任意 CLI 加 `--sqlite -d .openstage`（落盘 `.openstage/openstage.db`）。
