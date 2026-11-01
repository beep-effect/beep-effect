import { ModelsAtomicExchange, makeModelsAtomicExchange } from "@beep/repo-cli/commands/Models/Models.apply.service";
import {
  ModelsExchangeFault,
  ModelsExchangeProbeError,
  ModelsLocatorError,
} from "@beep/repo-cli/commands/Models/Models.errors";
import {
  ModelsPublicationOwner,
  ModelsPublicationState,
  ModelsRecoveryResult,
} from "@beep/repo-cli/commands/Models/Models.exchange.schemas";
import { runSkillsUpdate, skillsCommand } from "@beep/repo-cli/commands/Skills";
import {
  SkillPublicationFile,
  SkillPublicationJournal,
  SkillRecoveryReport,
  SkillTrackedPublication,
  SkillTreeEntry,
} from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas";
import {
  makeSkillPublisher,
  skillTreeDifferences,
  skillTreeDigest,
} from "@beep/repo-cli/commands/Skills/SkillsPublication.service";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { constant, flow } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { makeModelsTestExchangeSystem, modelsTestExchangeLayer } from "./helpers/models-atomic-exchange.ts";
import { intendedFile, intendedTree } from "./helpers/skills-publication.ts";
import { temporaryWorkingDirectory } from "./support/CommandTest.ts";
import type { ModelsRecoveryOutcome } from "@beep/repo-cli/commands/Models/Models.exchange.schemas";
import type { SkillPublicationKind } from "@beep/repo-cli/commands/Skills/SkillsPublication.schemas";
import type { SkillPublisher } from "@beep/repo-cli/commands/Skills/SkillsPublication.service";

const crashWriterUrl = new URL("./fixtures/skills/publication-crash-writer.ts", import.meta.url);
const decodeJournal = S.decodeUnknownEffect(S.fromJsonString(SkillPublicationJournal));
const encodeJournal = S.encodeEffect(S.fromJsonString(SkillPublicationJournal));
const encodeOwner = S.encodeEffect(S.fromJsonString(ModelsPublicationOwner));
const runSkillsCommand = Command.runWith(skillsCommand, { version: "0.0.0" });
const encoder = new TextEncoder();

// CRLF and multibyte text: recovery must keep every byte.
const nativeFile = '# café 🔑 retained\r\n[skills]\r\ninclude_instructions = false\r\nfuture_key = "kept"\r\n';
const competitorFile = "[skills]\nnative_writer = true\n";
const intendedFiles = A.map(intendedTree, (file) =>
  SkillPublicationFile.make({ path: file.path, bytes: encoder.encode(file.text) })
);

const sha256 = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const crypto = yield* Digest.Digest;
  return Hex.encode(yield* crypto.digest(Digest.sha256, bytes));
});

// A file is fingerprinted by its bytes, a directory by its tree hash.
const fingerprint = Effect.fnUntraced(function* (target: string, kind: SkillPublicationKind) {
  const fs = yield* FileSystem.FileSystem;
  if (kind === "file") return yield* sha256(yield* fs.readFile(target));
  return O.getOrThrow(yield* skillTreeDigest(target)).hash;
});

const writeNativeTree = Effect.fnUntraced(function* (directory: string, marker: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(directory, "references"), { recursive: true });
  yield* fs.writeFileString(path.join(directory, "SKILL.md"), `---\nname: crash\ndescription: ${marker}.\n---\n`);
  yield* fs.writeFileString(path.join(directory, "references", "old.md"), `${marker} reference\n`);
  yield* fs.chmod(path.join(directory, "references"), 0o700);
  yield* fs.symlink("SKILL.md", path.join(directory, "current"));
});

// A disposable repository with one target. A file target is the lock file and
// a directory target a skill directory, each present or absent at intent.
const fixture = Effect.fnUntraced(function* (kind: SkillPublicationKind, present: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: `skills-publication-${kind}-` }));
  yield* fs.makeDirectory(path.join(root, ".git"));
  const target = kind === "file" ? path.join(root, "skills-lock.json") : path.join(root, ".claude", "skills", "crash");
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  if (present && kind === "file") yield* fs.writeFileString(target, nativeFile, { mode: 0o640 });
  if (present && kind === "directory") yield* writeNativeTree(target, "Native");
  return { journals: path.join(root, ".beep", "skills-backups", "journals"), root, target };
});

const listing = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory(directory), Order.String);
});

const journalsIn = Effect.fnUntraced(function* (journals: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = A.filter(yield* fs.readDirectory(journals), Str.endsWith(".json"));
  return yield* Effect.forEach(A.sort(entries, Order.String), (entry) =>
    fs.readFileString(path.join(journals, entry)).pipe(Effect.flatMap(decodeJournal))
  );
});

const trackedOf = (journal: SkillPublicationJournal) =>
  O.getOrThrow(O.liftPredicate(journal.publication, S.is(SkillTrackedPublication)));

const firstJournalId = (journals: string) =>
  journalsIn(journals).pipe(Effect.map(flow(A.head, O.getOrThrow, (journal) => journal.id)));

// What a recovered target's directory lists: the target, plus the repository
// entries beside a root-level file target.
const expectedSiblings = {
  file: (name: string) => A.sort([name, ".beep", ".git"], Order.String),
  directory: (name: string) => [name],
} as const;

const firstTracked = (journals: string) => journalsIn(journals).pipe(Effect.map(flow(A.head, O.getOrThrow, trackedOf)));

const publisherWith = Effect.fnUntraced(function* (exchange?: Parameters<typeof ModelsAtomicExchange.of>[0]) {
  const capability = exchange === undefined ? yield* ModelsAtomicExchange : exchange;
  return yield* makeSkillPublisher().pipe(Effect.provideService(ModelsAtomicExchange, capability));
});

const publish = (publisher: SkillPublisher["Service"], kind: SkillPublicationKind, root: string, target: string) =>
  kind === "file"
    ? publisher.publishFile(root, target, intendedFile)
    : publisher.publishDirectory(root, target, intendedFiles);

// The fingerprint of the intended content, published into a fresh tree.
const intendedFingerprint = Effect.fnUntraced(function* (kind: SkillPublicationKind) {
  const { root, target } = yield* fixture(kind, false);
  yield* publish(yield* publisherWith(), kind, root, target);
  return yield* fingerprint(target, kind);
});

// Spawn the real writer, wait until it reports the named crash point, then
// SIGKILL it and reap it. The test scope kills it on every other exit too.
const crash = Effect.fn("SkillsRecoveryTest.crash")(function* (
  mode: "publish-file" | "publish-directory" | "recover",
  root: string,
  target: string,
  halt: string
) {
  const path = yield* Path.Path;
  const writer = yield* path.fromFileUrl(crashWriterUrl);
  const child = yield* ChildProcess.make("bun", [writer, mode, root, target, halt], {
    cwd: process.cwd(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
    extendEnv: true,
  });
  assertSome(yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead), `HALTED ${halt}`);
  yield* child.kill({ killSignal: "SIGKILL" });
  yield* child.exitCode.pipe(Effect.result);
});

