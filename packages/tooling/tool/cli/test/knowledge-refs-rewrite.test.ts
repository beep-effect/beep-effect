import {
  KnowledgeRewriteRule,
  KnowledgeRewriteRules,
  rewriteKnowledgeReferences,
} from "@beep/repo-cli/commands/Knowledge";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const fixture = Effect.fn("KnowledgeRewriteTest.fixture")(function* (rules: ReadonlyArray<KnowledgeRewriteRule>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-rewrite-" });
  yield* fs.makeDirectory(path.join(root, "scripts"));
  const rulesFile = path.join(root, "scripts", "knowledge-refs-rewrite.rules.json");
  yield* fs.writeFileString(
    rulesFile,
    yield* S.encodeEffect(S.fromJsonString(KnowledgeRewriteRules))(
      KnowledgeRewriteRules.make({ schemaVersion: "knowledge-refs-rewrite/v1", rules })
    )
  );
  return { fs, path, root, rulesFile };
});

it.layer(NodeServices.layer)("knowledge refs rewrite", (it) => {
  it.effect(
    "reports exact sequential counts, leaves dry runs untouched, and is idempotent",
    Effect.fnUntraced(function* () {
      const f = yield* fixture([
        KnowledgeRewriteRule.make({ path: "doc.md", find: "old", replace: "intermediate", count: 2, note: O.none() }),
        KnowledgeRewriteRule.make({ path: "doc.md", find: "intermediate", replace: "new", count: 2, note: O.none() }),
      ]);
      const target = f.path.join(f.root, "doc.md");
      yield* f.fs.writeFileString(target, "old old");
      expect(yield* rewriteKnowledgeReferences(f.root, true)).toMatchObject({
        applied: 2,
        skipped: 0,
        failures: [],
        dryRun: true,
      });
      expect(yield* f.fs.readFileString(target)).toBe("old old");
      expect(yield* rewriteKnowledgeReferences(f.root, false)).toMatchObject({ applied: 2, skipped: 0, failures: [] });
      expect(yield* f.fs.readFileString(target)).toBe("new new");
      expect(yield* rewriteKnowledgeReferences(f.root, false)).toMatchObject({ applied: 0, skipped: 2, failures: [] });
    })
  );

  it.effect(
    "refuses a whole drifted file while preserving progress in independent files",
    Effect.fnUntraced(function* () {
      const f = yield* fixture([
        KnowledgeRewriteRule.make({ path: "drift.md", find: "first", replace: "changed", count: 1, note: O.none() }),
        KnowledgeRewriteRule.make({ path: "drift.md", find: "second", replace: "changed", count: 1, note: O.none() }),
        KnowledgeRewriteRule.make({ path: "valid.md", find: "old", replace: "new", count: 1, note: O.none() }),
        KnowledgeRewriteRule.make({ path: "missing.md", find: "old", replace: "new", count: 1, note: O.none() }),
      ]);
      yield* f.fs.writeFileString(f.path.join(f.root, "drift.md"), "first second second");
      yield* f.fs.writeFileString(f.path.join(f.root, "valid.md"), "old");
      const report = yield* rewriteKnowledgeReferences(f.root, false);
      expect(report.applied).toBe(2);
      expect(report.failures).toContain("drift.md: expected 1 occurrence(s), found 2");
      expect(report.failures).toContain("missing.md: unreadable");
      expect(yield* f.fs.readFileString(f.path.join(f.root, "drift.md"))).toBe("first second second");
      expect(yield* f.fs.readFileString(f.path.join(f.root, "valid.md"))).toBe("new");
    })
  );

  it.effect(
    "refuses symlink targets without altering their referents",
    Effect.fnUntraced(function* () {
      const f = yield* fixture([
        KnowledgeRewriteRule.make({ path: "linked.md", find: "old", replace: "new", count: 1, note: O.none() }),
      ]);
      const referent = f.path.join(f.root, "referent.md");
      yield* f.fs.writeFileString(referent, "old");
      yield* f.fs.symlink(referent, f.path.join(f.root, "linked.md"));
      expect((yield* rewriteKnowledgeReferences(f.root, false)).failures).toEqual(["linked.md: unreadable"]);
      expect(yield* f.fs.readFileString(referent)).toBe("old");
    })
  );

  it.effect(
    "rejects unknown rule versions and empty search strings before any writes",
    Effect.fnUntraced(function* () {
      const f = yield* fixture([]);
      for (const input of [
        '{"schemaVersion":"other","rules":[]}',
        '{"schemaVersion":"knowledge-refs-rewrite/v1","rules":[{"path":"doc.md","find":"","replace":"new","count":1}]}',
        '{"schemaVersion":"knowledge-refs-rewrite/v1","rules":[{"path":"../escape.md","find":"old","replace":"new","count":1}]}',
      ]) {
        yield* f.fs.writeFileString(f.rulesFile, input);
        expect(yield* rewriteKnowledgeReferences(f.root, false).pipe(Effect.isFailure)).toBe(true);
      }
    })
  );
});
