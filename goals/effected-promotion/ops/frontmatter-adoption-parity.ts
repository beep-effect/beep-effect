/**
 * Frontmatter adoption parity (roadmap PR R5a, map sites #37 and #276, plus KnowledgeDoctor
 * `beep-historical`).
 *
 * R5a moves four repo-cli frontmatter readers onto `@beep/markdown` (and `@beep/yaml`):
 *
 * - `reflections`: `reflectionFrontmatterIsValid` (lint `reflection-artifacts`, `goals doctor`) over
 *   every git-tracked Markdown file under a `history/reflections/` directory;
 * - `skills`: `checkInstalledSkills` (`skills update --check`) over every git-tracked `SKILL.md`,
 *   one check per skill directory;
 * - `knowledge`: the document-scoped `beep-historical:` marker `extractKnowledgeDocumentSpans`
 *   reports, over every git-tracked Markdown file;
 * - `changesets`: `rewritePendingChangesets` (`delete-package`) over every changeset file ever added
 *   to `.changeset/` (read from git history), pruning the first package each multi-package changeset
 *   names.
 *
 * The oracle is verdict parity: every reflection verdict, every skill's pass or fail, every document
 * marker and every pruned changeset's bytes must match the baseline exactly. A skill finding's
 * message text may change; such changes are listed (`skillMessageShifts`), never gated. Hand-written
 * probes run through the same exported functions, and every probe that changed must be listed in
 * `INTENDED_SHIFTS` with its reason.
 *
 * The `knowledge` corpus surface is vacuous on the live tree: no tracked Markdown file carries a
 * document-scoped `beep-historical:` marker, so its parity rests on `KNOWLEDGE_PROBES` and the
 * repo-cli `knowledge-doctor` test, not on the corpus count.
 *
 * Run it once before the switch to record the baseline (`--out`), then after the switch with
 * `--before <baseline>`. Nothing here runs in CI; the reports ride in `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/frontmatter-adoption-parity.ts [--out <report.json>] [--before <baseline.json>]
 *
 * Exit status is non-zero when a corpus verdict differs or a probe shift is unclassified.
 */
import * as NodeURL from "node:url";
import { extractKnowledgeDocumentSpans } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service";
import { reflectionFrontmatterIsValid } from "@beep/repo-cli/commands/Lint/ReflectionArtifact";
import { rewritePendingChangesets } from "@beep/repo-cli/test/DeletePackage";
import { checkInstalledSkills } from "@beep/repo-cli/test/SharedInternals";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const TOOL = "goals/effected-promotion/ops/frontmatter-adoption-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const SHA = "0123456789abcdef0123456789abcdef01234567";

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const relative = (path: string): string => (Str.startsWith(repoRoot)(path) ? Str.slice(repoRoot.length)(path) : path);

const git = (args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(["git", ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString();
};

const lines = (text: string): ReadonlyArray<string> => A.filter(Str.split(text, "\n"), Str.isNonEmpty);

const Probe = S.Struct({ id: S.String, output: S.NullOr(S.String) });
const ProbeShift = S.Struct({ id: S.String, before: S.NullOr(S.String), after: S.NullOr(S.String), reason: S.String });
const Marker = S.Struct({ commit: S.String, line: S.Number });

const Corpus = S.Struct({
  reflections: S.Array(S.Struct({ path: S.String, valid: S.Boolean })),
  skills: S.Array(S.Struct({ path: S.String, issue: S.NullOr(S.String) })),
  knowledge: S.Struct({
    documents: S.Number,
    markers: S.Array(S.Struct({ path: S.String, marker: Marker })),
  }),
  changesets: S.Array(S.Struct({ source: S.String, removed: S.String, outputSha256: S.NullOr(S.String) })),
});

const Probes = S.Struct({
  reflections: S.Array(Probe),
  skills: S.Array(Probe),
  knowledge: S.Array(Probe),
  changesets: S.Array(Probe),
});

const Report = S.Struct({
  tool: S.String,
  corpus: Corpus,
  probes: Probes,
  comparison: S.optionalKey(
    S.Struct({
      baseline: S.String,
      corpusVerdictsIdentical: S.Boolean,
      differingCorpusSurfaces: S.Array(S.String),
      skillMessageShifts: S.Array(S.Struct({ path: S.String, before: S.NullOr(S.String), after: S.NullOr(S.String) })),
      probeShifts: S.Array(ProbeShift),
      unclassified: S.Array(S.String),
    })
  ),
});
type Report = typeof Report.Type;

const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));
const encodeReport = S.encodeEffect(S.fromJsonString(Report));

