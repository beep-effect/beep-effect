import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import * as S from "effect/Schema";

const repoRoot = resolve(import.meta.dir, "../../../..");
const outputPath = resolve(import.meta.dir, "../closing-census.json");
const inlineRuleCode = "beep(no-inline-schema-compile)";
const openingInlineWarningCount = 2_935;
const liveSourceRoots = ["packages", "apps", "infra", "scripts"];

const OxlintReport = S.Struct({
  diagnostics: S.Array(
    S.Struct({
      code: S.optionalKey(S.String),
      filename: S.String,
      labels: S.optionalKey(
        S.Array(
          S.Struct({
            span: S.optionalKey(S.Struct({ line: S.optionalKey(S.Int) })),
          })
        )
      ),
      message: S.optionalKey(S.String),
    })
  ),
});

const decodeOxlintReport = S.decodeUnknownSync(S.fromJsonString(OxlintReport));

const commandOutput = (command: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(command, {
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
  return result.stdout.toString();
};

const addedLinesByFile = new Map<string, Set<number>>();
let currentFile: string | undefined;

for (const line of commandOutput(["git", "diff", "--unified=0", "--no-color", "--", "*.ts", "*.tsx"]).split("\n")) {
  if (line.startsWith("+++ b/")) {
    currentFile = line.slice("+++ b/".length);
    continue;
  }
  if (!line.startsWith("@@ ") || currentFile === undefined) {
    continue;
  }

  const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
  if (match === null) {
    continue;
  }
  const start = Number(match[1]);
  const count = Number(match[2] ?? "1");
  const addedLines = addedLinesByFile.get(currentFile) ?? new Set<number>();
  for (let offset = 0; offset < count; offset += 1) {
    addedLines.add(start + offset);
  }
  addedLinesByFile.set(currentFile, addedLines);
}

const report = decodeOxlintReport(commandOutput(["bunx", "oxlint", "--format=json"]));
const provRdfSource = readFileSync(resolve(repoRoot, "packages/foundation/modeling/rdf/src/ProvRdf.ts"), "utf8");
const legacyBroadHelperMatches = commandOutput([
  "rg",
  "-n",
  "with(?:Sync|Promise|Effect|Exit|Option|Result)CodecStatics",
  ...liveSourceRoots,
  "--glob",
  "*.{ts,tsx}",
])
  .split("\n")
  .filter((line) => line.length > 0);
const legacyJsonStaticMatches = commandOutput([
  "rg",
  "-n",
  "\\.(?:decode|encode)(?:Unknown)?(?:Sync|Promise|Effect|Exit|Option|Result)FromJsonString\\b",
  ...liveSourceRoots,
  "--glob",
  "*.{ts,tsx}",
])
  .split("\n")
  .filter((line) => line.length > 0);
const inlineFindings = report.diagnostics.flatMap((diagnostic) => {
  const line = diagnostic.labels?.[0]?.span?.line;
  if (diagnostic.code !== inlineRuleCode || line === undefined) {
    return [];
  }
  const filename = isAbsolute(diagnostic.filename) ? relative(repoRoot, diagnostic.filename) : diagnostic.filename;
  return [{ filename, line, message: diagnostic.message ?? "" }];
});

const touchedLineFindings = inlineFindings.filter((finding) =>
  addedLinesByFile.get(finding.filename)?.has(finding.line)
);
const countIn = (prefix: string): number =>
  inlineFindings.filter((finding) => finding.filename.startsWith(`${prefix}/`)).length;

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: "schema-utils-selective-codec-statics-closing-census/v1",
      generatedAt: new Date().toISOString(),
      legacySurface: {
        broadHelperMatches: legacyBroadHelperMatches,
        broadHelperMatchCount: legacyBroadHelperMatches.length,
        jsonSuffixedStaticMatches: legacyJsonStaticMatches,
        jsonSuffixedStaticMatchCount: legacyJsonStaticMatches.length,
      },
      inlineCompiler: {
        openingCount: openingInlineWarningCount,
        closingCount: inlineFindings.length,
        delta: inlineFindings.length - openingInlineWarningCount,
        byScope: {
          apps: countIn("apps"),
          infra: countIn("infra"),
          packages: countIn("packages"),
          scratchpad: countIn("scratchpad"),
        },
        knownObjectRefCompileCallPresent: provRdfSource.includes("S.decodeResult(ObjectRefSchema)"),
        remainingProvRdfFindings: inlineFindings.filter(
          (finding) => finding.filename === "packages/foundation/modeling/rdf/src/ProvRdf.ts"
        ),
        touchedLineFindings,
      },
      successorRequirement: {
        required: true,
        objective:
          "Eliminate the remaining no-inline-schema-compile warnings and promote beep(no-inline-schema-compile) from warning to error.",
        baseline: inlineFindings.length,
      },
    },
    null,
    2
  )}\n`
);

console.log(outputPath);
