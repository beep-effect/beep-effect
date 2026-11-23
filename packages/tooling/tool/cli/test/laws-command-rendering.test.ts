import { lawsCommand } from "@beep/repo-cli/commands/Laws";
import * as Comments from "@beep/repo-cli/commands/Laws/CommentLaw";
import { CommentLawFinding, CommentLawSummary } from "@beep/repo-cli/commands/Laws/CommentLaw.model";
import * as Imports from "@beep/repo-cli/commands/Laws/EffectImports";
import * as Freeze from "@beep/repo-cli/commands/Laws/EntityKitFreeze";
import { EntityKitFreezeSummary } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model";
import * as Markdown from "@beep/repo-cli/commands/Laws/MarkdownFences";
import { MarkdownFenceDiagnostic, MarkdownFencesSummary } from "@beep/repo-cli/commands/Laws/MarkdownFences.model";
import * as Native from "@beep/repo-cli/commands/Laws/NoNativeRuntime";
import * as Homes from "@beep/repo-cli/commands/Laws/PrivateHomePaths";
import { PrivateHomePathsSummary } from "@beep/repo-cli/commands/Laws/PrivateHomePaths.model";
import * as Retired from "@beep/repo-cli/commands/Laws/RetiredEffectPaths";
import { RetiredEffectPathsSummary } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model";
import * as Iri from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities";
import { RetiredIriAuthoritiesSummary } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model";
import * as Terse from "@beep/repo-cli/commands/Laws/TerseEffect";
import { it } from "@beep/test-runner";
import { expect, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";

const run = Command.runWith(lawsCommand, { version: "0.0.0" });
const command = Effect.fn("LawsRenderingTest.command")(
  function* (args: ReadonlyArray<string>) {
    const exit = yield* run(args).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
      Effect.exit
    );
    const lines = yield* TestConsole.logLines;
    return { exit, lines };
  },
  Effect.provideServiceEffect(Console.Console, TestConsole.make)
);