class ParityFailed extends Data.TaggedError("ParityFailed")<{ readonly reasons: ReadonlyArray<string> }> {}

/* ---------------------------------------------------------------------------------------------- */
/* Probes                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

const REFLECTION_BODY = "goal: g\nagent: claude\ndate: 2026-10-27\ntrigger: closeout\nconfidence: high\n";

const REFLECTION_PROBES: ReadonlyArray<readonly [string, string]> = [
  ["valid", `---\n${REFLECTION_BODY}---\n\n# Body\n`],
  ["valid-crlf", `---\r\n${Str.replaceAll("\n", "\r\n")(REFLECTION_BODY)}---\r\n\r\n# Body\r\n`],
  ["valid-trailing-fence-blanks", `--- \n${REFLECTION_BODY}---\t\n# Body\n`],
  ["no-block", "# Body\n"],
  ["unclosed-block", `---\n${REFLECTION_BODY}# Body\n`],
  ["empty-block", "---\n---\n# Body\n"],
  ["json-block", '---json\n{"goal":"g"}\n---\n'],
  ["toml-block", '+++\ngoal = "g"\n+++\n'],
  ["invalid-yaml", "---\ngoal: [unterminated\n---\n"],
  ["schema-invalid", "---\ngoal: g\n---\n"],
  ["duplicate-key", `---\n${REFLECTION_BODY}goal: other\n---\n`],
  ["unquoted-date-timestamp", `---\n${REFLECTION_BODY}---\n`],
  ["bom", `\uFEFF---\n${REFLECTION_BODY}---\n`],
];

const skillDoc = (frontmatter: string): string => `${frontmatter}\n# Skill\n`;

const SKILL_PROBES: ReadonlyArray<readonly [string, string]> = [
  ["valid", skillDoc("---\nname: probe\ndescription: A probe skill.\n---")],
  ["no-block", "# Skill\n"],
  ["json-block", skillDoc('---json\n{"name":"probe","description":"A probe skill."}\n---')],
  ["toml-block", skillDoc('+++\nname = "probe"\n+++')],
  ["invalid-yaml", skillDoc("---\nname: [probe\n---")],
  ["unknown-key", skillDoc("---\nname: probe\ndescription: A probe skill.\nversion: 1.0\n---")],
  ["name-mismatch", skillDoc("---\nname: other\ndescription: A probe skill.\n---")],
  ["duplicate-key", skillDoc("---\nname: probe\ndescription: A probe skill.\nname: probe\n---")],
  ["empty-block", skillDoc("---\n---")],
  ["unclosed-block", "---\nname: probe\ndescription: A probe skill.\n# Skill\n"],
];

const KNOWLEDGE_PROBES: ReadonlyArray<readonly [string, string]> = [
  ["closed", `---\ntitle: t\nbeep-historical: ${SHA}\n---\n\nSee \`goals/INDEX.md\`.\n`],
  ["double-quoted", `---\nbeep-historical: "${SHA}"\n---\n`],
  ["single-quoted", `---\nbeep-historical: '${SHA}'\n---\n`],
  ["crlf", `---\r\ntitle: t\r\nbeep-historical: ${SHA}\r\n---\r\n`],
  ["fence-trailing-blanks", `--- \nbeep-historical: ${SHA}\n---\t\n`],
  ["unclosed", `---\nbeep-historical: ${SHA}\n\nBody.\n`],
  ["after-closing-fence", `---\ntitle: t\n---\nbeep-historical: ${SHA}\n`],
  ["json-fence", `---json\nbeep-historical: ${SHA}\n---\n`],
  ["toml-fence", `+++\nbeep-historical: ${SHA}\n+++\n`],
  ["indented-key", `---\n  beep-historical: ${SHA}\n---\n`],
  ["short-sha", "---\nbeep-historical: abc123\n---\n"],
  ["bom", `\uFEFF---\nbeep-historical: ${SHA}\n---\n`],
  ["not-at-start", `\n---\nbeep-historical: ${SHA}\n---\n`],
];

const CHANGESET_PROBES: ReadonlyArray<readonly [string, string, string]> = [
  [
    "double-quoted",
    "@beep/schema",
    '---\n"@beep/schema": patch\n"@beep/schema-org": minor\n---\n\nTouches @beep/schema.\n',
  ],
  ["single-quoted", "@beep/schema", "---\n'@beep/schema': minor\n'@beep/schema-org': patch\n---\n\nSingle.\n"],
  ["unquoted", "probe", "---\nprobe: patch\nprobe-extra: minor\n---\n\nUnquoted keys.\n"],
  ["last-key", "@beep/b", '---\n"@beep/a": patch\n"@beep/b": minor\n---\n\nLast key.\n'],
  ["comment-line", "@beep/a", '---\n# bump both\n"@beep/a": patch\n"@beep/b": minor\n---\n\nComment.\n'],
  ["crlf", "@beep/a", '---\r\n"@beep/a": patch\r\n"@beep/b": minor\r\n---\r\n\r\nCRLF.\r\n'],
  ["body-fence-lines", "@beep/a", '---\n"@beep/a": patch\n"@beep/b": minor\n---\n\nBody\n\n---\n\n"@beep/a": prose\n'],
  ["escaped-key", "@beep/a", '---\n"\\x40beep/a": patch\n"@beep/b": minor\n---\n\nEscaped key.\n'],
  ["single-only", "@beep/a", '---\n"@beep/a": patch\n---\n\nOnly a.\n'],
  ["sibling-spacing", "@beep/a", "---\n\"@beep/a\": patch\n'@beep/b':   minor\n---\n\nSibling spacing.\n"],
  ["trailing-blank-line", "@beep/a", '---\n"@beep/a": patch\n"@beep/b": minor\n\n---\n\nTrailing blank.\n'],
];

/* ---------------------------------------------------------------------------------------------- */
/* Surfaces                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

const knowledgeMarker = (path: string, text: string): O.Option<typeof Marker.Type> =>
  pipe(
    extractKnowledgeDocumentSpans(path, text, HashSet.empty()).markers,
    A.findFirst((marker) => marker.form === "document"),
    O.map((marker) => ({ commit: marker.commit, line: marker.line }))
  );

const markerText = (marker: O.Option<typeof Marker.Type>): string | null =>
  O.getOrNull(O.map(marker, (found) => `${found.commit}@${found.line}`));

const skillIssue = Effect.fn(function* (skillsDir: string, name: string) {
  const report = yield* checkInstalledSkills(skillsDir, [name], HashSet.empty());
  return O.getOrNull(O.map(A.head(report.issues), (issue) => issue.message));
});

const skillProbe = Effect.fn(function* (raw: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-r5a-skill-probe-" });
  yield* fs.makeDirectory(path.join(root, "probe"), { recursive: true });
  yield* fs.writeFileString(path.join(root, "probe", "SKILL.md"), raw);
  return yield* skillIssue(root, "probe");
});

const pruneChangeset = Effect.fn(function* (packageName: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-r5a-changeset-" });
  const dir = path.join(root, ".changeset");
  yield* fs.makeDirectory(dir, { recursive: true });
  const file = path.join(dir, "probe.md");
  yield* fs.writeFileString(file, content);
  yield* rewritePendingChangesets(root, packageName, "private-exempt");
  return yield* fs.readFileString(file).pipe(Effect.option, Effect.map(O.getOrNull));
});

// The packages a changeset names, read from its frontmatter keys with the frozen pre-R5a key rule.
const CHANGESET_KEY = /^\s*(?:"([^"]+)"|'([^']+)'|([^:#\s][^:]*?))\s*:/u;
const changesetKeys = (content: string): ReadonlyArray<string> => {
  const all = Str.split(content, /\r?\n/u);
  if (!O.exists(A.head(all), (line) => Str.trimEnd(line) === "---")) return [];
  const body = A.takeWhile(A.drop(all, 1), (line) => Str.trimEnd(line) !== "---");
  return A.getSomes(
    A.map(body, (line) =>
      pipe(
        O.fromNullishOr(CHANGESET_KEY.exec(line)),
        O.flatMap((match) => O.fromNullishOr(match[1] ?? match[2] ?? match[3]))
      )
    )
  );
};

const reflectionCorpus = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const files = A.filter(lines(git(["ls-files", "*.md"])), (file) => Str.includes("/history/reflections/")(file));
  return yield* Effect.forEach(files, (file) =>
    fs.readFileString(`${repoRoot}${file}`).pipe(
      Effect.flatMap(reflectionFrontmatterIsValid),
      Effect.map((valid) => ({ path: file, valid }))
    )
  );
});

const skillCorpus = Effect.fn(function* () {
  const path = yield* Path.Path;
  const files = A.filter(lines(git(["ls-files", "*SKILL.md"])), (file) => path.basename(file) === "SKILL.md");
  return yield* Effect.forEach(files, (file) => {
    const skillDir = path.dirname(file);
    return Effect.map(skillIssue(`${repoRoot}${path.dirname(skillDir)}`, path.basename(skillDir)), (issue) => ({
      path: file,
      issue,
    }));
  });
});

const knowledgeCorpus = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const files = lines(git(["ls-files", "*.md"]));
  const markers = yield* Effect.forEach(files, (file) =>
    fs.readFileString(`${repoRoot}${file}`).pipe(
      Effect.orElseSucceed(() => ""),
      Effect.map((text) => O.map(knowledgeMarker(file, text), (marker) => ({ path: file, marker })))
    )
  );
  return { documents: A.length(files), markers: A.getSomes(markers) };
});

const changesetCorpus = Effect.fn(function* () {
  const added = lines(git(["log", "--diff-filter=A", "--format=commit %H", "--name-only", "--", ".changeset/*.md"]));
  const sources = pipe(
    A.reduce(added, { commit: "", entries: HashMap.empty<string, string>() }, (state, line) =>
      Str.startsWith("commit ")(line)
        ? { ...state, commit: Str.slice(7)(line) }
        : Str.endsWith("README.md")(line) || HashMap.has(state.entries, line)
          ? state
          : { ...state, entries: HashMap.set(state.entries, line, state.commit) }
    ).entries,
    HashMap.toEntries,
    A.sort((left: readonly [string, string], right: readonly [string, string]) =>
      left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0
    )
  );
  const pruned = yield* Effect.forEach(sources, ([file, commit]) => {
    const content = git(["show", `${commit}:${file}`]);
    return O.match(
      O.filter(A.head(changesetKeys(content)), () => A.length(changesetKeys(content)) > 1),
      {
        onNone: () => Effect.succeed(O.none()),
        onSome: (removed) =>
          Effect.map(pruneChangeset(removed, content), (output) =>
            O.some({
              source: `${Str.slice(0, 12)(commit)}:${file}`,
              removed,
              outputSha256: output === null ? null : sha256(output),
            })
          ),
      }
    );
  });
  return A.getSomes(pruned);
});

/* ---------------------------------------------------------------------------------------------- */
/* Comparison                                                                                     */
/* ---------------------------------------------------------------------------------------------- */

