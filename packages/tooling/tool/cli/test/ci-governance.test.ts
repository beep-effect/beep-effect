import {
  decideHeavyAdmission,
  desktopEnvironmentApproved,
  HeavyAdmissionEvent,
  heldGroupRunIds,
  prSizeLabelDiff,
  setupCacheWriteDisabled,
  workflowPolicyDiagnostics,
} from "@beep/repo-cli/commands/Ci";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

const writer = (environment: string, token = "${{ github.event_name == 'push' && secrets.TURBO_TOKEN || '' }}") =>
  `on: push\njobs:\n  writer:\n    environment: "${environment}"\n    steps:\n      - uses: ./.github/actions/setup-monorepo-ci\n        with:\n          turbo-token: "${token}"\n`;
describe("CI governance policy", () => {
  it.effect("requires a writer environment and trusted caller expression", () =>
    Effect.gen(function* () {
      expect(
        yield* workflowPolicyDiagnostics(
          "fixture.yml",
          writer("${{ github.event_name == 'push' && 'turbo-cache-write' || null }}")
        )
      ).toEqual([]);
      expect(yield* workflowPolicyDiagnostics("fixture.yml", writer(""))).toContain(
        "writer: write token requires the trusted Turbo writer environment"
      );
      expect(
        yield* workflowPolicyDiagnostics("fixture.yml", writer("turbo-cache-write", "${{ secrets.TURBO_TOKEN }}"))
      ).toContain("writer: writer input must stay guarded in the caller workflow");
    })
  );
  it.effect("rejects an unguarded step environment writer token", () =>
    Effect.gen(function* () {
      const text =
        'on: push\njobs:\n  writer:\n    environment: turbo-cache-write\n    steps:\n      - run: bun run check\n        env:\n          TURBO_TOKEN: "${{ secrets.TURBO_TOKEN }}"\n';
      expect(yield* workflowPolicyDiagnostics("fixture.yml", text)).toContain(
        "writer: writer input must stay guarded in the caller workflow"
      );
    })
  );
  it.effect("rejects a matrix writer without the Turbo-only condition", () =>
    Effect.gen(function* () {
      const text = `${writer("${{ github.event_name == 'push' && 'turbo-cache-write' || null }}")}    strategy:\n      matrix:\n        include:\n          - uses_turbo: 'false'\n`;
      expect(yield* workflowPolicyDiagnostics("fixture.yml", text)).toContain(
        "writer: write token requires the trusted Turbo writer environment"
      );
    })
  );
  it.effect("rejects unbounded artifacts and cancelled main pushes", () =>
    Effect.gen(function* () {
      const text =
        "on:\n  push:\n    branches: [main]\nconcurrency:\n  group: main\n  cancel-in-progress: true\njobs:\n  upload:\n    steps:\n      - uses: actions/upload-artifact@abc\n        with:\n          path: output\n";
      expect(yield* workflowPolicyDiagnostics("fixture.yml", text)).toEqual([
        "upload: artifact retention-days missing",
        "main pushes must not be cancelled by workflow concurrency",
      ]);
    })
  );
  it.effect("fails on malformed YAML rather than reporting clean", () =>
    Effect.gen(function* () {
      expect(yield* workflowPolicyDiagnostics("bad.yml", "jobs: [").pipe(Effect.isFailure)).toBe(true);
    })
  );
  it.effect("requires cache-write to default to false", () =>
    Effect.gen(function* () {
      expect(yield* setupCacheWriteDisabled('inputs:\n  cache-write:\n    default: "false"\n')).toBe(true);
      expect(yield* setupCacheWriteDisabled('inputs:\n  cache-write:\n    default: "true"\n')).toBe(false);
      expect(yield* setupCacheWriteDisabled("inputs: {}\n")).toBe(false);
    })
  );
  it.effect("keeps exactly one size label and preserves unrelated labels", () =>
    Effect.sync(() => {
      expect(prSizeLabelDiff(25, ["size/S", "size/L", "bug"])).toEqual({
        label: "size/L",
        remove: ["size/S"],
        add: false,
      });
      expect(prSizeLabelDiff(3, [])).toEqual({ label: "size/S", remove: [], add: true });
      expect(A.map([10, 11, 20, 21, 50, 51], (count) => prSizeLabelDiff(count, []).label)).toEqual([
        "size/S",
        "size/M",
        "size/M",
        "size/L",
        "size/L",
        "size/XL",
      ]);
    })
  );
  it.effect("requires a nonempty reviewer rule", () =>
    Effect.sync(() => {
      expect(desktopEnvironmentApproved({ protection_rules: [] })).toBe(false);
      expect(desktopEnvironmentApproved({ protection_rules: [{ type: "required_reviewers", reviewers: [] }] })).toBe(
        false
      );
      expect(
        desktopEnvironmentApproved({
          protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }] }],
        })
      ).toBe(true);
    })
  );
  it.effect("detects the old waiting main run and pending successor", () =>
    Effect.sync(() => {
      const old = { id: 1, status: "waiting", created_at: "2026-10-09T12:00:00Z", head_branch: "main" };
      const next = { id: 2, status: "pending", created_at: "2026-10-09T13:00:00Z", head_branch: "main" };
      const now = 1791554400000;
      expect(heldGroupRunIds([old, next], now)).toEqual([1]);
      expect(heldGroupRunIds([next], now)).toEqual([]);
      expect(heldGroupRunIds([{ ...old, status: "completed" }, next], now)).toEqual([]);
      expect(heldGroupRunIds([old, next], 1791547200000)).toEqual([]);
    })
  );
  it.effect("holds forks even when docs-only until distinctly approved", () =>
    Effect.sync(() => {
      const fork = HeavyAdmissionEvent.make({
        eventName: "pull_request",
        headRepository: "external/fork",
        baseRepository: "beep-effect/beep-effect",
        labels: ["ready-for-heavy"],
        changedPaths: ["docs/a.md"],
      });
      expect(decideHeavyAdmission(fork).verdict).toBe("hold");
      expect(
        decideHeavyAdmission(HeavyAdmissionEvent.make({ ...fork, labels: ["ready-for-heavy", "ready-for-heavy-fork"] }))
          .verdict
      ).toBe("run");
      expect(
        decideHeavyAdmission(HeavyAdmissionEvent.make({ ...fork, headRepository: "beep-effect/beep-effect" })).verdict
      ).toBe("run");
    })
  );
});