const modeOf = (kind: SkillPublicationKind) => (kind === "file" ? "publish-file" : "publish-directory");

const recovered = (journal: string, outcome: ModelsRecoveryOutcome) =>
  SkillRecoveryReport.make({ journal, result: ModelsRecoveryResult.cases.recovered.make({ outcome }) });

const crashPoints: ReadonlyArray<readonly [string, ModelsRecoveryOutcome]> = [
  ["intent", "preimage"],
  ["backed-up", "preimage"],
  ["staged", "preimage"],
  ["exchange-returned", "intended"],
  ["exchanged", "intended"],
  ["verified", "intended"],
  ["completed", "intended"],
];

// Replace the target the way a native writer would: a new entry renamed over
// the path (a file), or the old tree moved aside and a new one put in place.
const replaceTarget = Effect.fnUntraced(function* (kind: SkillPublicationKind, target: string) {
  const fs = yield* FileSystem.FileSystem;
  if (kind === "file") {
    yield* fs.writeFileString(`${target}.native`, competitorFile);
    return yield* fs.rename(`${target}.native`, target);
  }
  yield* fs.rename(target, `${target}.native-old`);
  yield* writeNativeTree(target, "Competitor");
  yield* fs.remove(`${target}.native-old`, { recursive: true });
});

const remoteSkill = "---\nname: grill-me\ndescription: Ask focused planning questions.\n---\n\n# Grill Me\n";
const tree = JSON.stringify({
  tree: [{ path: "skills/productivity/grill-me/SKILL.md", type: "blob", sha: "skill-sha" }],
  truncated: false,
});
const skillsClient = HttpClient.make((request, url) =>
  Effect.try({
    try: () => new Request(url.toString(), { method: request.method }),
    catch: (cause) =>
      new HttpClientError.HttpClientError({ reason: new HttpClientError.TransportError({ request, cause }) }),
  }).pipe(
    Effect.map((web) =>
      HttpClientResponse.fromWeb(
        request,
        web.url === "https://api.github.com/repos/mattpocock/skills/git/trees/main?recursive=1"
          ? new Response(tree, { status: 200 })
          : web.url === "https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md"
            ? new Response(remoteSkill, { status: 200 })
            : new Response("missing", { status: 404 })
      )
    )
  )
);

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  for (const kind of ["file", "directory"] as const) {
    for (const [point, outcome] of crashPoints) {
      it.effect(`${kind}: SIGKILL at ${point} recovers byte-exact and idempotently`, () =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const { journals, root, target } = yield* fixture(kind, true);
          const live = { preimage: yield* fingerprint(target, kind), intended: yield* intendedFingerprint(kind) }[
            outcome
          ];
          const finished = point === "completed";
          yield* crash(modeOf(kind), root, target, point);
          const journal = yield* firstJournalId(journals);
          const publisher = yield* publisherWith();
          const reports = yield* publisher.recover(root, "pending");
          expect(reports).toEqual(A.filter([recovered(journal, outcome)], () => !finished));
          expect(yield* fingerprint(target, kind)).toBe(live);
          // No stage, partial stage or partial journal survives; the backup is kept.
          const parent = yield* listing(path.dirname(target));
          expect(parent).toEqual(expectedSiblings[kind](path.basename(target)));
          expect(A.filter(yield* listing(journals), (entry) => !Str.endsWith(".json")(entry))).toEqual([]);
          const settled = yield* firstTracked(journals);
          expect(settled.state._tag).toBe(finished ? "completed" : "recovered");
          expect(yield* fs.exists(O.getOrThrow(settled.backup))).toBe(point !== "intent");
          // Idempotent: a second run is a no-op with identical bytes and artifacts.
          expect(yield* publisher.recover(root, "pending")).toEqual([]);
          expect(yield* fingerprint(target, kind)).toBe(live);
          expect(yield* listing(path.dirname(target))).toEqual(parent);
        })
      );
    }

    for (const point of ["staged", "exchanged"] as const) {
      it.effect(`${kind}: SIGKILL while creating an absent target at ${point} recovers`, () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { root, target } = yield* fixture(kind, false);
          const intended = yield* intendedFingerprint(kind);
          yield* crash(modeOf(kind), root, target, point);
          const reports = yield* (yield* publisherWith()).recover(root, "pending");
          expect(A.map(reports, (report) => report.result)).toEqual([
            ModelsRecoveryResult.cases.recovered.make({ outcome: point === "staged" ? "preimage" : "intended" }),
          ]);
          if (point === "staged") expect(yield* fs.exists(target)).toBe(false);
          else expect(yield* fingerprint(target, kind)).toBe(intended);
          expect(
            A.filter(
              yield* listing(path.dirname(target)),
              (entry) => Str.includes(".stage-")(entry) || Str.includes(".tmp-")(entry)
            )
          ).toEqual([]);
        })
      );
    }

    it.effect(`${kind}: a native writer replacing the target after a crash is refused and kept`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { journals, root, target } = yield* fixture(kind, true);
        yield* crash(modeOf(kind), root, target, "staged");
        yield* replaceTarget(kind, target);
        const competitor = yield* fingerprint(target, kind);
        const publisher = yield* publisherWith();
        const [report] = yield* publisher.recover(root, "pending");
        expect(report?.result).toMatchObject({ _tag: "refused", reason: "competing-writer" });
        if (kind === "directory") expect(report?.result).toMatchObject({ detail: expect.stringContaining("SKILL.md") });
        expect(yield* fingerprint(target, kind)).toBe(competitor);
        const publication = yield* firstTracked(journals);
        expect(publication.state).toMatchObject({ _tag: "refused", from: "staged", reason: "competing-writer" });
        // Every artifact is kept, beside the canonical target: the stage and the backup.
        expect(yield* fs.realPath(publication.staging)).toBe(publication.staging);
        expect(yield* fs.exists(O.getOrThrow(publication.backup))).toBe(true);
        if (kind === "file") expect(yield* fs.readFileString(O.getOrThrow(publication.backup))).toBe(nativeFile);
        // Pending recovery leaves a refusal alone; an explicit retry refuses again.
        expect(yield* publisher.recover(root, "pending")).toEqual([]);
        const [retried] = yield* publisher.recover(root, "retry");
        expect(retried?.result).toMatchObject({ _tag: "refused", reason: "competing-writer" });
        expect(yield* fingerprint(target, kind)).toBe(competitor);
        expect(yield* fs.exists(publication.staging)).toBe(true);
      })
    );

    it.effect(`${kind}: a writer that replaced the target mid-exchange is returned to the live path`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { journals, root, target } = yield* fixture(kind, true);
        const base = yield* ModelsAtomicExchange;
        const services = yield* Effect.context<FileSystem.FileSystem | Path.Path | Digest.Digest>();
        let competitor = "";
        const interfering = ModelsAtomicExchange.of({
          qualify: base.qualify,
          exchange: Effect.fn("SkillsRecoveryTest.exchange")(function* (left, right) {
            if (right === target && competitor === "")
              yield* replaceTarget(kind, target).pipe(
                Effect.andThen(Effect.suspend(() => fingerprint(target, kind))),
                Effect.tap((hash) => Effect.sync(() => (competitor = hash))),
                Effect.orDie,
                Effect.provideContext(services)
              );
            return yield* base.exchange(left, right);
          }),
        });
        const error = yield* Effect.flip(publish(yield* publisherWith(interfering), kind, root, target));
        expect(error.reason).toBe("competing-writer");
        expect(error.message).toContain("Journal: skills-");
        expect(yield* fingerprint(target, kind)).toBe(competitor);
        const publication = yield* firstTracked(journals);
        expect(publication.state).toMatchObject({ _tag: "refused", reason: "competing-writer" });
        expect(yield* fingerprint(publication.staging, kind)).toBe(publication.staged.hash);
        expect(yield* fs.exists(O.getOrThrow(publication.backup))).toBe(true);
      })
    );

    it.effect(`${kind}: a crash during recovery is reconciled again`, () =>
      Effect.gen(function* () {
        const { journals, root, target } = yield* fixture(kind, true);
        const intended = yield* intendedFingerprint(kind);
        yield* crash(modeOf(kind), root, target, "exchanged");
        yield* crash("recover", root, target, "recovering");
        const [journal] = yield* journalsIn(journals);
        expect(journal === undefined ? "" : trackedOf(journal).state._tag).toBe("recovering");
        const publisher = yield* publisherWith();
        expect(yield* publisher.recover(root, "pending")).toEqual([recovered(journal?.id ?? "", "intended")]);
        expect(yield* fingerprint(target, kind)).toBe(intended);
        expect(yield* publisher.recover(root, "pending")).toEqual([]);
      })
    );

    it.effect(`${kind}: an unsupported filesystem refuses before any backup or journal`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, target } = yield* fixture(kind, true);
        const before = yield* fingerprint(target, kind);
        const base = yield* makeModelsTestExchangeSystem();
        const refusing = yield* makeModelsAtomicExchange({
          ...base,
          exchange: () => Effect.fail(ModelsExchangeFault.make({ reason: "einval", message: "Invalid argument" })),
        });
        const error = yield* Effect.flip(publish(yield* publisherWith(refusing), kind, root, target));
        expect(error.reason).toBe("exchange-unsupported");
        expect(error.message).toContain("(einval: Invalid argument)");
        expect(yield* fs.exists(path.join(root, ".beep"))).toBe(false);
        expect(yield* fingerprint(target, kind)).toBe(before);
      })
    );
  }

  it.effect("a pre-exchange failure closes its journal out terminally", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, root, target } = yield* fixture("directory", true);
      const before = yield* fingerprint(target, "directory");
      const failing = FileSystem.FileSystem.of({
        ...fs,
        rename: Effect.fn("SkillsRecoveryTest.rename")((from, to) =>
          Str.includes(".stage-")(from) ? fs.rename(`${from}.missing`, to) : fs.rename(from, to)
        ),
      });
      const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, failing));
      const error = yield* Effect.flip(publisher.publishDirectory(root, target, intendedFiles));
      expect(yield* fingerprint(target, "directory")).toBe(before);
      const publication = yield* firstTracked(journals);
      expect(publication.state).toMatchObject({
        _tag: "abandoned",
        from: "backed-up",
        detail: expect.stringContaining("Cannot publish staged remote skill."),
      });
      expect(error.message).toContain(`Journal: ${yield* firstJournalId(journals)}`);
      // The stage never landed: its partial and stage names are gone. Skill backups
      // are always kept, so the backup of the untouched tree stays.
      expect(yield* fs.exists(O.getOrThrow(publication.partial))).toBe(false);
      expect(yield* fs.exists(publication.staging)).toBe(false);
      expect(yield* fs.exists(O.getOrThrow(publication.backup))).toBe(true);
      expect(yield* publisher.recover(root, "pending")).toEqual([]);
      expect(yield* publisher.recover(root, "retry")).toEqual([]);
    })
  );

  it.effect("drift found before the exchange abandons the publication and keeps the writer's bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, root, target } = yield* fixture("file", true);
      const drifting = FileSystem.FileSystem.of({
        ...fs,
        writeFileString: Effect.fn("SkillsRecoveryTest.writeFileString")((file, content, options) =>
          fs
            .writeFileString(file, content, options)
            .pipe(
              Effect.andThen(Str.includes(".tmp-")(file) ? fs.writeFileString(target, competitorFile) : Effect.void)
            )
        ),
      });
      const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, drifting));
      const error = yield* Effect.flip(publisher.publishFile(root, target, intendedFile));
      expect(error.reason).toBe("drift");
      expect(yield* fs.readFileString(target)).toBe(competitorFile);
      const publication = yield* firstTracked(journals);
      expect(publication.state).toMatchObject({ _tag: "abandoned", from: "backed-up" });
      expect(yield* fs.exists(publication.staging)).toBe(false);
      expect(yield* fs.readFileString(O.getOrThrow(publication.backup))).toBe(nativeFile);
    })
  );

  it.effect("refuses cleanup through a symlinked parent when target and stage are absent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { journals, root, target } = yield* fixture("directory", false);
      const publisher = yield* publisherWith();
      yield* publish(publisher, "directory", root, target);
      const journal = O.getOrThrow(A.head(yield* journalsIn(journals)));
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "skills-outside-" });
      const escape = path.join(root, "escape");
      yield* fs.symlink(outside, escape);
      const staging = path.join(escape, ".missing.stage-probe");
      const partial = `${staging}.partial`;
      yield* fs.makeDirectory(partial);
      yield* fs.writeFileString(path.join(partial, "unrelated.txt"), "keep external bytes");
      const pending = SkillPublicationJournal.make({
        id: journal.id,
        publication: SkillTrackedPublication.make({
          ...trackedOf(journal),
          target: path.join(escape, "missing"),
          staging,
          partial: O.some(partial),
          preimage: O.none(),
          backup: O.none(),
          owner: O.none(),
          state: ModelsPublicationState.cases.staged.make({}),
        }),
      });
      yield* fs.writeFileString(path.join(journals, `${journal.id}.json`), yield* encodeJournal(pending));
      const reports = yield* publisher.recover(root, "pending");
      expect(A.map(reports, (report) => report.result)).toEqual([
        expect.objectContaining({ _tag: "refused", reason: "foreign-artifact" }),
      ]);
      expect(yield* fs.readFileString(path.join(partial, "unrelated.txt"))).toBe("keep external bytes");
    })
  );

  it.effect("a live owner's publication is left alone", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { journals, root, target } = yield* fixture("file", true);
      const publisher = yield* publisherWith();
      yield* publisher.publishFile(root, target, intendedFile);
      const journal = O.getOrThrow(A.head(yield* journalsIn(journals)));
      const pending = SkillPublicationJournal.make({
        id: journal.id,
        publication: SkillTrackedPublication.make({
          ...trackedOf(journal),
          state: ModelsPublicationState.cases.staged.make({}),
        }),
      });
      yield* fs.writeFileString(path.join(journals, `${journal.id}.json`), yield* encodeJournal(pending));
      expect(A.map(yield* publisher.recover(root, "pending"), (report) => report.result)).toEqual([
        ModelsRecoveryResult.cases.skipped.make({ reason: "owner-alive" }),
      ]);
    })
  );

  it.effect("a legacy journal is skipped and never touched", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { journals, root, target } = yield* fixture("file", true);
      yield* fs.makeDirectory(journals, { recursive: true });
      const legacy = '{"id":"skills-legacy","note":"written before tracked publications"}';
      yield* fs.writeFileString(path.join(journals, "skills-legacy.json"), legacy);
      yield* fs.writeFileString(`${target}.tmp-legacy`, "an old stage\n");
      const publisher = yield* publisherWith();
      for (const scope of ["pending", "retry"] as const) {
        expect(yield* publisher.recover(root, scope)).toEqual([
          SkillRecoveryReport.make({
            journal: "skills-legacy",
            result: ModelsRecoveryResult.cases.skipped.make({ reason: "legacy" }),
          }),
        ]);
      }
      expect(yield* fs.readFileString(target)).toBe(nativeFile);
      expect(yield* fs.readFileString(`${target}.tmp-legacy`)).toBe("an old stage\n");
      expect(yield* fs.readFileString(path.join(journals, "skills-legacy.json"))).toBe(legacy);
    })
  );

  it("names the entries at which two trees differ", () => {
    const left = [
      SkillTreeEntry.make({ path: ".", kind: "directory", mode: 0o755, digest: "" }),
      SkillTreeEntry.make({ path: "a", kind: "file", mode: 0o644, digest: "1" }),
      SkillTreeEntry.make({ path: "b", kind: "file", mode: 0o644, digest: "2" }),
    ];
    const right = [
      SkillTreeEntry.make({ path: ".", kind: "directory", mode: 0o755, digest: "" }),
      SkillTreeEntry.make({ path: "a", kind: "file", mode: 0o600, digest: "1" }),
      SkillTreeEntry.make({ path: "c", kind: "symlink", mode: 0o777, digest: "3" }),
    ];
    expect(skillTreeDifferences(left, right)).toEqual(["a", "b", "c"]);
    expect(skillTreeDifferences(right)(right)).toEqual([]);
  });
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  const repository = Effect.fnUntraced(function* (config: boolean) {
    const root = yield* temporaryWorkingDirectory;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.join(root, ".git"));
    if (config) {
      yield* fs.makeDirectory(path.join(root, ".codex"));
      yield* fs.writeFileString(path.join(root, ".codex", "config.toml"), "[skills]\ninclude_instructions = true\n");
    }
    yield* fs.makeDirectory(path.join(root, ".claude", "skills", "grill-me"), { recursive: true });
    yield* fs.writeFileString(path.join(root, ".claude", "skills", "grill-me", "SKILL.md"), "old skill\n");
    return root;
  });

  it.effect("repeat projection is a byte-exact no-op and keeps links, unknown fields and disabled rows", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* repository(false);
      const canonical = path.join(root, "canonical", "config.toml");
      yield* fs.makeDirectory(path.dirname(canonical), { recursive: true });
      yield* fs.makeDirectory(path.join(root, ".codex"));
      yield* fs.writeFileString(
        canonical,
        '[skills]\ninclude_instructions = false\nfuture_key = "keep"\n[[skills.config]]\nname = "operator-skill"\nenabled = false\nowner = "operator"\n[mcp_servers.native]\nurl = "keep"\n'
      );
      yield* fs.symlink(canonical, path.join(root, ".codex", "config.toml"));
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
      const first = O.getOrThrow(yield* skillTreeDigest(root));
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
      const second = O.getOrThrow(yield* skillTreeDigest(root));
      expect(skillTreeDifferences(second.entries, first.entries)).toEqual([]);
      expect(second.hash).toBe(first.hash);
      expect(yield* fs.readLink(path.join(root, ".codex", "config.toml"))).toBe(canonical);
      const config = yield* fs.readFileString(canonical);
      expect(config).toContain('future_key = "keep"');
      expect(config).toContain('name = "operator-skill"\nenabled = false\nowner = "operator"');
      expect(config).toContain('[mcp_servers.native]\nurl = "keep"');
      expect(yield* fs.readFileString(path.join(root, ".claude", "skills", "grill-me", "SKILL.md"))).toBe(remoteSkill);
      // Every publication of the first run completed.
      const journals = yield* journalsIn(path.join(root, ".beep", "skills-backups", "journals"));
      expect(A.map(journals, (journal) => trackedOf(journal).state._tag)).toEqual(A.map(journals, () => "completed"));
    }).pipe(Effect.provideService(HttpClient.HttpClient, skillsClient))
  );

  it.effect("the next projection recovers a crashed skill directory first, then updates it", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const root = yield* repository(true);
      const target = path.join(root, ".claude", "skills", "grill-me");
      yield* crash("publish-directory", root, target, "exchanged");
      const journals = path.join(root, ".beep", "skills-backups", "journals");
      const [crashed] = yield* journalsIn(journals);
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
      expect(yield* TestConsole.logLines).toContain(`skills:update: recovery recovered ${crashed?.id} (intended)`);
      const fs = yield* FileSystem.FileSystem;
      expect(yield* fs.readFileString(path.join(target, "SKILL.md"))).toBe(remoteSkill);
      expect(A.filter(yield* listing(path.dirname(target)), Str.startsWith("."))).toEqual([]);
      const states = A.map(yield* journalsIn(journals), (journal) => trackedOf(journal).state._tag);
      expect(A.contains(states, "recovered")).toBe(true);
    }).pipe(Effect.provideService(HttpClient.HttpClient, skillsClient))
  );

  it.effect("skills recover reports each decision and fails on a refusal", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const root = yield* repository(true);
      const target = path.join(root, ".claude", "skills", "grill-me");
      yield* crash("publish-directory", root, target, "staged");
      yield* replaceTarget("directory", target);
      const exit = yield* runSkillsCommand(["recover"]).pipe(Effect.exit);
      exit.pipe(Exit.isFailure, assertTrue);
      const lines = yield* TestConsole.logLines;
      expect(lines).toContain("skills:recover: 1 journal(s) reconciled");
      expect(lines).toEqual(
        expect.arrayContaining([expect.stringMatching(/^- refused skills-.* \(competing-writer\)/)])
      );
      expect(yield* TestConsole.errorLines).toEqual(
        expect.arrayContaining([expect.stringContaining("skills:recover: 1 skill publication(s) refused recovery")])
      );
      // Without interruptions the command reports nothing and succeeds.
      const clean = yield* repository(true);
      expect(clean).not.toBe(root);
      yield* runSkillsCommand(["recover"]);
    }).pipe(Effect.provideService(HttpClient.HttpClient, skillsClient))
  );
});

