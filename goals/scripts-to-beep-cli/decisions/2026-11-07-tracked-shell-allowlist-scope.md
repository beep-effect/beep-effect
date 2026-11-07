---
title: "tracked-shell-allowlist exempts packet evidence, infra/ and two named fixtures"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli"
reversal: "Remove the extra roots from the law's allowlist once their owners delete the shell"
---

On 2026-11-07 `git ls-files '*.sh'` outside the hook dirs lists 84 files: packet evidence under `goals/` and `explorations/` (a SPEC non-goal), seven under `infra/` (deleted by `infra-alchemy-rebuild`), two test fixtures (`packages/tooling/tool/cli/test/fixtures/models/locators.sh`, `packages/tooling/tool/docgen/test/fixtures/section-example/tsc-wrapper.sh`), and the `scripts/` files this packet deletes. The law therefore allows exact roots `.claude/`, `.codex/`, `.cursor/`, `goals/`, `explorations/`, `infra/` (removal condition: infra-alchemy-rebuild retires `infra/`), plus exact file paths `scripts/cloud/bootstrap.sh` and the two fixtures. No glob patterns; every entry carries an owner and a removal condition in the Exception Ledger.
