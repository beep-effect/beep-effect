# tsgo 0.45 Effect idiom sweep — Sources & Provenance

- **Source exploration:** none. Authored directly from a grill-with-docs
  session on 2026-09-12 over `research/origin-prompt-2026-09-12.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| effect `84864bc30c` | Fix Schema class equivalence derivation (#7451) | Effect-TS/effect | `packages/effect/src/Schema.ts:13940` (rc.115) | TaggedError equivalence | Adopted: retire repo hook (D4) |
| effect `8d1e97a` | Match contextual typing for Effect.fn handler maps (#7460) | Effect-TS/effect | CHANGELOG rc.113 | Match | Proves #1060 rewrite was unforced (D5) |
| effect `a63dcbf` | Native Arbitraries; equivalence ownership policy (#7254) | Effect-TS/effect | CHANGELOG rc.113 | Equivalence derivation | Context for D4 |
| tsgo 0.45.0 catalog | `effectDiagnosticMessages.json` | Effect-TS/effect-tsgo | `internal/diagnostics/` | 116 rule ids | Rule cards (D2) |
| tsgo 0.45.0 config | `hooks.go` | Effect-TS/effect-tsgo | `internal/effectconfigraw/hooks.go` | Plugin keys | Key parity (D3) |
| tsgo CHANGELOG 0.40–0.45 | release notes | Effect-TS/effect-tsgo | `_packages/tsgo/CHANGELOG.md` | New rules | Rule cards |
| beep-effect PR #1060 | c8349ed snapshot migration | this repo | merge `6b1ebc8d33` | Match regression | Match lane scope (D5) |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect (`$HOME/YeeBois/dev/effect`) | MIT | Reference only; never vendored | API truth for every fix |
| Effect-TS/effect-tsgo (`$HOME/YeeBois/dev/effect-tsgo`) | MIT | Reference only | Rule semantics, message text, quick-fix shapes |

## 3. External research sources

None yet. Upstream issue/PR links land here when D10 tasks are filed.

## 4. In-repo capability references

- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` — tsgo-rules gate, directive scanner.
- `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts` — `SFV4-tagged-error-equivalence`.
- `packages/foundation/modeling/identity/src/Id.ts` — `annoteError`, `adoptDeclaredFieldsEquivalence`.
- `packages/foundation/modeling/schema/src/Opaque.ts` — `Defect` wrapper.
- `goals/effect-vitest-canon/DECISIONS.md` — D14 provide rule (FileSystemConformance exemption owner).
- `goals/repo-crispening-orchestration/ops/prompts/` — prior discovery/remediation prompt shapes.

## 5. Cross-links & provenance

- `research/2026-09-12-grounding.md` — every measured number with its command.
- `research/origin-prompt-2026-09-12.md` — the verbatim starting prompt.
- Memory: `tsgo-033-adoption-campaign`, `tagged-error-equivalence-is-unstable`,
  `codex-exec-lane-sandbox-facts-2026-09-09`.
