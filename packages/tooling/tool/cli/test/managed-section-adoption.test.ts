import { buildExplorationProjection } from "@beep/repo-cli/commands/Explore";
import { extractGeneratedBlock, generatedBlockBegin, generatedBlockEnd } from "@beep/repo-cli/commands/Models";
import {
  STANDARD_SECTION,
  STANDARD_SECTION_BEGIN,
  STANDARD_SECTION_END,
  spliceStandardSection,
} from "@beep/repo-cli/commands/Observability";
import { PacketEventStoreLive } from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// R8 (goals/effected-promotion) reads the three generated regions through
// `@beep/managed-section`. These cases pin the behaviour shifts the switch
// makes on purpose; `ops/managed-section-adoption-parity.ts` records that the
// committed surfaces render byte for byte as before.

describe("Observability standard section", () => {
  const body = Str.slice(STANDARD_SECTION_BEGIN.length + 1, -(STANDARD_SECTION_END.length + 1))(STANDARD_SECTION);

  it("keeps the standard's literal markers", () => {
    strictEqual(STANDARD_SECTION_BEGIN, "<!-- BEGIN GENERATED: INSTRUMENTATION CATALOG -->");
    strictEqual(STANDARD_SECTION_END, "<!-- END GENERATED: INSTRUMENTATION CATALOG -->");
  });

  it("renders the replacement in a CRLF standard's line ending", () => {
    const crlf = `# T\r\n\r\n${STANDARD_SECTION_BEGIN}\r\nold\r\n${STANDARD_SECTION_END}\r\n\r\nrest\r\n`;
    assertSome(
      spliceStandardSection(crlf, STANDARD_SECTION),
      `# T\r\n\r\n${STANDARD_SECTION_BEGIN}\r\n${Str.replace(/\n/g, "\r\n")(body)}\r\n${STANDARD_SECTION_END}\r\n\r\nrest\r\n`
    );
  });

  it("refuses a duplicated section and markers that do not own their line", () => {
    const pair = `${STANDARD_SECTION_BEGIN}\nold\n${STANDARD_SECTION_END}\n`;
    assertNone(spliceStandardSection(`${pair}${pair}`, STANDARD_SECTION));
    assertNone(
      spliceStandardSection(`x ${STANDARD_SECTION_BEGIN}\nold\ny ${STANDARD_SECTION_END}\n`, STANDARD_SECTION)
    );
  });

  it("renders canonical markers over hand-added trailing blanks", () => {
    assertSome(
      spliceStandardSection(`${STANDARD_SECTION_BEGIN}  \nold\n${STANDARD_SECTION_END}  \nrest\n`, STANDARD_SECTION),
      `${STANDARD_SECTION}\nrest\n`
    );
  });

  it("is idempotent on its own output", () => {
    const once = O.getOrThrow(spliceStandardSection(`# T\n\n${STANDARD_SECTION}\n`, STANDARD_SECTION));
    assertSome(spliceStandardSection(once, STANDARD_SECTION), once);
  });
});

describe("Models generated block", () => {
  const block = (id: string, lines: ReadonlyArray<string>, eol = "\n") =>
    A.join([generatedBlockBegin(id), ...lines, generatedBlockEnd(id)], eol);

  it("keeps the beep-models marker spelling", () => {
    strictEqual(generatedBlockBegin("volume-pools"), "<!-- beep-models:begin volume-pools -->");
    strictEqual(generatedBlockEnd("volume-pools"), "<!-- beep-models:end volume-pools -->");
  });

  it("reads a stale second copy of a block as no block", () => {
    assertNone(extractGeneratedBlock(`${block("x", ["a"])}\n\n${block("x", ["a"])}\n`, "x"));
  });

  it("ignores markers that do not own their line and ids outside the key grammar", () => {
    assertNone(extractGeneratedBlock(`a ${generatedBlockBegin("x")}\nbody\nb ${generatedBlockEnd("x")}\n`, "x"));
    assertNone(extractGeneratedBlock(`${block("a b", ["body"])}\n`, "a b"));
  });

  it("reads a CRLF body with LF line endings, like the expected body", () => {
    assertSome(extractGeneratedBlock(`${block("x", ["one", "two"], "\r\n")}\r\n`, "x"), "one\ntwo");
  });

  it("leaves other blocks alone", () => {
    assertSome(extractGeneratedBlock(`${block("x", ["body"])}\n${generatedBlockBegin("y")}\n`, "x"), "body");
  });
});

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const testLayer = Layer.mergeAll(NodeServices.layer, PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)));
const STATUS_BEGIN = "<!-- BEGIN GENERATED: EXPLORATION STATUS -->";
const STATUS_END = "<!-- END GENERATED: EXPLORATION STATUS -->";

const projectReadme = Effect.fnUntraced(function* (readmeContent: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-managed-section-adoption-" });
  const packet = path.join(root, "explorations", "alpha");
  yield* fs.makeDirectory(path.join(packet, "ops"), { recursive: true });
  yield* fs.writeFileString(
    path.join(packet, "ops", "manifest.json"),
    encodeJson({
      schemaVersion: "exploration-manifest/v1",
      exploration: { slug: "alpha", title: "Alpha", status: "active", stage: "research", updated: "2026-10-25" },
    })
  );
  yield* fs.writeFileString(path.join(packet, "README.md"), readmeContent);
  return yield* buildExplorationProjection(root);
});

const readmeWith = (status: string) => `# Alpha\n\n## Status\n\n${status}\n\n## Trail\n\n- kept\n`;
const projectedStatus = `${STATUS_BEGIN}\nStage: \`research\`\nStatus: \`active\`\n${STATUS_END}`;

describe("Explore Atlas README status region", () => {
  it.layer(testLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
    it.effect("rewrites the region in place and keeps authored lines on both sides", () =>
      Effect.gen(function* () {
        const projection = yield* projectReadme(
          readmeWith(`Before.\n${STATUS_BEGIN}\nStage: \`capture\`\nStatus: \`parked\`\n${STATUS_END}\nAfter.`)
        );
        deepStrictEqual(projection.issues, []);
        strictEqual(projection.readmes[0]?.projected, readmeWith(`${projectedStatus}\n\nBefore.\nAfter.`));
      })
    );

    it.effect("reports a duplicated region as malformed markers", () =>
      Effect.gen(function* () {
        const region = `${STATUS_BEGIN}\nStage: \`capture\`\n${STATUS_END}`;
        const projection = yield* projectReadme(readmeWith(`${region}\n${region}`));
        assertTrue(A.some(projection.issues, (issue) => Str.includes("malformed generated markers")(issue.detail)));
        deepStrictEqual(projection.readmes, []);
      })
    );

    it.effect("reads a marker with trailing blanks and renders it canonically", () =>
      Effect.gen(function* () {
        const projection = yield* projectReadme(
          readmeWith(`${STATUS_BEGIN}  \nStage: \`capture\`\nStatus: \`active\`\n${STATUS_END}\t`)
        );
        deepStrictEqual(projection.issues, []);
        strictEqual(projection.readmes[0]?.projected, readmeWith(projectedStatus));
      })
    );
  });
});