// The test process's own publication owner, read from procfs as the writer does.
const liveOwnerStamp = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bootId = Str.trim(yield* fs.readFileString("/proc/sys/kernel/random/boot_id"));
  const stat = yield* fs.readFileString("/proc/self/stat");
  const fields = Str.split(Str.trim(Str.slice(O.getOrElse(Str.lastIndexOf(")")(stat), constant(-1)) + 1)(stat)), " ");
  return yield* encodeOwner(
    ModelsPublicationOwner.make({ bootId, pid: Number.parseInt(stat, 10), startTicks: fields[19] ?? "" })
  );
});

// A publication crashed at `staged`, so its owner is dead and only the lock can
// keep recovery away.
const crashedWithLock = Effect.fnUntraced(function* (stamp: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { journals, root, target } = yield* fixture("file", true);
  yield* crash("publish-file", root, target, "staged");
  const id = yield* firstJournalId(journals);
  const lock = path.join(journals, `${id}.recovering`);
  yield* fs.writeFileString(lock, stamp);
  return { id, journals, lock, root, target };
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  it.effect("a recovery lock held by a live process skips the journal and keeps the lock", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, lock, root } = yield* crashedWithLock(yield* liveOwnerStamp);
      const publisher = yield* publisherWith();
      expect(A.map(yield* publisher.recover(root, "pending"), (report) => report.result)).toEqual([
        ModelsRecoveryResult.cases.skipped.make({ reason: "lock-held" }),
      ]);
      expect((yield* firstTracked(journals)).state._tag).toBe("staged");
      expect(yield* fs.realPath(lock)).toBe(lock);
    })
  );

  it.effect("an unreadable stamp holds the lock during its grace window and is reclaimed after it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, lock, root } = yield* crashedWithLock("written by another version");
      const publisher = yield* publisherWith();
      expect(A.map(yield* publisher.recover(root, "pending"), (report) => report.result)).toEqual([
        ModelsRecoveryResult.cases.skipped.make({ reason: "lock-held" }),
      ]);
      expect((yield* firstTracked(journals)).state._tag).toBe("staged");
      // Move the stamp an hour into the past, past the ten-minute grace window.
      const stamped = O.getOrThrow((yield* fs.stat(lock)).mtime).getTime();
      const anHourEarlier = (stamped - 60 * 60 * 1000) / 1000;
      yield* fs.utimes(lock, anHourEarlier, anHourEarlier);
      expect(A.map(yield* publisher.recover(root, "pending"), (report) => report.result)).toEqual([
        ModelsRecoveryResult.cases.recovered.make({ outcome: "preimage" }),
      ]);
      expect(yield* fs.exists(lock)).toBe(false);
    })
  );

  it.effect("a lock that cannot be created for any reason but EEXIST fails typed as lock-unavailable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, root, target } = yield* fixture("file", true);
      yield* crash("publish-file", root, target, "staged");
      const refusing = FileSystem.FileSystem.of({
        ...fs,
        link: Effect.fn("SkillsRecoveryTest.link")((from, to) =>
          Str.endsWith(".recovering")(to) ? fs.link(`${from}.missing`, to) : fs.link(from, to)
        ),
      });
      const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, refusing));
      const error = yield* Effect.flip(publisher.recover(root, "pending"));
      expect(error.reason).toBe("lock-unavailable");
      expect(error.message).toContain("Cannot create the recovery lock (NotFound)");
      expect((yield* firstTracked(journals)).state._tag).toBe("staged");
      expect(A.filter(yield* listing(journals), (entry) => !Str.endsWith(".json")(entry))).toEqual([]);
    })
  );

  it.effect.prop(
    "property: every tracked skill publication round-trips through its journal codec",
    { publication: Arbitrary.schema(SkillTrackedPublication), entries: Arbitrary.schema(SkillTreeEntry.pipe(S.Array)) },
    ({ entries, publication }) =>
      Effect.gen(function* () {
        // Arbitrary values are null-prototype records, so compare the canonical
        // encoding rather than the decoded instances.
        const encoded = yield* encodeJournal(SkillPublicationJournal.make({ id: "skills-property", publication }));
        const decoded = yield* decodeJournal(encoded);
        expect(yield* encodeJournal(decoded)).toBe(encoded);
        expect(decoded.publication._tag).toBe("tracked");
        // A tree never differs from itself, so recovery names no entry for it.
        expect(skillTreeDifferences(entries, entries)).toEqual([]);
      }),
    { arbitrary: fcRuns(25) }
  );
});

