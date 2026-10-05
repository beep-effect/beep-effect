#!/usr/bin/env bash
# W1 reproducible lever query (goals/ciops-ontology-pipeline, graduation Ruling 6).
# Lists every first-parent commit on the current branch since the iv-870 landing instant
# that touches one of the four path families (widened by P0 Rulings 5 and 7), as TSV:
# family, sha, committedAt, subject.
# The PR number is the trailing "(#N)" of a squash subject or the N of a
# "Merge pull request #N" subject; landing instants are then re-verified
# with: gh pr view <N> --json mergedAt,mergeCommit
# Run from the repository root. Pure git; no network. `:(glob)**/turbo.json` and
# `:(glob)**/docgen.json` are git pathspecs, so deleted files stay in the search (a removed
# task override or docgen config is a change too). The package-scripts probe is a `git log -G`
# over every package.json: a commit enters it only when a script-entry line of a task-facing
# script was added or removed (keys: beep:*, every Turbo task name at 8b7392fe00 — audit,
# build, check, codegen, coverage, docgen, doctest, lint, package-test-typecheck, storybook,
# test, transit — plus typecheck and proof, each with or without a :sub suffix), because
# workspace scripts assemble what a Turbo task runs.
set -euo pipefail
set -f  # family entries may be git pathspec globs; never let the shell expand them
SINCE="${W1_SINCE:-2026-08-27T19:52Z}"
families() {
  cat <<FAMILIES
scheduler-admission|packages/tooling/tool/cli/src/internal/repo-run scripts/systemd
turbo-cache|:(glob)**/turbo.json .envrc packages/tooling/tool/cli/src/commands/Cache .github/workflows/cache-warm.yml packages/tooling/tool/cli/src/internal/cli/TurboCache.ts packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts standards/cache-qualification.json standards/turbo-remote-cache.md packages/tooling/policy-pack/repo-configs/src/cache scripts/enable-turbo-remote-reads.sh infra/src/CiTurboCache.ts infra/lambda/turbo-cache
lane-assembly|:(glob)**/docgen.json packages/tooling/tool/cli/src/commands/Yeet packages/tooling/tool/cli/src/commands/Quality packages/tooling/tool/cli/src/commands/Ci packages/tooling/tool/cli/src/commands/Lint packages/tooling/tool/cli/src/commands/Docgen/internal packages/tooling/tool/cli/src/internal/package-scripts standards/lint-policy.sweeps.jsonc vitest.shared.ts .github/workflows/check.yml .github/workflows/heavy.yml .github/workflows/heavy-admit.yml .github/actions/setup-monorepo-ci scripts/ci-change-profile.sh scripts/ci-job-env.mjs
hosted-runner|packages/tooling/tool/cli/src/commands/Runners infra/src/CiFleetController.ts infra/src/CiRunners.ts infra/src/internal/ci-runners-entry.ts infra/ci-runners/Pulumi.production.yaml infra/ci-runners/Pulumi.yaml infra/ci-runners/runner-image.json scripts/ci-runner-resources.sh docs/runbooks/ci-runner-reliability.md docs/runbooks/aws-cost-operations.md .github/workflows/fleet-lane-probe.yml .github/workflows/fleet-shadow-check.yml .github/workflows/rerun-runner-loss.yml .github/workflows/heavy.yml .github/workflows/heavy-admit.yml .github/workflows/check.yml
FAMILIES
}
families | while IFS='|' read -r family paths; do
  for path in $paths; do
    git log --since="$SINCE" --first-parent --format="%H%x09%cI%x09%s" -- "$path"
  done | sort -u | sed "s/^/${family}\t/"
done

# Fifth family: script-entry changes in any package.json (see the header).
SCRIPT_ENTRY_RX='^\s*"(beep:[^"]+|(audit|build|check|codegen|coverage|docgen|doctest|lint|package-test-typecheck|storybook|test|transit|typecheck|proof)(:[^"]+)?)":\s*"'
git log --since="$SINCE" --first-parent --format="%H%x09%cI%x09%s" -G "$SCRIPT_ENTRY_RX" -- ':(glob)**/package.json' \
  | sort -u | sed "s/^/package-scripts\t/"
