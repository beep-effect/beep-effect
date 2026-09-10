import {
  EffectVitestFinding,
  EffectVitestReplacement,
  readEffectVitestInventory,
  writeEffectVitestRows,
} from "@beep/repo-cli/commands/Lint";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";

const row = EffectVitestFinding.make({
  id: "EV001:packages/example/test/a.test.ts:1:runSync@0#1",
  lens: "detector",
  ruleId: "EV001",
  package: "@beep/example",
  file: "packages/example/test/a.test.ts",
  line: 1,
  endLine: O.some(1),
  symbol: O.some("runSync"),
  testName: O.none(),
  class: "runtime-boundary-in-test",
  evidence: "Effect.runSync(program)",
  replacement: EffectVitestReplacement.make({ primitive: "it.effect", sketch: "Return the Effect." }),
  severity: "major",
  confidence: 0.95,
  mechanization: "detector",
  status: "open",
  reason: O.none(),
  fixSha: O.none(),
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("rows filesystem", (it) => {
  it.effect(
    "distinguishes a missing inventory from corrupt inventory bytes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-inventory-read-" });
      const absent = yield* readEffectVitestInventory(root);
      assertTrue(O.isNone(absent), "A missing baseline remains absent");
      yield* fs.makeDirectory(path.join(root, "standards"));
      yield* fs.writeFileString(path.join(root, "standards/effect-vitest.inventory.jsonc"), "{broken");
      const failure = yield* readEffectVitestInventory(root).pipe(Effect.flip);
      assertTrue(failure._tag === "EffectVitestLintError");
      assertTrue(Str.includes("Unable to decode")(failure.message));
      yield* fs.remove(path.join(root, "standards/effect-vitest.inventory.jsonc"));
      yield* fs.makeDirectory(path.join(root, "standards/effect-vitest.inventory.jsonc"));
      const unreadable = yield* readEffectVitestInventory(root).pipe(Effect.flip);
      assertTrue(Str.includes("Unable to read")(unreadable.message));
    })
  );

  it.effect(
    "preserves empty and unreadable JSONL entries whose ownership cannot be established",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-unowned-rows-" });
      const output = path.join(root, "rows");
      yield* fs.makeDirectory(output);
      yield* fs.writeFileString(path.join(output, "empty.jsonl"), "\n  \n");
      yield* fs.makeDirectory(path.join(output, "directory.jsonl"));
      yield* writeEffectVitestRows(root, "rows", []);
      assertTrue((yield* fs.readFileString(path.join(output, "empty.jsonl"))) === "\n  \n");
      assertTrue((yield* fs.stat(path.join(output, "directory.jsonl"))).type === "Directory");
    })
  );

  it.effect(
    "replaces the generated JSONL set while preserving unrelated files",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-vitest-rows-" });
      const output = path.join(root, "rows");
      yield* fs.makeDirectory(output, { recursive: true });
      yield* fs.writeFileString(path.join(output, "keep.txt"), "unrelated\n");
      yield* fs.writeFileString(path.join(output, "unrelated.jsonl"), '{"producer":"other"}\n');

      yield* writeEffectVitestRows(root, "rows", [row]);
      const generated = A.findFirst(
        yield* fs.readDirectory(output),
        (fileName) => fileName !== "unrelated.jsonl" && Str.endsWith(".jsonl")(fileName)
      );
      assertTrue(O.isSome(generated), "Expected the detector-owned JSONL file alongside unrelated files");
      const first = yield* fs.readFileString(path.join(output, generated.value));

      yield* writeEffectVitestRows(root, "rows", [row]);
      const second = yield* fs.readFileString(path.join(output, generated.value));
      assertTrue(first === second);

      yield* writeEffectVitestRows(root, "rows", []);
      assertFalse(yield* fs.exists(path.join(output, generated.value)));
      assertTrue((yield* fs.readFileString(path.join(output, "keep.txt"))) === "unrelated\n");
      assertTrue((yield* fs.readFileString(path.join(output, "unrelated.jsonl"))) === '{"producer":"other"}\n');
    })
  );
});
