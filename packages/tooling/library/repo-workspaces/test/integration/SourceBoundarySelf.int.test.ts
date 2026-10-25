// The package's own source, scanned by the scanner it ships. Real disk, real
// lexing: ConfigDependencyHooks.ts embeds a child script whose process.argv and
// process.stdout.write sit in TEMPLATE TEXT, which must not count, while two
// other modules really do read process.
import { SourceBoundary } from "@beep/repo-workspaces/testing";
import { resolve } from "@beep/utils/Path";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import { nodeHost } from "./utils/nodeFixture.ts";
import type { BoundaryRule } from "@beep/repo-workspaces/testing";

const SRC = resolve(import.meta.dirname, "..", "..", "src");
const TESTING_MODULES = HashSet.make(
  "testing.ts",
  "SourceBoundary.ts",
  "LayerPolicy.ts",
  "WorkspaceLayering.ts",
  "PackedInstall.ts",
  "internal/sourceText.ts",
  "internal/packedInstallPlan.ts",
  "internal/dependencyFields.ts"
);

/**
 * The modules that legitimately read `process`: the ambient cwd read and the
 * Node sync binding. Wave 4-W-a moved the config-dependency ladder onto
 * Effect's FileSystem, Path and Config, so only these two remain: the four
 * root-resolving services and `Workspaces.ts`'s `LocalExec` share
 * `internal/layerRoot.ts`'s one `ambientCwd` read, and `node-sync.ts`
 * resolves `node:fs` lazily on first use.
 */
const PROCESS_READERS: ReadonlyArray<string> = ["internal/layerRoot.ts", "node-sync.ts"];
const PROCESS_READ_COUNT = 2;

describe("@beep/repo-workspaces, scanned by SourceBoundary", () => {
  layer(nodeHost, { timeout: "30 seconds" })((it) => {
    it.effect("finds exactly the modules that read process, and not the replay script's template text", () =>
      Effect.gen(function* () {
        const scan = yield* SourceBoundary.scan({ root: SRC, rules: ["process"] });
        assert.include(scan.files, "ConfigDependencyHooks.ts", "the embedded script's module was read");
        assert.deepStrictEqual(A.dedupe(A.map(scan.offences, (offence) => offence.file)), PROCESS_READERS);
        assert.strictEqual(scan.offences.length, PROCESS_READ_COUNT);
      })
    );

    it.effect("the process allowlist is exact: with it the package is clean, and dropping any entry turns red", () =>
      Effect.gen(function* () {
        const clean = yield* SourceBoundary.scan({ root: SRC, rules: ["process"], allow: PROCESS_READERS });
        assert.deepStrictEqual(clean.violations, []);
        assert.deepStrictEqual(clean.allowed, PROCESS_READERS);
        for (const dropped of PROCESS_READERS) {
          const scan = yield* SourceBoundary.scan({
            root: SRC,
            rules: ["process"],
            allow: A.filter(PROCESS_READERS, (entry) => entry !== dropped),
          });
          assert.isNotEmpty(scan.violations, `dropping ${dropped} from the allowlist must surface its read`);
          assert.deepStrictEqual(
            A.dedupe(A.map(scan.offences, (offence) => offence.file)),
            [dropped],
            `only ${dropped} is reported once it is dropped`
          );
        }
      })
    );

    it.effect("the replay script's stdout write is template text, not a write", () =>
      Effect.gen(function* () {
        const scan = yield* SourceBoundary.scan({ root: SRC, rules: ["stdout-write"] });
        assert.isAbove(scan.files.length, 20);
        assert.deepStrictEqual(scan.violations, []);
      })
    );

    it.effect(
      "the ./testing modules read no process, import no node: or platform module, and touch no console or stdout",
      () =>
        Effect.gen(function* () {
          const rules: ReadonlyArray<BoundaryRule.Encoded> = [
            "process",
            "node:process",
            "stdout-write",
            "console",
            { forbidImports: ["node:*", "@effect/platform*"] },
          ];
          const scan = yield* SourceBoundary.scan({ root: SRC, rules });
          assert.include(scan.files, "SourceBoundary.ts", "the testing modules were read");
          assert.isNotEmpty(
            A.filter(scan.offences, (offence) => !HashSet.has(TESTING_MODULES, offence.file)),
            "the same rules do flag the modules outside ./testing"
          );
          assert.deepStrictEqual(
            A.map(
              A.filter(scan.offences, (offence) => HashSet.has(TESTING_MODULES, offence.file)),
              (offence) => offence.label
            ),
            []
          );
        })
    );
  });
});