// Probe outputs this PR changes on purpose, keyed `<surface>/<probe id>`.
const INTENDED_SHIFTS: Readonly<Record<string, string>> = {
  "skills/invalid-yaml":
    "The YAML engine is now @beep/yaml (YamlFrontmatter): the finding names the diagnostic code and position instead of the old engine's SyntaxError text. Same verdict.",
  "skills/duplicate-key":
    "Same engine switch: the duplicate key is reported as the DuplicateKey diagnostic at its position. Same verdict.",
  "knowledge/unclosed":
    "An opening fence with no closing fence is not frontmatter under the shared FrontmatterSource grammar (D-47), the rule every other repo-cli frontmatter reader already follows; the old line reader scanned to the end of the document.",
  "changesets/comment-line":
    "A comment line directly above the removed key belongs to that key's YAML entry, so the edit layer removes it with the key, even when its text (here `# bump both`) also covers surviving keys. The old line filter kept the comment.",
  "changesets/sibling-spacing":
    "A removal re-serializes the whole YAML block, so surviving entries are normalized: `'@beep/b':   minor` becomes `'@beep/b': minor`. The old line filter left sibling lines byte-for-byte. Same keys and values.",
  "changesets/trailing-blank-line":
    "The re-serialized block drops a trailing blank line inside the frontmatter; the old line filter kept it. Same keys and values.",
  "changesets/escaped-key":
    "Bug fix: the key is matched by its YAML value, so a key spelled with an escape (\\x40beep/a) is removed. The old textual match missed it and left the deleted package in a changeset the reference reader said named it.",
};

