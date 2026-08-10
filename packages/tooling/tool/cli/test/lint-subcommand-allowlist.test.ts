import { lintCommand } from "@beep/repo-cli/commands/Lint";
import { LintPolicySubcommand } from "@beep/repo-cli/test/Quality";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Order, Path, pipe } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const CommandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);
const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });

describe("commands/Lint fast-path allowlist binding", () => {
  // bin-main.ts routes `beep lint <sub>` to the full command tree only when
  // <sub> is in the LintPolicySubcommand domain; a registered subcommand
  // missing from the domain is silently swallowed by the turbo lint aggregate
  // (the judge-rubric incident, 2026-08-08). This binds the two surfaces.
  it("LintPolicySubcommand exactly matches the subcommands registered on lintCommand", () => {
    const registered = pipe(
      lintCommand.subcommands,
      A.flatMap((group) => group.commands),
      A.map((command) => command.name)
    );
    expect(sortedNames(LintPolicySubcommand.literals)).toEqual(sortedNames(registered));
  });

  it.effect(
    "lists every registered subcommand in the lint help index",
    Effect.fnUntraced(function* () {
      yield* runLintCommand([]);
      const lines = yield* TestConsole.logLines;
      const registered = pipe(
        lintCommand.subcommands,
        A.flatMap((group) => group.commands),
        A.map((command) => `- bun run beep lint ${command.name}`)
      );

      for (const line of registered) {
        expect(lines).toContain(line);
      }
    }, provideScopedLayer(CommandTestLayer))
  );
});

describe("internal/cli LintRouting dependency-free boundary", () => {
  // bin-main.ts pays every eager import on every `beep` invocation before its
  // fast-path branches run; routing data hidden behind a heavier module cost
  // ~1.1s/415MB of startup (the round-1 ARCH-BOUNDARY-01 regression). Existing
  // tests only compare routing values, so a routine helper import added to
  // LintRouting.ts would restore the regression while staying green. Guard the
  // boundary at the source level — a timing assertion would be
  // environment-sensitive.
  it.effect(
    "LintRouting stays import-free and is bin-main's only eager module import",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const sourceDir = path.join(repoRoot, "packages/tooling/tool/cli/src");
      const routingSource = yield* fs.readFileString(path.join(sourceDir, "internal/cli/LintRouting.ts"));
      const binMainSource = yield* fs.readFileString(path.join(sourceDir, "bin-main.ts"));
      const importLines = (source: string): ReadonlyArray<string> =>
        pipe(source, Str.split("\n"), A.filter(Str.startsWith("import ")));

      expect(importLines(routingSource)).toEqual([]);
      expect(routingSource).not.toContain("import(");

      const eagerImports = A.filter(importLines(binMainSource), (line) => !Str.startsWith("import type ")(line));
      expect(eagerImports).toHaveLength(1);
      expect(eagerImports[0]).toContain('"./internal/cli/LintRouting.ts"');
    }, provideScopedLayer(PlatformLayer))
  );
});
