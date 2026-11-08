import {
  KnowledgePathsEvaluator,
  makeKnowledgeDoctorMemoryTree,
  scanKnowledgeDoctorTree,
} from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service";
import { it } from "@beep/test-runner";
import { NodeCrypto } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";

const files = {
  "package.json": '{"name":"@beep/root","workspaces":["packages/*"]}',
  "packages/demo/package.json": '{"name":"@beep/demo","exports":{"./Sub":"./src/Sub.ts"}}',
  "packages/demo/src/Sub.ts": "export const Sub = 1;",
};
const named = "The owner is `@beep/demo`.\n";
const claim = "`./Sub` is a concept subpath export.\n";
const scan = (text: string, entries: Readonly<Record<string, string>> = files) =>
  scanKnowledgeDoctorTree(makeKnowledgeDoctorMemoryTree({ files: { ...entries, "docs/guide.md": text } }), [
    KnowledgePathsEvaluator,
  ]);

describe("knowledge doctor proven package export context", () => {
  it.layer(NodeCrypto.layer)((it) => {
    it.effect("shares affirmative owner and tracked-target proof with Stage 1", () =>
      Effect.gen(function* () {
        for (const text of [`${named}${claim}`, "`packages/demo/src/Sub.ts` (+ `./Sub` package export)\n"]) {
          const report = yield* scan(text);
          assert.deepStrictEqual(report.findings, []);
        }
      })
    );
    it.effect("keeps unowned, adverse, ambiguous and ordinary path claims governed", () =>
      Effect.gen(function* () {
        const other = {
          ...files,
          "packages/other/package.json": '{"name":"@beep/other","exports":{"./Sub":"./src/Sub.ts"}}',
          "packages/other/src/Sub.ts": "export const Sub = 2;",
        };
        for (const text of [
          claim,
          `Not \`@beep/demo\`.\n${claim}`,
          `${named}Not \`./Sub\` package export.`,
          `${named}\`./Sub\` package export is not available.`,
          `${named}\`./Sub\` package export, if added later.`,
          `${named}Proposed \`./Sub\` package export.`,
          `${named}\`./Sub\` package export?`,
          `${named}Use \`./Sub\`.`,
          `${named}\`./Missing\` package export.`,
          `${named}Also \`@beep/other\`.\n${claim}`,
          `The owner is \`@beep/wrong\`.\n${claim}`,
          `\`\`\`\n${named}\`\`\`\n${claim}`,
        ]) {
          const report = yield* scan(text, other);
          assert.isTrue(
            A.some(report.findings, (finding) => finding.finding.kind === "broken-tracked-path"),
            text
          );
        }
      })
    );
    it.effect("counts only tracked wildcard targets when proving unique document ownership", () =>
      Effect.gen(function* () {
        const wildcard = {
          ...files,
          "packages/wild/package.json": '{"name":"@beep/wild","exports":{"./*":"./src/*.ts"}}',
        };
        const text = `${named}Also \`@beep/wild\`.\n${claim}`;
        const proved = yield* scan(text, wildcard);
        assert.deepStrictEqual(proved.findings, []);
        const ambiguous = yield* scan(text, { ...wildcard, "packages/wild/src/Sub.ts": "export const Sub = 2;" });
        assert.isTrue(A.some(ambiguous.findings, (row) => row.finding.kind === "broken-tracked-path"));
      })
    );
    it.effect("fails closed for missing targets and reports neighboring missing paths", () =>
      Effect.gen(function* () {
        const missing = yield* scan(`${named}${claim}`, R.remove(files, "packages/demo/src/Sub.ts"));
        assert.isTrue(A.some(missing.findings, (finding) => finding.finding.kind === "broken-tracked-path"));
        const mixed = yield* scan(`${named}${claim}See \`./actually-missing.md\`.`);
        assert.deepStrictEqual(
          A.map(mixed.findings, (finding) => finding.finding.subject),
          ["repo-path:docs/actually-missing.md"]
        );
      })
    );
  });
});