// A repository in a fresh working directory, so `skills recover` finds it.
const createRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.realPath(yield* temporaryWorkingDirectory);
  yield* fs.makeDirectory(path.join(root, ".git"));
  return {
    journals: path.join(root, ".beep", "skills-backups", "journals"),
    root,
    target: path.join(root, "skills-lock.json"),
  };
});

// A `link` onto the new target that fails: either because another writer
// created the target first (EEXIST), or with an injected non-EEXIST error.
const failingCreate = Effect.fnUntraced(function* (
  target: string,
  failure: "competitor" | "PermissionDenied" | "Unknown"
) {
  const fs = yield* FileSystem.FileSystem;
  return FileSystem.FileSystem.of({
    ...fs,
    link: Effect.fn("SkillsRecoveryTest.createLink")(function* (from, to) {
      if (to !== target) return yield* fs.link(from, to);
      if (failure === "competitor") {
        yield* fs.writeFileString(target, competitorFile);
        return yield* fs.link(from, to);
      }
      return yield* PlatformError.systemError({
        _tag: failure,
        module: "FileSystem",
        method: "link",
        pathOrDescriptor: to,
      });
    }),
  });
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  it.effect("creating a target another writer created first is competing-writer, abandoned, and settles", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, root, target } = yield* createRepository;
      const publisher = yield* makeSkillPublisher().pipe(
        Effect.provideService(FileSystem.FileSystem, yield* failingCreate(target, "competitor"))
      );
      const error = yield* Effect.flip(publisher.publishFile(root, target, intendedFile));
      expect(error.reason).toBe("competing-writer");
      expect(yield* fs.readFileString(target)).toBe(competitorFile);
      const publication = yield* firstTracked(journals);
      expect(publication.state).toMatchObject({ _tag: "abandoned", from: "staged" });
      expect(yield* fs.exists(publication.staging)).toBe(false);
      expect(yield* fs.realPath(target)).toBe(target);
      yield* runSkillsCommand(["recover"]);
      yield* runSkillsCommand(["recover"]);
      expect(yield* TestConsole.logLines).toEqual(expect.arrayContaining(["skills:recover: 0 journal(s) reconciled"]));
      expect(yield* fs.readFileString(target)).toBe(competitorFile);
    }).pipe(Effect.provideService(HttpClient.HttpClient, skillsClient))
  );

  for (const code of ["PermissionDenied", "Unknown"] as const) {
    it.effect(`a ${code} link failure on a new target is a typed error, not a competing writer, and abandons`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { journals, root, target } = yield* createRepository;
        const publisher = yield* makeSkillPublisher().pipe(
          Effect.provideService(FileSystem.FileSystem, yield* failingCreate(target, code))
        );
        const error = yield* Effect.flip(publisher.publishFile(root, target, intendedFile));
        expect(error.reason).toBeUndefined();
        expect(error.message).toContain(code);
        expect(error.cause).toBeDefined();
        expect(yield* fs.exists(target)).toBe(false);
        const publication = yield* firstTracked(journals);
        expect(publication.state).toMatchObject({ _tag: "abandoned", from: "staged" });
        expect(yield* fs.exists(publication.staging)).toBe(false);
        expect(yield* fs.realPath(journals)).toBe(journals);
        yield* runSkillsCommand(["recover"]);
        expect(yield* (yield* publisherWith()).recover(root, "retry")).toEqual([]);
      }).pipe(Effect.provideService(HttpClient.HttpClient, skillsClient))
    );
  }

  it.effect("a crashed create whose target another writer took settles as abandoned instead of refusing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { journals, root, target } = yield* createRepository;
      yield* crash("publish-file", root, target, "staged");
      yield* fs.writeFileString(target, competitorFile);
      const id = yield* firstJournalId(journals);
      yield* runSkillsCommand(["recover"]);
      expect(yield* TestConsole.logLines).toEqual(
        expect.arrayContaining([expect.stringMatching(new RegExp(`^- abandoned ${id} `))])
      );
      const publication = yield* firstTracked(journals);
      expect(publication.state).toMatchObject({ _tag: "abandoned", from: "staged" });
      expect(yield* fs.exists(publication.staging)).toBe(false);
      expect(yield* fs.readFileString(target)).toBe(competitorFile);
      expect(yield* fs.realPath(target)).toBe(target);
      // A second recover is a no-op.
      expect(yield* (yield* publisherWith()).recover(root, "retry")).toEqual([]);
    }).pipe(Effect.provideService(HttpClient.HttpClient, skillsClient))
  );
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  it.effect("rejects foreign target kinds, symlink roots, and unsupported tree entries", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fixture("directory", true);
      const file = yield* fixture("file", true);
      const publisher = yield* publisherWith();
      expect(
        (yield* publisher.publishFile(directory.root, directory.target, intendedFile).pipe(Effect.flip)).message
      ).toContain("not a regular file");
      expect(
        (yield* publisher.publishDirectory(file.root, file.target, intendedFiles).pipe(Effect.flip)).message
      ).toContain("not a directory");
      const link = path.join(directory.root, "linked-tree");
      yield* fs.symlink(directory.target, link);
      assertNone(yield* skillTreeDigest(link));
      expect(
        (yield* publisher.publishDirectory(directory.root, link, intendedFiles).pipe(Effect.flip)).message
      ).toContain("symbolic link");
      for (const unusual of [directory.target, path.join(directory.target, "SKILL.md")]) {
        const wrapped = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("SkillsCoverage.stat")((...[entry]: Parameters<FileSystem.FileSystem["stat"]>) =>
            fs
              .stat(entry)
              .pipe(
                Effect.map((info): FileSystem.File.Info => (entry === unusual ? { ...info, type: "Socket" } : info))
              )
          ),
        });
        const isolated = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, wrapped));
        expect(
          (yield* isolated.publishDirectory(directory.root, directory.target, intendedFiles).pipe(Effect.flip)).message
        ).toContain("Refusing a skill");
        assertNone(
          yield* skillTreeDigest(directory.target).pipe(Effect.provideService(FileSystem.FileSystem, wrapped))
        );
      }
    })
  );

  it.effect("keeps typed fingerprint and capability failures before any publication", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, target } = yield* fixture("directory", true);
      for (const operation of ["stat", "readFile", "readDirectory"]) {
        const wrapped = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("SkillsCoverage.stat")((...[file]: Parameters<FileSystem.FileSystem["stat"]>) =>
            operation === "stat" && Str.includes("SKILL.md")(file) ? fs.stat(`${file}.missing`) : fs.stat(file)
          ),
          readFile: Effect.fn("SkillsCoverage.readFile")((...[file]: Parameters<FileSystem.FileSystem["readFile"]>) =>
            operation === "readFile" ? fs.readFile(`${file}.missing`) : fs.readFile(file)
          ),
          readDirectory: Effect.fn("SkillsCoverage.readDirectory")(
            (...[file]: Parameters<FileSystem.FileSystem["readDirectory"]>) =>
              operation === "readDirectory" ? fs.readDirectory(`${file}.missing`) : fs.readDirectory(file)
          ),
        });
        const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, wrapped));
        expect((yield* publisher.publishDirectory(root, target, intendedFiles).pipe(Effect.flip))._tag).toBe(
          "SkillPublicationError"
        );
      }
      const base = yield* ModelsAtomicExchange;
      const publisher = yield* publisherWith({
        ...base,
        qualify: Effect.fn("SkillsCoverage.qualify")(() =>
          Effect.fail(ModelsExchangeProbeError.make({ message: "fixture qualification failed" }))
        ),
      });
      expect((yield* publisher.publishDirectory(root, target, intendedFiles).pipe(Effect.flip)).reason).toBe(
        "exchange-probe-failed"
      );
    })
  );

  it.effect("retains live bytes and the recovery journal when a qualified exchange fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, target, journals } = yield* fixture("file", true);
      const base = yield* ModelsAtomicExchange;
      const publisher = yield* publisherWith({
        ...base,
        exchange: () => Effect.fail(ModelsLocatorError.make({ message: "fixture exchange failed", path: target })),
      });
      const error = yield* publisher.publishFile(root, target, intendedFile).pipe(Effect.flip);
      expect(error.message).toContain("fixture exchange failed");
      expect(error.target).toBe(target);
      expect(error.journal).toBeDefined();
      expect(yield* fs.readFileString(target)).toBe(nativeFile);
      const publication = yield* firstTracked(journals);
      expect(publication.state._tag).toBe("staged");
      expect(yield* fs.readFileString(publication.staging)).toBe(intendedFile);
      const reports = yield* (yield* publisherWith()).recover(root, "pending");
      expect(reports[0]?.result).toMatchObject({ _tag: "skipped", reason: "owner-alive" });
    })
  );

  for (const corruption of ["file-bytes", "tree-bytes", "missing-tree"]) {
    it.effect(`rejects ${corruption} corruption between staging and verification`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const kind = corruption === "file-bytes" ? "file" : "directory";
        const { root, target } = yield* fixture(kind, true);
        const wrapped = FileSystem.FileSystem.of({
          ...fs,
          writeFileString: Effect.fn("SkillsCoverage.writeFileString")(
            (...[file, text, options]: Parameters<FileSystem.FileSystem["writeFileString"]>) =>
              fs.writeFileString(
                file,
                corruption === "file-bytes" && Str.includes(".tmp-")(file) ? competitorFile : text,
                options
              )
          ),
          rename: Effect.fn("SkillsCoverage.rename")((...[from, to]: Parameters<FileSystem.FileSystem["rename"]>) =>
            fs
              .rename(from, to)
              .pipe(
                Effect.andThen(
                  Str.endsWith(".partial")(from) && Str.includes(".stage-")(to)
                    ? corruption === "missing-tree"
                      ? fs.remove(to, { recursive: true })
                      : fs.writeFileString(path.join(to, "unexpected.md"), "foreign")
                    : Effect.void
                )
              )
          ),
        });
        const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, wrapped));
        expect((yield* publish(publisher, kind, root, target).pipe(Effect.flip)).message).toContain(
          "differs from the planned"
        );
      })
    );
  }

  it.effect("rejects staged paths outside the tree and detects a post-exchange writer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, target } = yield* fixture("directory", false);
      for (const file of ["../escape.md", "."]) {
        const publisher = yield* publisherWith();
        const error = yield* publisher
          .publishDirectory(root, target, [SkillPublicationFile.make({ path: file, bytes: encoder.encode("foreign") })])
          .pipe(Effect.flip);
        expect(error.message).toContain("outside its staged tree");
      }
      const existing = yield* fixture("file", true);
      const base = yield* ModelsAtomicExchange;
      const publisher = yield* publisherWith({
        ...base,
        exchange: Effect.fn("SkillsCoverage.exchange")(
          (...[left, right]: Parameters<ModelsAtomicExchange["Service"]["exchange"]>) =>
            base
              .exchange(left, right)
              .pipe(Effect.andThen(fs.writeFileString(right, competitorFile).pipe(Effect.orDie)))
        ),
      });
      const error = yield* publisher.publishFile(existing.root, existing.target, intendedFile).pipe(Effect.flip);
      expect(error.message).toContain("Skill target changed after replacement");
      expect(yield* fs.readFileString(existing.target)).toBe(competitorFile);
    })
  );

  it.effect("refuses recovery without recorded exchange identity or after filesystem identity changes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const { identity, reason } of [
        { identity: O.none<string>(), reason: "competing-writer" },
        { identity: O.some("changed-filesystem"), reason: "filesystem-changed" },
      ]) {
        const { journals, root, target } = yield* fixture("file", true);
        yield* crash("publish-file", root, target, "staged");
        const journal = O.getOrThrow(A.head(yield* journalsIn(journals)));
        const tracked = trackedOf(journal);
        yield* fs.writeFileString(target, yield* fs.readFileString(tracked.staging));
        yield* fs.writeFileString(tracked.staging, competitorFile);
        yield* fs.writeFileString(
          path.join(journals, `${journal.id}.json`),
          yield* encodeJournal(
            SkillPublicationJournal.make({
              ...journal,
              publication: SkillTrackedPublication.make({ ...tracked, filesystem: identity }),
            })
          )
        );
        const reports = yield* (yield* publisherWith()).recover(root, "pending");
        expect(reports[0]?.result).toMatchObject({
          _tag: "refused",
          reason,
        });
        expect(yield* fs.readFileString(tracked.staging)).toBe(competitorFile);
      }
    })
  );
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  for (const procfs of ["unavailable", "empty-boot", "rebooted", "malformed-stat", "zombie", "exited"]) {
    it.effect(`recovery respects ${procfs} procfs evidence`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { journals, root, target } = yield* fixture("file", true);
        yield* crash("publish-file", root, target, "staged");
        const recorded = O.getOrThrow((yield* firstTracked(journals)).owner);
        const boot = Match.value(procfs).pipe(
          Match.when("empty-boot", () => ""),
          Match.when("rebooted", () => "new-boot"),
          Match.orElse(() => recorded.bootId)
        );
        const state = procfs === "zombie" ? "Z" : "X";
        const stat =
          procfs === "malformed-stat"
            ? "malformed"
            : `${recorded.pid} (fixture) ${A.join([state, ...A.replicate("0", 18), recorded.startTicks], " ")}`;
        const wrapped = FileSystem.FileSystem.of({
          ...fs,
          readFileString: Effect.fn("SkillsCoverage.readFileString")(
            (...[file, options]: Parameters<FileSystem.FileSystem["readFileString"]>) => {
              if (!Str.startsWith("/proc/")(file)) return fs.readFileString(file, options);
              if (procfs === "unavailable") return fs.readFileString(`${root}/missing`);
              return Effect.succeed(Str.endsWith("boot_id")(file) ? boot : stat);
            }
          ),
        });
        const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, wrapped));
        const reports = yield* publisher.recover(root, "pending");
        expect(reports[0]?.result).toMatchObject(
          procfs === "unavailable"
            ? { _tag: "skipped", reason: "owner-alive" }
            : { _tag: "recovered", outcome: "preimage" }
        );
        expect(yield* fs.readFileString(target)).toBe(nativeFile);
      })
    );
  }

  for (const race of ["missing-clock", "rename-failed", "stamp-replaced", "stamp-vanished", "discard-failed"]) {
    it.effect(`recovery preserves evidence when ${race}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, lock } = yield* crashedWithLock("unreadable stamp");
        yield* fs.utimes(lock, 0, 0);
        const wrapped = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("SkillsCoverage.stat")((...[file]: Parameters<FileSystem.FileSystem["stat"]>) =>
            race === "missing-clock" && (file === lock || Str.endsWith(".clock")(file))
              ? fs.stat(`${file}.missing`)
              : fs.stat(file)
          ),
          readFileString: Effect.fn("SkillsCoverage.readFileString")(
            (...[file, options]: Parameters<FileSystem.FileSystem["readFileString"]>) =>
              race === "stamp-vanished" && file === lock
                ? fs.remove(lock).pipe(Effect.andThen(fs.readFileString(file, options)))
                : fs.readFileString(file, options)
          ),
          rename: Effect.fn("SkillsCoverage.rename")((...[from, to]: Parameters<FileSystem.FileSystem["rename"]>) =>
            from === lock && race === "rename-failed"
              ? fs.rename(`${from}.missing`, to)
              : fs
                  .rename(from, to)
                  .pipe(
                    Effect.andThen(
                      from === lock && race === "stamp-replaced"
                        ? fs.writeFileString(to, "replacement stamp")
                        : Effect.void
                    )
                  )
          ),
          remove: Effect.fn("SkillsCoverage.remove")(
            (...[file, options]: Parameters<FileSystem.FileSystem["remove"]>) =>
              race === "discard-failed" && Str.endsWith(".stale")(file) ? fs.remove(root) : fs.remove(file, options)
          ),
        });
        const publisher = yield* makeSkillPublisher().pipe(Effect.provideService(FileSystem.FileSystem, wrapped));
        if (race === "discard-failed") {
          const error = yield* publisher.recover(root, "pending").pipe(Effect.flip);
          expect(error.message).toContain("Cannot reclaim a skill recovery lock");
        } else {
          const reports = yield* publisher.recover(root, "pending");
          expect(reports[0]?.result).toMatchObject(
            race === "stamp-vanished" ? { _tag: "recovered" } : { _tag: "skipped", reason: "lock-held" }
          );
          if (race === "stamp-replaced") expect(yield* fs.readFileString(lock)).toBe("replacement stamp");
        }
      })
    );
  }
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  for (const mutation of [
    "target-link",
    "target-missing",
    "foreign-stage",
    "settled-during-lock",
    "failed-return-confirmation",
  ]) {
    it.effect(`recovery refuses or skips ${mutation} without discarding competing evidence`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { journals, root, target } = yield* fixture("file", true);
        yield* crash("publish-file", root, target, "staged");
        const journal = O.getOrThrow(A.head(yield* journalsIn(journals)));
        const tracked = trackedOf(journal);
        const journalPath = path.join(journals, `${journal.id}.json`);
        yield* Match.value(mutation).pipe(
          Match.when("target-link", () => fs.remove(target).pipe(Effect.andThen(fs.symlink(tracked.staging, target)))),
          Match.when("target-missing", () => fs.remove(target)),
          Match.when("foreign-stage", () => fs.writeFileString(tracked.staging, competitorFile)),
          Match.when("failed-return-confirmation", () =>
            fs.readFileString(tracked.staging).pipe(
              Effect.flatMap((text) => fs.writeFileString(target, text)),
              Effect.andThen(fs.writeFileString(tracked.staging, competitorFile))
            )
          ),
          Match.orElse(() => Effect.void)
        );
        const wrapped = FileSystem.FileSystem.of({
          ...fs,
          link: Effect.fn("SkillsCoverage.link")((...[from, to]: Parameters<FileSystem.FileSystem["link"]>) =>
            fs.link(from, to).pipe(
              Effect.andThen(
                mutation === "settled-during-lock" && Str.endsWith(".recovering")(to)
                  ? encodeJournal(
                      SkillPublicationJournal.make({
                        ...journal,
                        publication: SkillTrackedPublication.make({
                          ...tracked,
                          state: ModelsPublicationState.cases.completed.make({}),
                        }),
                      })
                    ).pipe(
                      Effect.orDie,
                      Effect.flatMap((text) => fs.writeFileString(journalPath, text))
                    )
                  : Effect.void
              )
            )
          ),
        });
        const base = yield* ModelsAtomicExchange;
        const exchange = ModelsAtomicExchange.of({
          ...base,
          exchange: Effect.fn("SkillsCoverage.exchange")(
            (...[left, right]: Parameters<ModelsAtomicExchange["Service"]["exchange"]>) =>
              base
                .exchange(left, right)
                .pipe(
                  Effect.andThen(
                    mutation === "failed-return-confirmation"
                      ? fs.writeFileString(right, "another competing writer").pipe(Effect.orDie)
                      : Effect.void
                  )
                )
          ),
        });
        const publisher = yield* makeSkillPublisher().pipe(
          Effect.provideService(FileSystem.FileSystem, wrapped),
          Effect.provideService(ModelsAtomicExchange, exchange)
        );
        const reports = yield* publisher.recover(root, "pending");
        expect(reports[0]?.result).toMatchObject(
          mutation === "settled-during-lock"
            ? { _tag: "skipped", reason: "settled" }
            : {
                _tag: "refused",
                reason:
                  mutation === "target-missing"
                    ? "target-missing"
                    : mutation === "foreign-stage"
                      ? "foreign-artifact"
                      : "competing-writer",
              }
        );
        if (mutation === "failed-return-confirmation")
          expect(reports[0]?.result).toMatchObject({ detail: expect.stringContaining("could not be confirmed") });
      })
    );
  }
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  it.effect("identical direct publications are no-ops for both file and directory targets", () =>
    Effect.gen(function* () {
      for (const kind of ["file", "directory"] as const) {
        const { root, target, journals } = yield* fixture(kind, false);
        const publisher = yield* publisherWith();
        yield* publish(publisher, kind, root, target);
        const before = yield* listing(journals);
        yield* publish(publisher, kind, root, target);
        expect(yield* listing(journals)).toEqual(before);
        expect(yield* fingerprint(target, kind)).toBe(yield* intendedFingerprint(kind));
      }
    })
  );

  it.effect("keeps the intended target when a displaced stage disappears before verification", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, target, journals } = yield* fixture("file", true);
      const base = yield* ModelsAtomicExchange;
      const publisher = yield* publisherWith({
        ...base,
        exchange: Effect.fn("SkillsCoverage.removeDisplaced")((left, right) =>
          base.exchange(left, right).pipe(Effect.andThen(fs.remove(left).pipe(Effect.orDie)))
        ),
      });
      const error = yield* publisher.publishFile(root, target, intendedFile).pipe(Effect.flip);
      expect(error.message).toContain("recovery state retained");
      expect(yield* fs.readFileString(target)).toBe(intendedFile);
      expect((yield* firstTracked(journals)).state._tag).toBe("recovered");
    })
  );
});

layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer))
  ),
  { timeout: "180 seconds" }
)((it) => {
  for (const mutation of ["owner-absent", "foreign-recorded-path"]) {
    it.effect(`recovery handles ${mutation} through the journal boundary`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, target, journals } = yield* fixture("file", true);
        yield* crash("publish-file", root, target, "staged");
        const journal = O.getOrThrow(A.head(yield* journalsIn(journals)));
        const tracked = trackedOf(journal);
        const foreign = path.join(root, "foreign-staging");
        yield* fs.writeFileString(foreign, competitorFile);
        const publication = SkillTrackedPublication.make({
          ...tracked,
          ...(mutation === "owner-absent" ? { owner: O.none() } : { staging: foreign }),
        });
        yield* fs.writeFileString(
          path.join(journals, `${journal.id}.json`),
          yield* encodeJournal(SkillPublicationJournal.make({ ...journal, publication }))
        );
        const reports = yield* (yield* publisherWith()).recover(root, "pending");
        expect(reports[0]?.result).toMatchObject(
          mutation === "owner-absent"
            ? { _tag: "recovered", outcome: "preimage" }
            : { _tag: "refused", reason: "foreign-artifact" }
        );
        expect(yield* fs.readFileString(target)).toBe(nativeFile);
        expect(yield* fs.readFileString(foreign)).toBe(competitorFile);
      })
    );
  }
});
