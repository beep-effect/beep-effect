/**
 * Markdown TOC differential (roadmap PR R5b, map site #292).
 *
 * R5b moves docgen's table of contents from the `@effect/markdown-toc` npm package onto
 * `@beep/markdown` (`MarkdownSlug`, `MarkdownToc`). The dependency leaves every manifest, so the
 * oracle is read from a disposable install outside the repo (`--oracle <dir>`, a directory whose
 * `node_modules` holds `@effect/markdown-toc@0.1.0`), never from the lane's `node_modules`.
 *
 * Two corpora, each file fed to both implementations with `bullets: "-"` / `bullet: "-"`:
 *
 * - `tracked`: every git-tracked Markdown file (every heading in the repo's Markdown, the slugger
 *   differential the wave-4 plan names for R5b);
 * - `docgen`: every generated module page under a package `docs/modules/` directory (the docgen
 *   corpus, from a prior `bun run docgen` with the new builder), with the inserted TOC block put
 *   back to `<!-- toc -->` and the frontmatter dropped, so both implementations see what
 *   `Core.getModuleMarkdownFiles` hands the builder. For this corpus the page's own embedded TOC
 *   (what the new docgen wrote) is compared with the oracle's rendering as well: that comparison is
 *   the byte-identical generated-docs oracle the wave-4 plan names for R5b.
 *
 * Per file the report records whether the rendered TOC strings are byte-identical and, when not,
 * every heading whose text, slug, depth or ordinal differs (oracle vs kit), plus a `kitError` when
 * `@beep/markdown` refuses the document. Nothing here runs in CI; the report rides in `research/`
 * and the PR body, where each remaining difference is classified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/markdown-toc-differential.ts --oracle <dir> [--out <report.json>] [--corpus tracked|docgen|both]
 *
 * Exit status is non-zero when any file renders differently.
 */
import { createRequire } from "node:module";
import * as NodeOS from "node:os";
import * as NodeURL from "node:url";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownToc } from "@beep/markdown/MarkdownToc";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as PlatformError from "effect/PlatformError";

const TOOL = "goals/effected-promotion/ops/markdown-toc-differential.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

const relative = (path: string): string => (Str.startsWith(repoRoot)(path) ? Str.slice(repoRoot.length)(path) : path);

const git = (args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(["git", ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString();
};

const lines = (text: string): ReadonlyArray<string> => A.filter(Str.split(text, "\n"), Str.isNonEmpty);

// The oracle's own token shape (`res.json` entries), as `markdown-toc` 0.1.0 emits them.
const OracleEntry = S.Struct({ content: S.String, slug: S.String, lvl: S.Number, i: S.Number, seen: S.Number });
const OracleResult = S.Struct({ content: S.String, json: S.Array(OracleEntry) });
const decodeOracleResult = S.decodeUnknownSync(OracleResult);

type Oracle = (markdown: string) => typeof OracleResult.Type;

const loadOracle = (
  oracleDir: string
): { readonly toc: Oracle; readonly version: string; readonly remarkable: string } => {
  const require = createRequire(`${oracleDir}/package.json`);
  const toc = require("@effect/markdown-toc") as (markdown: string, options: { bullets: string }) => unknown;
  const version = (require("@effect/markdown-toc/package.json") as { version: string }).version;
  const remarkable = (require("remarkable/package.json") as { version: string }).version;
  return { toc: (markdown) => decodeOracleResult(toc(markdown, { bullets: "-" })), version, remarkable };
};

const HeadingRecord = S.Struct({ text: S.String, slug: S.String, depth: S.Number, occurrence: S.Number });
const HeadingDifference = S.Struct({ index: S.Number, oracle: S.NullOr(HeadingRecord), kit: S.NullOr(HeadingRecord) });
const Corpus = S.Literals(["tracked", "docgen"]);
type Corpus = typeof Corpus.Type;
const FileDifference = S.Struct({
  corpus: Corpus,
  file: S.String,
  kitError: S.NullOr(S.String),
  oracleHeadings: S.Number,
  kitHeadings: S.Number,
  oracleToc: S.String,
  kitToc: S.String,
  // docgen corpus only: the TOC the page itself carries, when it differs from the oracle's.
  embeddedToc: S.NullOr(S.String),
  headings: S.Array(HeadingDifference),
});
type FileDifference = typeof FileDifference.Type;
const CorpusSummary = S.Struct({
  files: S.Number,
  identical: S.Number,
  differing: S.Number,
  oracleHeadings: S.Number,
  kitErrors: S.Number,
  // docgen corpus only: pages whose embedded TOC equals the oracle's rendering.
  embeddedIdentical: S.Number,
});
type CorpusSummary = typeof CorpusSummary.Type;

const Report = S.Struct({
  tool: S.String,
  commit: S.String,
  dirty: S.Boolean,
  oracle: S.Struct({ dir: S.String, markdownToc: S.String, remarkable: S.String }),
  corpora: S.Record(S.String, CorpusSummary),
  differences: S.Array(FileDifference),
});
const encodeReport = S.encodeSync(Report);

const parseArgs = (argv: ReadonlyArray<string>) => {
  let oracle: string | undefined;
  let out: string | undefined;
  let corpus: Corpus | "both" = "both";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--oracle" && next !== undefined) {
      oracle = next;
      index += 1;
    } else if (arg === "--out" && next !== undefined) {
      out = next;
      index += 1;
    } else if (arg === "--corpus" && (next === "tracked" || next === "docgen" || next === "both")) {
      corpus = next;
      index += 1;
    }
  }
  if (oracle === undefined) {
    throw new Error(`${TOOL}: --oracle <dir> is required (a disposable @effect/markdown-toc install)`);
  }
  return { oracle, out, corpus };
};

