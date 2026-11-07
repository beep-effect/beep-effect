#!/usr/bin/env bun
/** Read-only conditional layout observations from the authorized pinned donor. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: { "donor-root": { type: "string" }, output: { type: "string" } } });
if (!values["donor-root"] || !values.output) throw new Error("--donor-root and --output are required");
const root = resolve(values["donor-root"]);
const git = (...args) => execFileSync("git", ["-C", root, ...args]);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const commit = "34133d03143ea65861f48a5ed0eb32c931581666";
if (git("rev-parse", "HEAD").toString().trim() !== commit) throw new Error("donor pin mismatch");
const sourcePath = "src/utils/bluebook.ts";
const source = readFileSync(resolve(root, sourcePath));
if (!source.equals(git("show", `${commit}:${sourcePath}`))) throw new Error("donor formatter source changed");
const license = readFileSync(resolve(root, "LICENSE"));
if (!license.equals(git("show", `${commit}:LICENSE`))) throw new Error("donor license changed");
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const mappingBytes = readFileSync(resolve(repo, "packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json"));
const mappingSha256 = sha(mappingBytes);
if (mappingSha256 !== "b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5") throw new Error("identity mapping changed");
const mapping = JSON.parse(mappingBytes);
const edition = mapping.editions.find((row) => row.artifactSha256 === "351eca5a0f8b133ce2d21530fd349f3567079fff849effe0a976efa3fdc16718");
if (edition?.kind !== "case-reporter" || !mapping.courts.some((row) => row.id === "scotus")) throw new Error("profile identity missing");
const { toBluebook } = await import(pathToFileURL(resolve(root, sourcePath)).href);
const views = [
  { plaintiff: "Bell Atl. Corp.", defendant: "Twombly", volume: "550", page: "544", year: "2007", pinCite: "570" },
  { plaintiff: "Foo", defendant: "Bar", volume: "1", page: "1", year: "2000", pinCite: null },
  { plaintiff: "Élodie 😀", defendant: "Bar", volume: "1", page: "1", year: "2000", pinCite: null },
];
const cases = views.map((view) => {
  const text = `${view.plaintiff} v. ${view.defendant}`;
  const input = { type: "case", volume: view.volume, reporter: "U.S.", page: Number(view.page), year: Number(view.year), caseName: text,
    ...(view.pinCite === null ? {} : { pincite: Number(view.pinCite) }), text, matchedText: text,
    span: { cleanStart: 0, cleanEnd: text.length, originalStart: 0, originalEnd: text.length }, confidence: 1, processTimeMs: 0, patternsChecked: 0 };
  return { view: { form: "us-reports-case", ...view }, input, expectedText: toBluebook(input) };
});
const output = { schemaVersion: "bluebook-layout-reference/v1", scope: "Constructed full-case formatter inputs only; no donor extraction, source-span or complete export-parity claim.",
  source: { commit, tree: git("rev-parse", "HEAD^{tree}").toString().trim(), path: sourcePath, sha256: sha(source), license: "MIT", licenseSha256: sha(license), runtime: `Bun ${process.versions.bun}` },
  probeSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  identity: { mappingSha256, edition: edition.artifactSha256, reporterId: edition.reporterId, vocabularyVersion: mapping.publicArtifactVersion, courtId: "scotus" }, cases };
const target = resolve(values.output);
const formatted = execFileSync("bunx", ["--no-install", "biome", "format", `--stdin-file-path=${resolve(repo, "packages/law-practice/domain/test/fixtures/bluebook-layout.json")}`], { cwd: repo, input: JSON.stringify(output, null, 2) + "\n" });
writeFileSync(target, formatted);
process.stdout.write(JSON.stringify({ sourceEvidenceOnly: true, cases: cases.length, sha256: sha(formatted) }) + "\n");