it.layer(NodeTestLayer, { timeout: "30 seconds" })((it) => {
  it.effect(
    "renders a located finding without a comment kind using its rule name",
    Effect.fnUntraced(function* () {
      const spy = vi.spyOn(Comments, "runCommentLaw").mockReturnValue(
        Effect.succeed(
          CommentLawSummary.make({
            enforcement: "advisory",
            base: "base",
            changedFiles: 1,
            introduced: 0,
            removed: 0,
            failed: false,
            findings: [
              CommentLawFinding.make({
                rule: "dangling-decision-pointer",
                file: "a.ts",
                line: 1,
                excerpt: "missing decision",
              }),
            ],
            advisories: [],
          })
        )
      );
      yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
      const result = yield* command(["comments"]);
      result.exit.pipe(Exit.isSuccess, assertTrue);
      expect(result.lines).toContain('  - a.ts:1  dangling-decision-pointer  "missing decision"');
    })
  );

  it.effect(
    "renders import rewrites, manual reviews and parser warnings and preserves JSON success",
    Effect.fnUntraced(function* () {
      const spy = vi.spyOn(Imports, "runEffectImportRules");
      yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
      const summary = Imports.EffectImportRulesSummary.make({
        mode: "code",
        write: false,
        candidate: false,
        scannedFiles: 1,
        scannedFences: 0,
        touchedFiles: 1,
        rootImportsRewritten: 1,
        rootExportsRewritten: 0,
        emittedImports: 1,
        emittedExports: 0,
        rootSpecifierCounts: { effect: 1 },
        strictFailure: true,
        changedFiles: ["packages/a/src/A.ts"],
        manualReviews: [
          Imports.EffectImportManualReview.make({
            kind: "missing-mapping",
            file: "packages/a/src/A.ts",
            line: 1,
            moduleSpecifier: "effect",
            binding: "Future",
            reason: "No public leaf",
          }),
        ],
        parserWarnings: ["packages/a/src/A.ts: incomplete import"],
      });
      spy.mockReturnValue(Effect.succeed(summary));
      const failed = yield* command(["effect-imports", "--check"]);
      failed.exit.pipe(Exit.isFailure, assertTrue);
      expect(failed.lines).toContain("packages/a/src/A.ts");
      expect(failed.lines).toContain("[effect-governance-imports] root_specifier module=effect count=1");
      expect(failed.lines).toContain(
        "[effect-governance-imports] parser_warning packages/a/src/A.ts: incomplete import"
      );
      spy.mockReturnValue(
        Effect.succeed(Imports.EffectImportRulesSummary.make({ ...summary, strictFailure: false, write: true }))
      );
      const written = yield* command(["effect-imports", "--write"]);
      written.exit.pipe(Exit.isSuccess, assertTrue);
      expect(written.lines).toContain("[effect-governance-imports] operation=write");
      const json = yield* command(["effect-imports", "--json"]);
      json.exit.pipe(Exit.isSuccess, assertTrue);
    })
  );

  it.effect(
    "reports manual terse-effect candidates after safe rewrites",
    Effect.fnUntraced(function* () {
      const spy = vi.spyOn(Terse, "runTerseEffectRules");
      yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
      spy.mockReturnValue(
        Effect.succeed(
          Terse.TerseEffectRulesSummary.make({
            touchedFiles: 1,
            helpersSimplified: 0,
            thunkHelpersSimplified: 0,
            flowCandidatesDetected: 1,
            optionObjectCompactionCandidatesDetected: 0,
            conditionalOptionalObjectSpreadCandidatesDetected: 0,
            nestedOptionMatchCandidatesDetected: 0,
            nestedBoolMatchCandidatesDetected: 0,
            dualOverloadCandidatesDetected: 0,
            strictFailure: false,
            blockingFiles: ["packages/a/src/A.ts"],
          })
        )
      );
      const result = yield* command(["terse-effect"]);
      result.exit.pipe(Exit.isSuccess, assertTrue);
      expect(result.lines).toContain(
        "[effect-governance-terse-effect] Manual terse-effect candidates remain after safe rewrites."
      );
    })
  );

  it.effect(
    "keeps each text law's strict failure exit and renders skipped exemptions",
    Effect.fnUntraced(function* () {
      const retired = vi.spyOn(Retired, "runRetiredEffectPaths").mockReturnValue(
        Effect.succeed(
          RetiredEffectPathsSummary.make({
            scannedFiles: 1,
            skippedBinaryFiles: 0,
            allowlistedFiles: 0,
            strictFailure: true,
          })
        )
      );
      const iri = vi.spyOn(Iri, "runRetiredIriAuthorities").mockReturnValue(
        Effect.succeed(
          RetiredIriAuthoritiesSummary.make({
            scannedFiles: 1,
            skippedBinaryFiles: 0,
            exemptFiles: 0,
            strictFailure: true,
          })
        )
      );
      const homes = vi.spyOn(Homes, "runPrivateHomePaths").mockReturnValue(
        Effect.succeed(
          PrivateHomePathsSummary.make({
            scannedFiles: 1,
            skippedBinaryFiles: 0,
            exemptFiles: 0,
            strictFailure: true,
            skippedExemptions: ["goals/absent/SPEC.md"],
          })
        )
      );
      const freeze = vi.spyOn(Freeze, "runEntityKitFreeze").mockReturnValue(
        Effect.succeed(
          EntityKitFreezeSummary.make({
            scannedFiles: 1,
            skippedBinaryFiles: 0,
            outOfScopeFiles: 0,
            importerFiles: 1,
            baselineFiles: 0,
            prunedFiles: 0,
            wroteBaseline: true,
            strictFailure: true,
          })
        )
      );
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          retired.mockRestore();
          iri.mockRestore();
          homes.mockRestore();
          freeze.mockRestore();
        })
      );
      for (const law of [
        "retired-effect-paths",
        "retired-iri-authorities",
        "private-home-paths",
        "entity-kit-freeze",
      ]) {
        const result = yield* command([law, "--check", ...(law === "entity-kit-freeze" ? ["--write"] : [])]);
        result.exit.pipe(Exit.isFailure, assertTrue);
        expect(String(result.exit)).toContain("check failed");
        if (law === "private-home-paths")
          expect(result.lines).toContain(
            "[effect-governance-private-home-paths] skipped goals/absent/SPEC.md: its packet is absent from this checkout"
          );
      }
    })
  );

  it.effect(
    "renders unreadable Markdown diagnostics with their source locations",
    Effect.fnUntraced(function* () {
      const spy = vi.spyOn(Markdown, "runMarkdownFences").mockReturnValue(
        Effect.succeed(
          MarkdownFencesSummary.make({
            scannedFiles: 1,
            fenceFiles: 1,
            fences: 0,
            checkedFences: 0,
            optOutFences: 0,
            generatedFences: 0,
            strictFailure: true,
            unreadable: [
              MarkdownFenceDiagnostic.make({
                path: "docs/guide.md",
                line: 3,
                column: 2,
                code: "markdown-parse",
                message: "unclosed fence",
              }),
            ],
          })
        )
      );
      yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
      const result = yield* command(["markdown-fences", "--check"]);
      result.exit.pipe(Exit.isFailure, assertTrue);
      expect(result.lines).toContain("docs/guide.md:3:2  markdown-parse unclosed fence");
    })
  );

  it.effect(
    "renders native-runtime diagnostics in report and strict modes",
    Effect.fnUntraced(function* () {
      const spy = vi.spyOn(Native, "runNoNativeRuntimeRules");
      yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
      for (const check of [false, true]) {
        spy.mockReturnValue(
          Effect.succeed(
            Native.NoNativeRuntimeRulesSummary.make({
              scannedFiles: 1,
              touchedFiles: 1,
              warningCount: 0,
              errorCount: 1,
              strictFailure: check,
              diagnostics: [
                Native.NoNativeRuntimeDiagnostic.make({
                  severity: "error",
                  file: "packages/a/src/A.ts",
                  line: 2,
                  column: 3,
                  message: "Use Effect helpers",
                }),
              ],
            })
          )
        );
        const result = yield* command(["native-runtime", ...(check ? ["--check"] : [])]);
        if (check) result.exit.pipe(Exit.isFailure, assertTrue);
        else result.exit.pipe(Exit.isSuccess, assertTrue);
        expect(result.lines).toContain("- [error] packages/a/src/A.ts:2:3 Use Effect helpers");
      }
    })
  );
});