// Put a generated docgen page back to the TOC input: drop the frontmatter block, and replace the
// inserted `---\n## Exports Grouped by Category\n<toc>\n---` block (as `Printer.prettify` leaves it)
// with the `<!-- toc -->` marker. The captured group is the TOC the page carries.
const TOC_BLOCK = /\n---\n## Exports Grouped by Category\n([\s\S]*?)\n---(?:\n|$)/;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;
// A page without the block (the `index.md` module index) is not TOC output and is skipped.
type PageInput = { readonly input: string; readonly embedded: string | null };

const docgenInput = (page: string): O.Option<PageInput> => {
  const body = Str.replace(FRONTMATTER, "")(page);
  return O.map(O.fromUndefinedOr(TOC_BLOCK.exec(body)?.[1]), (embedded) => ({
    input: Str.replace(TOC_BLOCK, "\n<!-- toc -->\n")(body),
    embedded,
  }));
};

const trackedMarkdown = (): ReadonlyArray<string> =>
  lines(Str.replaceAll("\0", "\n")(git(["ls-files", "-z", "--", "*.md"])));

const docgenPages = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageDirs = A.map(lines(git(["ls-files", "--", "**/docgen.json", "docgen.json"])), (file) =>
    path.dirname(path.join(repoRoot, file))
  );
  const pages: Array<string> = [];
  const walk: (current: string) => Effect.Effect<void, PlatformError.PlatformError> = Effect.fnUntraced(function* (
    current: string
  ) {
    for (const entry of yield* fs.readDirectory(current)) {
      const full = path.join(current, entry);
      const info = yield* fs.stat(full);
      if (info.type === "Directory") yield* walk(full);
      else if (Str.endsWith(".md")(entry)) pages.push(full);
    }
  });
  for (const dir of packageDirs) {
    const modules = path.join(dir, "docs", "modules");
    if (yield* fs.exists(modules)) yield* walk(modules);
  }
  return A.sort(pages, Str.Order);
});

type Outcome = {
  readonly identical: boolean;
  readonly embeddedIdentical: boolean;
  readonly oracleHeadings: number;
  readonly difference: FileDifference | undefined;
};

