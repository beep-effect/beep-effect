import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as G from "../../effected/git/Git.ts";
import { scripted } from "./fixtures.ts";

const runs = { arbitrary: fcRuns(100) };
const cwd = "/repo";
const parseWith = <A, E>(invoke: (git: G.GitShape) => Effect.Effect<A, E>, text: string) =>
  Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(
    G.Git.layer.pipe(Layer.provide(Layer.mergeAll(
      scripted((args) => args[0] === "config" && args[1] === "--get" &&
        (args[2] === "core.sshCommand" || args[2] === "ssh.variant") ? { exit: 1 } : { stdout: text }),
      ConfigProvider.layer(ConfigProvider.fromEnvRecord({})),
    ))), scope), (context) => Effect.flatMap(Effect.provideContext(G.Git, context), invoke)));

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decoding encoded values succeeds and preserves the value`, [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.strictEqual(S.toEquivalence(schema)(decoded, value), true);
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

type GitError = G.GitCommandError | G.NotARepositoryError | G.UnknownRefError;
const parserLaw = <T, E>(
  name: string,
  schema: S.Codec<T, E>,
  arbitrary: Arbitrary.Arbitrary<T>,
  stringify: (value: T) => string,
  invoke: (git: G.GitShape) => Effect.Effect<T, GitError>,
): void => {
  it.effect.prop(`${name}: parse/stringify fidelity and canonical rendering idempotence`, [arbitrary],
    ([value]) => Effect.gen(function* () {
      const rendered = stringify(value);
      const parsed = yield* parseWith(invoke, rendered);
      assert.strictEqual(S.toEquivalence(schema)(parsed, value), true);
      const normalized = stringify(parsed);
      const reparsed = yield* parseWith(invoke, normalized);
      assert.strictEqual(S.toEquivalence(schema)(reparsed, parsed), true);
      assert.strictEqual(stringify(reparsed), normalized);
    }), runs);
};

// Process output is UTF-8: lone UTF-16 surrogates are replaced before parsing.
// Restrict only wire-format properties; schema round trips above use full arbitraries.
const noNul = (text: string): boolean => text.isWellFormed() && text.includes("\0") === false;
const lineField = (text: string): boolean => noNul(text) && text.includes("\n") === false && text.includes("\r") === false;
const atom = (text: string): boolean => lineField(text) && text.includes(" ") === false && text.includes("\t") === false;
const nulStrings = S.String.pipe(S.Array, Arbitrary.schema, Arbitrary.filter((values) => values.every((text) => noNul(text) && text.length > 0)));
const lines = S.String.pipe(S.Array, Arbitrary.schema, Arbitrary.filter((values) => values.every((text) => lineField(text) && text.length > 0)));
const nulJoin = (values: ReadonlyArray<string>): string => values.length === 0 ? "" : `${values.join("\0")}\0`;
const lineJoin = (values: ReadonlyArray<string>): string => values.length === 0 ? "" : `${values.join("\n")}\n`;

describe("Git exported schema property floor", () => {
  roundTrips("GitCommandError", G.GitCommandError);
  roundTrips("NotARepositoryError", G.NotARepositoryError);
  roundTrips("UnknownRefError", G.UnknownRefError);
  roundTrips("NonFastForwardError", G.NonFastForwardError);
  roundTrips("MergeConflictError", G.MergeConflictError);
  roundTrips("DirtyWorktreeError", G.DirtyWorktreeError);
  roundTrips("LsTreeEntry", G.LsTreeEntry);
  roundTrips("NameStatusEntry", G.NameStatusEntry);
  roundTrips("CommitInfo", G.CommitInfo);
  roundTrips("CommitLogEntry", G.CommitLogEntry);
  roundTrips("StatusEntry", G.StatusEntry);
  roundTrips("SubmoduleStatusEntry", G.SubmoduleStatusEntry);
  roundTrips("LsRemoteEntry", G.LsRemoteEntry);
  roundTrips("StashEntry", G.StashEntry);
  roundTrips("BranchEntry", G.BranchEntry);
  roundTrips("RefEntry", G.RefEntry);
  roundTrips("ConfigListEntry", G.ConfigListEntry);
  roundTrips("WorktreeEntry", G.WorktreeEntry);
  roundTrips("LsFilesEntry", G.LsFilesEntry);
  roundTrips("NotStubbedError", G.NotStubbedError);
});

describe("Git parser and formatter property floor", () => {
  parserLaw("NUL paths (untrackedFiles)", S.Array(S.String), nulStrings, nulJoin, (git) => git.untrackedFiles(cwd));
  parserLaw("NUL paths (checkIgnore)", S.Array(S.String), nulStrings, nulJoin, (git) => git.checkIgnore(cwd, ["file"]));
  parserLaw("configGetAll preserves empty values", S.Array(S.String),
    S.String.pipe(S.Array, Arbitrary.schema, Arbitrary.filter((values) => values.every(noNul))),
    nulJoin, (git) => git.configGetAll(cwd, "a.b"));
  parserLaw("tagList", S.Array(S.String), lines, lineJoin, (git) => git.tagList(cwd));
  parserLaw("revList", S.Array(S.String), lines, lineJoin, (git) => git.revList(cwd, "HEAD"));

  const trees = S.Array(G.LsTreeEntry);
  parserLaw("lsTree preserves raw path bytes", trees, Arbitrary.schema(trees).pipe(Arbitrary.filter((entries) =>
    entries.every((entry) => atom(entry.mode) && atom(entry.oid) && noNul(entry.path)))),
    (entries) => nulJoin(entries.map((entry) => `${entry.mode} ${entry.type} ${entry.oid}\t${entry.path}`)),
    (git) => git.lsTree(cwd, "HEAD"));

  const files = S.Array(G.LsFilesEntry);
  parserLaw("lsFiles preserves raw path bytes and stages", files, Arbitrary.schema(files).pipe(Arbitrary.filter((entries) =>
    entries.every((entry) => atom(entry.mode) && atom(entry.oid) && noNul(entry.path) && Object.is(entry.stage, -0) === false))),
    (entries) => nulJoin(entries.map((entry) => `${entry.mode} ${entry.oid} ${entry.stage}\t${entry.path}`)),
    (git) => git.lsFiles(cwd));

  const names = S.Array(G.NameStatusEntry);
  const codes = { added: "A", broken: "B", copied: "C", deleted: "D", modified: "M", renamed: "R", typeChanged: "T", unmerged: "U", unknown: "X" };
  parserLaw("nameStatus preserves rename/copy ordering and path bytes", names,
    Arbitrary.schema(names).pipe(Arbitrary.filter((entries) => entries.every((entry) => noNul(entry.path) &&
      ((entry.status === "renamed" || entry.status === "copied") ? entry.oldPath !== undefined && noNul(entry.oldPath) : entry.oldPath === undefined)))),
    (entries) => entries.map((entry) => `${codes[entry.status]}\0${entry.oldPath === undefined ? "" : `${entry.oldPath}\0`}${entry.path}\0`).join(""),
    (git) => git.nameStatus(cwd, { base: "HEAD" }));

  const status = S.Array(G.StatusEntry);
  const rename = (entry: G.StatusEntry): boolean => entry.x === "R" || entry.x === "C" || entry.y === "R" || entry.y === "C";
  parserLaw("status preserves reverse rename ordering and raw path bytes", status,
    Arbitrary.schema(status).pipe(Arbitrary.filter((entries) => entries.every((entry) => noNul(entry.path) &&
      (rename(entry) ? entry.origPath !== undefined && noNul(entry.origPath) : entry.origPath === undefined)))),
    (entries) => entries.map((entry) => `${entry.x}${entry.y} ${entry.path}\0${entry.origPath === undefined ? "" : `${entry.origPath}\0`}`).join(""),
    (git) => git.status(cwd));

  parserLaw("commitInfo preserves the complete untrimmed message", G.CommitInfo,
    Arbitrary.schema(G.CommitInfo).pipe(Arbitrary.filter((entry) => noNul(entry.sha) && entry.message.isWellFormed())),
    (entry) => `${entry.sha}\0${entry.signatureStatus}\0${entry.message}`,
    (git) => git.commitInfo(cwd));

  const log = S.Array(G.CommitLogEntry);
  parserLaw("log preserves empty authors, timestamp instants, and raw path bytes", log,
    Arbitrary.schema(log).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
      noNul(entry.sha) && noNul(entry.authorName) && noNul(entry.authorEmail) && entry.paths.every((path) => noNul(path) && path.length > 0)))),
    (entries) => entries.map((entry) => `\0${entry.sha}\0${DateTime.formatIso(entry.authoredAt)}\0${DateTime.formatIso(entry.committedAt)}\0${entry.authorName}\0${entry.authorEmail}\0${entry.paths.length === 0 ? "" : `\n${entry.paths.join("\0")}\0`}`).join(""),
    (git) => git.log(cwd));

  const remote = S.Array(G.LsRemoteEntry);
  parserLaw("lsRemote", remote, Arbitrary.schema(remote).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
    lineField(entry.sha) && entry.sha.includes("\t") === false && lineField(entry.ref)))),
    (entries) => lineJoin(entries.map((entry) => `${entry.sha}\t${entry.ref}`)), (git) => git.lsRemote(cwd, "origin"));

  const stashes = S.Array(G.StashEntry);
  parserLaw("stashList", stashes, Arbitrary.schema(stashes).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
    noNul(entry.ref) && entry.ref.includes("\u001f") === false && noNul(entry.sha) && entry.sha.includes("\u001f") === false && noNul(entry.message)))),
    (entries) => nulJoin(entries.map((entry) => `${entry.ref}\u001f${entry.sha}\u001f${entry.message}`)), (git) => git.stashList(cwd));

  const branches = S.Array(G.BranchEntry);
  parserLaw("branchList", branches, Arbitrary.schema(branches).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
    lineField(entry.name) && lineField(entry.sha)))),
    (entries) => lineJoin(entries.map((entry) => `${entry.current ? "*" : " "}\0${entry.name}\0${entry.sha}`)), (git) => git.branchList(cwd));

  const refs = S.Array(G.RefEntry);
  parserLaw("forEachRef", refs, Arbitrary.schema(refs).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
    lineField(entry.ref) && lineField(entry.sha)))),
    (entries) => lineJoin(entries.map((entry) => `${entry.ref}\0${entry.sha}\0${entry.objectType}`)), (git) => git.forEachRef(cwd));

  const config = S.Array(G.ConfigListEntry);
  parserLaw("configList preserves newlines in values", config, Arbitrary.schema(config).pipe(Arbitrary.filter((entries) =>
    entries.every((entry) => lineField(entry.key) && noNul(entry.value)))),
    (entries) => nulJoin(entries.map((entry) => `${entry.key}\n${entry.value}`)), (git) => git.configList(cwd));

  const worktrees = S.Array(G.WorktreeEntry);
  parserLaw("worktreeList preserves optional flags and annotations", worktrees,
    Arbitrary.schema(worktrees).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
      [entry.path, entry.head, entry.branch, entry.locked, entry.prunable].every((value) => value === undefined || noNul(value))))),
    (entries) => entries.map((entry) => [
      `worktree ${entry.path}`,
      ...(entry.head === undefined ? [] : [`HEAD ${entry.head}`]),
      ...(entry.branch === undefined ? [] : [`branch ${entry.branch}`]),
      ...(entry.detached ? ["detached"] : []), ...(entry.bare ? ["bare"] : []),
      ...(entry.locked === undefined ? [] : [`locked ${entry.locked}`]),
      ...(entry.prunable === undefined ? [] : [`prunable ${entry.prunable}`]), "", "",
    ].join("\0")).join(""), (git) => git.worktreeList(cwd));

  const submodules = S.Array(G.SubmoduleStatusEntry);
  const prefixes = { current: " ", uninitialized: "-", outOfSync: "+", conflict: "U" };
  parserLaw("submoduleStatus within Git's line-based path limitations", submodules,
    Arbitrary.schema(submodules).pipe(Arbitrary.filter((entries) => entries.every((entry) =>
      atom(entry.sha) && lineField(entry.path) && entry.path.includes(" (") === false &&
      (entry.describe === undefined || (lineField(entry.describe) && entry.describe.includes(" (") === false))))),
    (entries) => lineJoin(entries.map((entry) => `${prefixes[entry.state]}${entry.sha} ${entry.path}${entry.describe === undefined ? "" : ` (${entry.describe})`}`)),
    (git) => git.submoduleStatus(cwd));

  it.effect.prop("StatusEntry format preserves raw paths and explicitly requested arrow renames",
    [G.StatusEntry.pipe(S.Array, Arbitrary.schema)], ([entries]) => Effect.sync(() => {
      assert.strictEqual(G.StatusEntry.format(entries), entries.map((entry) => `${entry.x}${entry.y} ${entry.path}`).join("\n"));
      assert.strictEqual(G.StatusEntry.format(entries, { renames: "arrow" }), entries.map((entry) =>
        `${entry.x}${entry.y} ${entry.origPath === undefined ? entry.path : `${entry.origPath} -> ${entry.path}`}`).join("\n"));
    }), runs);

  it.effect.prop("StatusEntry line formatting is idempotent through the representable porcelain subset",
    [G.StatusEntry.pipe(S.Array, Arbitrary.schema, Arbitrary.filter((entries) => entries.every((entry) =>
      rename(entry) === false && entry.origPath === undefined && lineField(entry.path))))],
    ([entries]) => Effect.gen(function* () {
      const rendered = G.StatusEntry.format(entries);
      const parsed = yield* parseWith((git) => git.status(cwd), rendered.split("\n").join("\0"));
      assert.strictEqual(G.StatusEntry.format(parsed), rendered);
      assert.strictEqual(S.toEquivalence(status)(parsed, entries), true);
    }), runs);

  it.effect.prop("remote short-name formatting is stable and recovers the advertised name",
    [Arbitrary.schema(S.String).pipe(Arbitrary.filter((name) => name.endsWith("^{}") === false && name.startsWith("refs/") === false))],
    ([name]) => Effect.sync(() => {
      for (const prefix of ["refs/heads/", "refs/tags/", "refs/remotes/"]) {
        const formatted = G.LsRemoteEntry.shortName(`${prefix}${name}^{}`);
        assert.strictEqual(formatted, name);
        assert.strictEqual(G.LsRemoteEntry.shortName(formatted), formatted);
      }
    }), runs);
});
