import { Git, GitCommandError } from "@beep/git/Git";
import {
  collectBaseRangeChangedFiles,
  collectDirtyWorktreeFiles,
  decodeSchemaFirstPolicyFindingLine,
  encodeSchemaFirstPolicyFinding,
  GhPrView,
  JsonStringCodec,
  renderSchemaFirstPolicyFindingLine,
  SchemaFirstPolicyFinding,
  SchemaFirstPolicyIssuePrefix,
  SchemaFirstPolicySeverity,
} from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const UnknownJson = S.fromJsonString(S.Unknown);

it.layer(Layer.merge(BunCrypto.layer, Path.layer), { timeout: "10 seconds" })((it) => {
  describe("SchemaFirstPolicyFinding wire contract", { concurrent: false }, () => {
    const line = renderSchemaFirstPolicyFindingLine;

    it.effect("round-trips the emitter's warning finding unchanged", () =>
      Effect.gen(function* () {
        const finding = SchemaFirstPolicyFinding.make({
          category: "schema-first-policy",
          ruleId: "SFV4-defaults",
          severity: "warning",
          file: "packages/example/src/Widget.ts",
          line: 12,
          symbol: "Widget",
          message: "Prefer schema defaults.",
          remediation: "Apply S.withConstructorDefault.",
        });
        const rendered = yield* line(finding);
        expect(Str.startsWith(SchemaFirstPolicyIssuePrefix)(rendered)).toBe(true);
        const decoded = decodeSchemaFirstPolicyFindingLine(rendered);
        decoded.pipe(O.isSome, assertTrue);
        if (O.isSome(decoded)) {
          expect(decoded.value.severity).toBe("warning");
          expect(decoded.value.ruleId).toBe("SFV4-defaults");
          expect(decoded.value.remediation).toBe("Apply S.withConstructorDefault.");
          expect(decoded.value.line).toBe(12);
        }
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("round-trips an error finding", () =>
      Effect.gen(function* () {
        const finding = SchemaFirstPolicyFinding.make({
          category: "schema-first-policy",
          ruleId: "schema-first-inventory",
          severity: "error",
          file: "a.ts",
          message: "m",
          remediation: "r",
        });
        const line1 = yield* line(finding);
        const decoded = decodeSchemaFirstPolicyFindingLine(line1);
        assertSome(
          O.map(decoded, (f) => f.severity),
          "error"
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it("represents both the 'warn' and 'warning' severity spellings", () => {
      expect(SchemaFirstPolicySeverity.is.warn("warn")).toBe(true);
      expect(SchemaFirstPolicySeverity.is.warning("warning")).toBe(true);
      const warnLine = `${SchemaFirstPolicyIssuePrefix}${Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({
          category: "schema-first-policy",
          ruleId: "native-runtime",
          severity: "warn",
          file: "a.ts",
          message: "m",
        }),
        identity
      )}`;
      const decoded = decodeSchemaFirstPolicyFindingLine(warnLine);
      assertSome(
        O.map(decoded, (f) => f.severity),
        "warn"
      );
    });

    it("decodes a line with severity and remediation omitted", () => {
      const bare = `${SchemaFirstPolicyIssuePrefix}${Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({
          category: "schema-first-policy",
          ruleId: "r",
          file: "a.ts",
          message: "m",
        }),
        identity
      )}`;
      const decoded = decodeSchemaFirstPolicyFindingLine(bare);
      decoded.pipe(O.isSome, assertTrue);
      if (O.isSome(decoded)) {
        expect(decoded.value.severity).toBeUndefined();
        expect(decoded.value.remediation).toBeUndefined();
      }
    });

    it("drops non-matching and malformed lines", () => {
      decodeSchemaFirstPolicyFindingLine("plain output line").pipe(assertNone);
      decodeSchemaFirstPolicyFindingLine(`${SchemaFirstPolicyIssuePrefix}{not json`).pipe(assertNone);
    });

    it.effect("encodes to compact JSON with no prefix", () =>
      Effect.gen(function* () {
        const json = yield* encodeSchemaFirstPolicyFinding(
          SchemaFirstPolicyFinding.make({
            category: "schema-first-policy",
            ruleId: "r",
            file: "a.ts",
            message: "m",
          })
        );
        expect(Str.startsWith("{")(json)).toBe(true);
        expect(Str.includes(SchemaFirstPolicyIssuePrefix)(json)).toBe(false);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("Github plumbing", { concurrent: false }, () => {
    const codec = JsonStringCodec(GhPrView);

    it.effect("GhPrView decodes the narrow monitor payload", () =>
      Effect.gen(function* () {
        const view = yield* codec.decode('{"number":7,"headRefName":"feat","state":"OPEN"}');
        expect(view.number).toBe(7);
        expect(view.url).toBeUndefined();
        expect(view.isDraft).toBeUndefined();
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("GhPrView decodes the wide closeout payload", () =>
      Effect.gen(function* () {
        const view = yield* codec.decode(
          '{"number":7,"headRefName":"feat","state":"OPEN","url":"https://github.com/o/r/pull/7","headRefOid":"abc123","isDraft":false}'
        );
        expect(view.url).toBe("https://github.com/o/r/pull/7");
        expect(view.isDraft).toBe(false);
        expect(view.headRefOid).toBe("abc123");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("ChangedFiles kit error fold", { concurrent: false }, () => {
    // A `GitCommandError` without an exit code is a spawn that never ran git.
    const spawnFailure = GitCommandError.make({
      kind: "failed",
      args: ["diff"],
      cwd: "/repo",
      stderr: "",
      detail: "spawn ENOENT",
    });
    const withUnspawnableDiffs = Effect.provideService(
      Git,
      Git.makeTest({
        changedFiles: () => Effect.fail(spawnFailure),
        unstagedChanges: () => Effect.fail(spawnFailure),
        stagedChanges: () => Effect.succeed(["packages\\a\\src\\index.ts", " "]),
        untrackedFiles: () => Effect.succeed(A.empty()),
      })
    );

    it.effect("reports an unspawnable base-range diff with the capture's failed-to-run wording", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          collectBaseRangeChangedFiles("/repo", {
            base: "origin/main",
            head: "HEAD",
            diffFilter: "ACMR",
            pathspecs: [],
          })
        );
        expect(error.message).toBe(
          "git diff --name-only -z --no-relative --diff-filter=ACMR origin/main...HEAD failed to run."
        );
      }).pipe(withUnspawnableDiffs)
    );

    it.effect("fails a strict dirty scan on an unspawnable probe and degrades a tolerant one", () =>
      Effect.gen(function* () {
        const strict = yield* Effect.flip(
          collectDirtyWorktreeFiles("/repo", { pathspecs: [], onProbeFailure: "fail" })
        );
        expect(strict.message).toBe(
          'Unable to resolve dirty worktree files via "git diff --name-only -z --no-relative HEAD".'
        );
        const tolerant = yield* collectDirtyWorktreeFiles("/repo", { pathspecs: [], onProbeFailure: "ignore" });
        expect(tolerant).toStrictEqual(["packages/a/src/index.ts"]);
      }).pipe(withUnspawnableDiffs)
    );
  });
});