const compareFile = (
  corpus: Corpus,
  file: string,
  source: string,
  embedded: string | null,
  oracle: Oracle
): Outcome => {
  const expected = oracle(source);
  const embeddedIdentical = embedded === expected.content;
  // The same parse `MarkdownToc.renderResult` runs: GFM with frontmatter capture.
  const parsed = MarkdownDocument.parseResult(source, { frontmatter: true });
  if (Result.isFailure(parsed)) {
    return {
      identical: false,
      embeddedIdentical,
      oracleHeadings: expected.json.length,
      difference: {
        corpus,
        file,
        kitError: String(parsed.failure),
        oracleHeadings: expected.json.length,
        kitHeadings: 0,
        oracleToc: expected.content,
        kitToc: "",
        embeddedToc: embeddedIdentical ? null : embedded,
        headings: [],
      },
    };
  }
  const entries = MarkdownToc.entries(parsed.success);
  const kitToc = MarkdownToc.renderEntries(entries, { bullet: "-" });
  if (kitToc === expected.content && (embedded === null || embeddedIdentical)) {
    return { identical: true, embeddedIdentical, oracleHeadings: expected.json.length, difference: undefined };
  }
  const oracleByIndex = HashMap.fromIterable(A.map(expected.json, (entry) => [entry.i, entry] as const));
  const kitByIndex = HashMap.fromIterable(A.map(entries, (entry) => [entry.index, entry] as const));
  const indices = A.dedupe(
    A.sort(
      A.appendAll(A.fromIterable(HashMap.keys(oracleByIndex)), A.fromIterable(HashMap.keys(kitByIndex))),
      Order.Number
    )
  );
  const headings = A.filterMap(indices, (index) => {
    const left = HashMap.get(oracleByIndex, index);
    const right = HashMap.get(kitByIndex, index);
    const same =
      O.isSome(left) &&
      O.isSome(right) &&
      left.value.slug === right.value.slug &&
      left.value.content === right.value.text &&
      left.value.lvl === right.value.depth &&
      left.value.seen === right.value.occurrence;
    return same
      ? Result.fail(undefined)
      : Result.succeed({
          index,
          oracle: O.match(left, {
            onNone: () => null,
            onSome: (entry) => ({ text: entry.content, slug: entry.slug, depth: entry.lvl, occurrence: entry.seen }),
          }),
          kit: O.match(right, {
            onNone: () => null,
            onSome: (entry) => ({
              text: entry.text,
              slug: entry.slug,
              depth: entry.depth,
              occurrence: entry.occurrence,
            }),
          }),
        });
  });
  return {
    identical: kitToc === expected.content,
    embeddedIdentical,
    oracleHeadings: expected.json.length,
    difference: {
      corpus,
      file,
      kitError: null,
      oracleHeadings: expected.json.length,
      kitHeadings: entries.length,
      oracleToc: expected.content,
      kitToc,
      embeddedToc: embeddedIdentical ? null : embedded,
      headings,
    },
  };
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const args = parseArgs(Bun.argv.slice(2));
  const oracleDir = path.resolve(args.oracle);
  const oracle = loadOracle(oracleDir);
  const commit = Str.trim(git(["rev-parse", "HEAD"]));
  const dirty = Str.isNonEmpty(Str.trim(git(["status", "--porcelain", "--", ":!goals/effected-promotion/research"])));

  const corpora: Array<readonly [Corpus, ReadonlyArray<string>]> = [];
  if (args.corpus !== "docgen")
    corpora.push(["tracked", A.map(trackedMarkdown(), (file) => path.join(repoRoot, file))]);
  if (args.corpus !== "tracked") corpora.push(["docgen", yield* docgenPages()]);

  let summaries = HashMap.empty<string, CorpusSummary>();
  const differences: Array<FileDifference> = [];
  for (const [corpus, files] of corpora) {
    let summary: CorpusSummary = {
      files: 0,
      identical: 0,
      differing: 0,
      oracleHeadings: 0,
      kitErrors: 0,
      embeddedIdentical: 0,
    };
    for (const file of files) {
      const raw = yield* fs.readFileString(file);
      const page: O.Option<PageInput> = corpus === "docgen" ? docgenInput(raw) : O.some({ input: raw, embedded: null });
      if (O.isNone(page)) continue;
      const outcome = compareFile(corpus, relative(file), page.value.input, page.value.embedded, oracle.toc);
      const kitError = outcome.difference?.kitError !== null && outcome.difference !== undefined ? 1 : 0;
      summary = {
        files: summary.files + 1,
        identical: summary.identical + (outcome.identical ? 1 : 0),
        differing: summary.differing + (outcome.identical ? 0 : 1),
        oracleHeadings: summary.oracleHeadings + outcome.oracleHeadings,
        kitErrors: summary.kitErrors + kitError,
        embeddedIdentical: summary.embeddedIdentical + (outcome.embeddedIdentical ? 1 : 0),
      };
      if (outcome.difference !== undefined) differences.push(outcome.difference);
    }
    summaries = HashMap.set(summaries, corpus, summary);
    yield* Console.log(
      `${corpus}: ${summary.files} files, ${summary.oracleHeadings} oracle headings, ${summary.identical} identical, ${summary.differing} differing, ${summary.kitErrors} kit errors${
        corpus === "docgen" ? `, ${summary.embeddedIdentical} embedded TOCs identical to the oracle` : ""
      }`
    );
  }

  const report = encodeReport({
    tool: TOOL,
    commit,
    dirty,
    // The report is committed under `research/`, so the home directory is written as `~`.
    oracle: {
      dir: Str.startsWith(NodeOS.homedir())(oracleDir)
        ? `~${Str.slice(NodeOS.homedir().length)(oracleDir)}`
        : oracleDir,
      markdownToc: oracle.version,
      remarkable: oracle.remarkable,
    },
    corpora: Object.fromEntries(HashMap.toEntries(summaries)),
    differences,
  });
  if (args.out !== undefined) {
    yield* fs.writeFileString(path.resolve(args.out), `${JSON.stringify(report, null, 2)}\n`);
    yield* Console.log(`report: ${args.out}`);
  }
  if (A.isReadonlyArrayNonEmpty(differences)) {
    yield* Console.error(`${TOOL}: ${differences.length} file(s) render differently`);
    return yield* Effect.fail(new Error("differences"));
  }
});

NodeRuntime.runMain(Effect.provide(program, NodeServices.layer));
