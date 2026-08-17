# GOAL: Harden root lint advisories into failures

Repo: `beep-effect` (this checkout).

Outcome: root `bun run lint` no longer prints nonfatal law warnings or advisory
notes, and PR CI/Yeet quality paths fail if they return.

Treat packet files as the detailed contract:

- `goals/lint-advisory-hardening/README.md`
- `goals/lint-advisory-hardening/SPEC.md`
- `goals/lint-advisory-hardening/PLAN.md`
- `goals/lint-advisory-hardening/ops/manifest.json`
- `goals/lint-advisory-hardening/tasks/tasks.jsonc`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and governing standards:
`standards/effect-laws-v1.md`, `standards/architecture/07-non-slice-families.md`,
and `standards/architecture/08-testing.md`.

Scope:

- In: `packages/tooling/tool/cli`, `packages/tooling/policy-pack/repo-configs`,
  `.github/workflows/check.yml`, current lint-warning source files, reflection
  artifacts for completed packets, and this packet.
- Out: Fallow advisory promotion, broad architecture doctrine changes,
  unrelated package refactors, and unrelated generated metadata.

Workflow:

1. Preserve unrelated worktree changes.
2. Harden false positives before inventory-driven cleanup.
3. Fix the current `terse-effect`, `native-runtime`, and `reflection-artifacts`
   backlog.
4. Add `bun run beep lint policy` and wire it into PR CI as an unscoped lane.
5. Promote root lint advisory categories to hard failures.
6. Verify focused checks, root lint, and Yeet quality/publish/monitor.
7. At closeout, write this packet's reflection and update evidence/status.

Acceptance:

- [ ] `bun run beep laws terse-effect --check` reports no findings and fails on
      future flow candidates.
- [ ] `bun run beep laws native-runtime --check` reports zero warnings/errors
      except allowlisted legitimate exceptions.
- [ ] `bun run beep lint reflection-artifacts` reports zero advisories/blockers.
- [ ] `bun run beep lint schema-first` fails future advisories.
- [ ] PR CI runs `bun run beep lint policy` outside affected Turbo lint.
- [ ] `bun run lint` and Yeet verification pass.

Verification:

```sh
test "$(wc -m < goals/lint-advisory-hardening/GOAL.md)" -le 4000
jq . goals/lint-advisory-hardening/ops/manifest.json
git diff --check -- goals/lint-advisory-hardening
```

Stop and report before expanding scope beyond root lint policy or making Fallow
advisory lanes blocking.
