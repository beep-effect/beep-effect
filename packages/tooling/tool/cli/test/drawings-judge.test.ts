import { DrawingsCommandError, ingestDrawingJudgeInventory } from "@beep/repo-cli/commands/Drawings";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";

const inventory = (lens: string, evidencePath: string, requiredCount = 1) => ({
  schemaVersion: "qa-inventory/v1",
  round: 1,
  sessionRef: "../../manifest.json",
  judge: { model: "claude-opus-5-5", effort: "inherited" },
  findings: [
    {
      id: "R1-01",
      severity: "P1",
      lens,
      title: "Tab folds up in FIG. 5 but down in FIG. 1",
      evidence: [{ kind: "sheet", path: evidencePath, eventIds: [] }],
      repro: "Compare FIG. 1 and FIG. 5.",
      fix: "Flip the tab rotation sign in the spec.",
    },
  ],
  requiredCount,
});

const writePack = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped();
  yield* fs.makeDirectory(path.join(dir, "sheets"));
  yield* fs.writeFileString(path.join(dir, "sheets", "fig-1.png"), "png");
  return dir;
});

const ingest = Effect.fnUntraced(function* (dir: string, reply: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const replyPath = path.join(dir, "reply.md");
  yield* fs.writeFileString(replyPath, reply);
  return yield* ingestDrawingJudgeInventory({ packDir: dir, replyPath });
});

const toJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const fenced = (value: unknown) =>
  toJson(value).pipe(Effect.map((json) => `\`\`\`json\n${json}\n\`\`\`\nREQUIRED FINDINGS: 1\n`));

describe("beep drawings judge-ingest", () => {
  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "accepts a fenced drawing-rubric inventory and stores it in the pack",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* writePack();
        const result = yield* ingest(dir, yield* fenced(inventory("orientation", "sheets/fig-1.png")));
        expect(result.requiredCount).toBe(1);
        expect(yield* fs.exists(path.join(dir, "inventory.json"))).toBe(true);
        // a bare JSON reply is accepted too
        const bare = yield* ingest(dir, yield* toJson(inventory("view-agreement", "sheets/fig-1.png")));
        expect(bare.findings[0]?.lens).toBe("view-agreement");
      })
    );

    it.effect(
      "refuses a browser lens, evidence outside the pack, and a wrong requiredCount",
      Effect.fnUntraced(function* () {
        const dir = yield* writePack();
        const browser = yield* Effect.flip(ingest(dir, yield* fenced(inventory("drag-ghost", "sheets/fig-1.png"))));
        assertInstanceOf(browser, DrawingsCommandError);
        expect(browser.message).toContain('lens "drag-ghost" is not a drawing-rubric lens');
        const missing = yield* Effect.flip(ingest(dir, yield* fenced(inventory("orientation", "sheets/fig-9.png"))));
        expect(missing.message).toContain('"sheets/fig-9.png" is not a file in the pack');
        const escape = yield* Effect.flip(ingest(dir, yield* fenced(inventory("orientation", "../../etc/passwd"))));
        expect(escape.message).toContain("is not a file in the pack");
        const count = yield* Effect.flip(ingest(dir, yield* fenced(inventory("orientation", "sheets/fig-1.png", 0))));
        expect(count.message).toContain("not a valid qa-inventory/v1");
      })
    );
  });
});
