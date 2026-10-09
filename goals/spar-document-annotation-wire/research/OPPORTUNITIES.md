# Friction receipts

## 2026-10-09 — Heavy wrapper requires the user-session bus

During dependency build preflight, `beep-heavy zsh -ic 'bunx turbo run build …'`
exited 1 before starting a gate: `Failed to connect to user scope bus` because
`DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` were undefined.
Recovery: supply the existing user runtime directory and session bus address to
the wrapper, retaining admission and memory limits. A launcher preflight that
exports the existing session bus would prevent this failure.

## 2026-10-09 — Unary dual and template-number checks need installed API validation

While authoring the source-id/fold API, inspection of installed
`effect/dist/Function.js` showed `dual(1, …)` throws `Invalid arity 1`.
The unary fold is already usable as a direct data-last function, so it uses
that form. Installed `Schema.js` documents that `TemplateLiteralParser`
applies checks on number parts; a plain `TemplateLiteral` matches the number
syntax. The source-id schema therefore adds a named canonical-index pattern
check. Neither issue was deferred to a failing package run. A skill note on
unary utilities and checked numeric template parts would prevent the detour.

## 2026-10-09 — Hosted-parity knowledge check inherited a host-path red

`CI=true bun run beep knowledge refs --check` exited 1 with one live gated
observation: `external-mirror-reference` in the repository-simplification-
confidence SPEC, line 374 (`home-absolute`). The affected file is byte-identical
to `origin/main` and was not edited in this lane. Attribution: inherited,
owned by the shared-main repair; this lane preserves the packet boundary.
A preflight that identifies changed-path versus base findings would prevent
feature lanes from rediscovering the same inherited red.

## 2026-10-09 — Focused Vitest commands must use package working directories

The initial focused fixture launches passed a package config from the repository
root, where the inherited `test/**/*.test.{ts,tsx}` include found no test files.
Attribution: the lane's command setup, not a fixture failure. Corrected launches
enter the package directory and pass package-relative test paths. Coverage
includes and output paths use the same package working-directory contract.
A canonical focused-test launcher in the brief would prevent this detour.

## 2026-10-09 — RDF audit test diagnostics

The first RDF package audit compiled production source, then rejected four test
lines: optional encoded context access, two unknown decoders on already typed
encoded values, and a nested schema/arbitrary call with a pipeable form.
The lane repaired all four in the content commit and acknowledged the audit
inbox row with its fix SHA. Runtime source/codec probes were already green;
package audit remains the authoritative proof of the repair.

- Hosted-parity attribution: `quality test-tsgo` caught `strictEffectProvide` in the new pinned-acquisition test. The package audit had passed, but its check configuration does not cover this additional Effect test diagnostic. Moved the test layer to the outer test entry point; retain both proof lanes.
- `docgen:local` reported `full-required` because `bun.lock` changed with the RDF-to-Md edge. Package docgen is green; the full docgen proof is now scheduled through the heavy wrapper.
- Fallow audit reported one introduced cognitive-complexity finding in `MdSections.ts` (`nest`, score 18). Replaced the nested boundary loop with `Array.findFirstIndex`; no suppression or baseline regeneration. Health's blocking complexity finding is the same new fold hotspot, so both lanes are rerun together.

- A callback's outer `Effect.provide` still triggers test TSGo's application-entry rule. Use the existing `it.layer` test runner boundary for service layers, rather than guessing that an outer callback is an application entry point. Final parity rerun uses that pattern.

- Full docgen failed in unchanged `@beep/infra` dependency `node_modules/@pulumi/gharunners`: TS1205 type re-exports, TS1294 parameter-property syntax and TS4114 missing overrides. `git diff origin/main...HEAD -- infra` is empty; the only lockfile hunk is RDF's workspace Md edge. This is an inherited upstream SDK/docgen compatibility red for S11 consolidation, not a SPAR package failure. Avoid a whole-repo snapshot regeneration or edits outside this lane.

- Wave 1 publication preflight rejected the unstaged P2 packet updates before any push: `requires reviewed staged changes or a clean local commit ahead`. Commit the reviewed packet updates first, then retry the same wave. The heavy-slot queue delayed this precondition feedback by about 23 minutes; push budget remains unused.