const probeShifts = (before: Report, after: Report): ReadonlyArray<typeof ProbeShift.Type> =>
  A.flatMap(["reflections", "skills", "knowledge", "changesets"] as const, (surface) =>
    A.getSomes(
      A.map(after.probes[surface], (probe) => {
        const previous = O.getOrNull(
          O.map(
            A.findFirst(before.probes[surface], (entry) => entry.id === probe.id),
            (entry) => entry.output
          )
        );
        const id = `${surface}/${probe.id}`;
        return previous === probe.output
          ? O.none()
          : O.some({ id, before: previous, after: probe.output, reason: INTENDED_SHIFTS[id] ?? "" });
      })
    )
  );

const verdictOnly = (corpus: Report["corpus"]) => ({
  reflections: corpus.reflections,
  skills: A.map(corpus.skills, (skill) => ({ path: skill.path, fails: skill.issue !== null })),
  knowledge: corpus.knowledge,
  changesets: corpus.changesets,
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const corpus = {
    reflections: yield* reflectionCorpus(),
    skills: yield* skillCorpus(),
    knowledge: yield* knowledgeCorpus(),
    changesets: yield* changesetCorpus(),
  };
  const probes = {
    reflections: yield* Effect.forEach(REFLECTION_PROBES, ([id, raw]) =>
      Effect.map(reflectionFrontmatterIsValid(raw), (valid) => ({ id, output: valid ? "valid" : "invalid" }))
    ),
    skills: yield* Effect.forEach(SKILL_PROBES, ([id, raw]) =>
      Effect.map(Effect.scoped(skillProbe(raw)), (output) => ({ id, output }))
    ),
    knowledge: A.map(KNOWLEDGE_PROBES, ([id, text]) => ({
      id,
      output: markerText(knowledgeMarker("docs/probe.md", text)),
    })),
    changesets: yield* Effect.forEach(CHANGESET_PROBES, ([id, removed, content]) =>
      Effect.map(Effect.scoped(pruneChangeset(removed, content)), (output) => ({ id, output }))
    ),
  };
  const current: Report = { tool: TOOL, corpus, probes };

  const beforeIndex = process.argv.indexOf("--before");
  const baselinePath = beforeIndex === -1 ? O.none<string>() : O.fromNullishOr(process.argv[beforeIndex + 1]);
  const report: Report = yield* O.match(baselinePath, {
    onNone: () => Effect.succeed(current),
    onSome: (path) =>
      fs.readFileString(path).pipe(
        Effect.flatMap(decodeReport),
        Effect.map((before) => {
          const shifts = probeShifts(before, current);
          const left = verdictOnly(before.corpus);
          const right = verdictOnly(current.corpus);
          const differing = A.filter(
            ["reflections", "skills", "knowledge", "changesets"] as const,
            (surface) => JSON.stringify(left[surface]) !== JSON.stringify(right[surface])
          );
          const beforeSkills = HashMap.fromIterable(A.map(before.corpus.skills, (skill) => [skill.path, skill.issue]));
          return {
            ...current,
            comparison: {
              baseline: relative(path),
              corpusVerdictsIdentical: A.isReadonlyArrayEmpty(differing),
              differingCorpusSurfaces: differing,
              skillMessageShifts: A.getSomes(
                A.map(current.corpus.skills, (skill) => {
                  const previous = O.getOrElse(HashMap.get(beforeSkills, skill.path), () => null);
                  return previous === skill.issue
                    ? O.none()
                    : O.some({ path: skill.path, before: previous, after: skill.issue });
                })
              ),
              probeShifts: shifts,
              unclassified: A.map(
                A.filter(shifts, (shift) => Str.isEmpty(shift.reason)),
                (shift) => shift.id
              ),
            },
          };
        })
      ),
  });

  const json = yield* encodeReport(report);
  const outIndex = process.argv.indexOf("--out");
  yield* O.match(O.fromNullishOr(outIndex === -1 ? undefined : process.argv[outIndex + 1]), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });

  const reasons = A.appendAll(
    report.comparison === undefined || report.comparison.corpusVerdictsIdentical
      ? []
      : [`corpus verdicts differ: ${A.join(report.comparison.differingCorpusSurfaces, ", ")}`],
    A.map(report.comparison?.unclassified ?? [], (id) => `unclassified probe shift ${id}`)
  );
  yield* Console.log(
    `reflections=${corpus.reflections.length} (valid ${A.length(A.filter(corpus.reflections, (entry) => entry.valid))}); skills=${corpus.skills.length} (failing ${A.length(A.filter(corpus.skills, (entry) => entry.issue !== null))}); knowledge documents=${corpus.knowledge.documents} markers=${corpus.knowledge.markers.length}; changesets pruned=${corpus.changesets.length}; probe shifts=${report.comparison?.probeShifts.length ?? 0}`
  );
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* new ParityFailed({ reasons });
});

NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
