import { modelsCommand } from "@beep/repo-cli/commands/Models";
import {
  ModelsApply,
  ModelsApplyLive,
  ModelsAtomicExchange,
} from "@beep/repo-cli/commands/Models/Models.apply.service";
import { ModelsLocatorError } from "@beep/repo-cli/commands/Models/Models.errors";
import {
  ModelsPublicationOwner,
  ModelsRecoveryReport,
  ModelsRecoveryResult,
  ModelsTrackedPublication,
} from "@beep/repo-cli/commands/Models/Models.exchange.schemas";
import {
  LocatorBinding,
  ModelsApplyJournal,
  ModelsLocatorWrite,
} from "@beep/repo-cli/commands/Models/Models.manifest.schemas";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { modelsTestExchangeLayer } from "./helpers/models-atomic-exchange.ts";
import type { ModelsAtomicExchangeShape } from "@beep/repo-cli/commands/Models/Models.apply.service";
import type { ModelsRecoveryOutcome } from "@beep/repo-cli/commands/Models/Models.exchange.schemas";

const crashWriterUrl = new URL("./fixtures/models/exchange-crash-writer.ts", import.meta.url);
const decodeJournal = S.decodeUnknownEffect(S.fromJsonString(ModelsApplyJournal));
const encodeJournal = S.encodeEffect(S.fromJsonString(ModelsApplyJournal));
const encodeOwner = S.encodeEffect(S.fromJsonString(ModelsPublicationOwner));
const JsonRecord = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeRecord = S.decodeUnknownEffect(JsonRecord);
const encodeRecord = S.encodeEffect(JsonRecord);
const run = Command.runWith(modelsCommand, { version: "0.0.0" });

const request = ModelsLocatorWrite.make({
  locator: {
    _tag: "toml-top-level-key",
    binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
    render: { _tag: "verbatim" },
    key: "model",
  },
  expected: "gpt-6.1-sol",
});
// CRLF, a BOM-free multibyte comment and a native table: recovery must keep every byte.
const native = '# café 🔑 retained\r\nmodel = "old" # owned\r\nunknown = { retained = true }\r\n[projects."a b"]\r\n';
const intended = Str.replace('"old"', '"gpt-6.1-sol"')(native);
const competitor = 'model = "competitor"\nnew_native_key = true\n';
// A boot id no live process can carry, so an owner rewritten to it is dead.
const deadOwner = ModelsPublicationOwner.make({ bootId: "retired-boot", pid: 1, startTicks: "1" });

const sha256 = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const crypto = yield* Digest.Digest;
  return Hex.encode(yield* crypto.digest(Digest.sha256, bytes));
});
const textSha = (text: string) => sha256(new TextEncoder().encode(text));
const fileSha = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* sha256(yield* fs.readFile(file));
});

const fixture = Effect.fnUntraced(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix });
  const file = path.join(root, "config.toml");
  const backups = path.join(root, "backups");
  yield* fs.writeFileString(file, native, { mode: 0o644 });
  return { backups, file, root };
});

const listing = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory(directory), Order.String);
});

const onlyJournal = Effect.fnUntraced(function* (backups: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entry = O.getOrThrow(A.findFirst(yield* fs.readDirectory(backups), Str.endsWith(".json")));
  const file = path.join(backups, entry);
  return { file, journal: yield* fs.readFileString(file).pipe(Effect.flatMap(decodeJournal)) };
});

const trackedOf = (publication: ModelsApplyJournal["publication"]) =>
  O.liftPredicate(publication, S.is(ModelsTrackedPublication)).pipe(O.getOrThrow);

const writerWith = Effect.fn("ModelsRecoveryTest.writerWith")(function* (exchange?: ModelsAtomicExchangeShape) {
  const capability = exchange === undefined ? yield* ModelsAtomicExchange : exchange;
  const services = yield* Layer.build(
    ModelsApplyLive.pipe(Layer.provide(Layer.succeed(ModelsAtomicExchange, capability)))
  );
  return Context.get(services, ModelsApply);
});

// A writer over a wrapped filesystem, for interleavings the exchange seam alone
// cannot express.
const writerWithFs = Effect.fn("ModelsRecoveryTest.writerWithFs")(function* (
  fs: FileSystem.FileSystem,
  exchange?: ModelsAtomicExchangeShape
) {
  const capability = exchange === undefined ? yield* ModelsAtomicExchange : exchange;
  const services = yield* Layer.build(
    ModelsApplyLive.pipe(
      Layer.provide(
        Layer.mergeAll(Layer.succeed(FileSystem.FileSystem, fs), Layer.succeed(ModelsAtomicExchange, capability))
      )
    )
  );
  return Context.get(services, ModelsApply);
});

// Spawn the real writer, wait until it reports the named crash point, then
// SIGKILL it and reap it. The test scope kills it on every other exit too.
const crash = Effect.fn("ModelsRecoveryTest.crash")(function* (
  mode: "apply" | "restore" | "recover",
  target: { readonly backups: string; readonly file: string },
  halt: string,
  journal = "none"
) {
  const path = yield* Path.Path;
  const writer = yield* path.fromFileUrl(crashWriterUrl);
  const child = yield* ChildProcess.make("bun", [writer, mode, target.file, target.backups, halt, journal], {
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

// Rewrite the publication owner to a dead process, as a crash would leave it.
const abandon = Effect.fnUntraced(function* (
  backups: string,
  edit: (publication: ModelsTrackedPublication) => ModelsTrackedPublication = (publication) => publication
) {
  const fs = yield* FileSystem.FileSystem;
  const { file, journal } = yield* onlyJournal(backups);
  const publication = trackedOf(journal.publication);
  yield* fs.writeFileString(
    file,
    yield* encodeJournal(
      ModelsApplyJournal.make({
        ...journal,
        publication: edit(ModelsTrackedPublication.make({ ...publication, owner: O.some(deadOwner) })),
      })
    )
  );
  return journal;
});

const recovered = (
  journal: string,
  outcome: ModelsRecoveryOutcome,
  role: "publication" | "restoration" = "publication"
) => ModelsRecoveryReport.make({ journal, role, result: ModelsRecoveryResult.cases.recovered.make({ outcome }) });

// An exchange wrapper that interferes with, or fails, the publication exchange.
const interfering = Effect.fnUntraced(function* (
  file: string,
  behavior: "refuse" | "exchange-then-fail" | "displace-then-fail"
) {
  const fs = yield* FileSystem.FileSystem;
  const base = yield* ModelsAtomicExchange;
  const fail = ModelsLocatorError.make({ message: "Simulated process death during the exchange." });
  return ModelsAtomicExchange.of({
    qualify: base.qualify,
    exchange: Effect.fn("ModelsRecoveryTest.exchange")(function* (left, right) {
      if (left !== file && right !== file) return yield* base.exchange(left, right);
      if (behavior === "refuse") return yield* fail;
      if (behavior === "displace-then-fail")
        yield* fs
          .writeFileString(`${file}.competitor`, competitor)
          .pipe(
            Effect.andThen(fs.rename(`${file}.competitor`, file)),
            ModelsLocatorError.mapError("Test interference failed.")
          );
      yield* base.exchange(left, right);
      return yield* fail;
    }),
  });
});

const interrupted = Effect.fnUntraced(function* (
  prefix: string,
  behavior: "refuse" | "exchange-then-fail" | "displace-then-fail"
) {
  const target = yield* fixture(prefix);
  const writer = yield* writerWith(yield* interfering(target.file, behavior));
  yield* Effect.flip(writer.apply(target.file, [request], "write", target.backups));
  return target;
});

const crashPoints: ReadonlyArray<readonly [string, ModelsRecoveryOutcome]> = [
  ["intent", "preimage"],
  ["backed-up", "preimage"],
  ["staged", "preimage"],
  ["exchange-returned", "intended"],
  ["exchanged", "intended"],
  ["verified", "intended"],
  ["completed", "intended"],
];

const consoleLayer = Layer.effect(Console.Console, TestConsole.make);
layer(
  modelsTestExchangeLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer, consoleLayer))
  ),
  { timeout: "120 seconds" }
)((it) => {
  for (const [point, outcome] of crashPoints) {
    it.effect(`SIGKILL at ${point}: automatic recovery is byte-exact and idempotent`, () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const target = yield* fixture(`recovery-auto-${point}-`);
        yield* crash("apply", target, point);
        const { journal } = yield* onlyJournal(target.backups);
        const writer = yield* writerWith();
        const reports = yield* writer.recover(target.backups);
        expect(reports).toEqual(point === "completed" ? [] : [recovered(journal.id, outcome)]);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(outcome === "preimage" ? native : intended));
        expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
        const backups = yield* listing(target.backups);
        expect(backups).toEqual(
          outcome === "preimage" ? [`${journal.id}.json`] : [`${journal.id}.backup`, `${journal.id}.json`]
        );
        const settled = trackedOf((yield* onlyJournal(target.backups)).journal.publication);
        expect(settled.state._tag).toBe(point === "completed" ? "completed" : "recovered");
        if (outcome === "intended")
          expect(yield* fileSha(path.join(target.backups, `${journal.id}.backup`))).toBe(yield* textSha(native));
        // Idempotent: a second run is a no-op with identical bytes and artifacts.
        expect(yield* writer.recover(target.backups)).toEqual([]);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(outcome === "preimage" ? native : intended));
        expect(yield* listing(target.backups)).toEqual(backups);
      })
    );

    it.effect(`SIGKILL at ${point}: manual restore returns the preimage byte-exact`, () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const target = yield* fixture(`recovery-manual-${point}-`);
        yield* crash("apply", target, point);
        const { journal } = yield* onlyJournal(target.backups);
        const writer = yield* writerWith();
        yield* writer.restore(path.join(target.backups, `${journal.id}.json`), target.backups);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
        expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
        // A second restore never changes the restored bytes.
        yield* writer.restore(path.join(target.backups, `${journal.id}.json`), target.backups).pipe(Effect.result);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
        expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
      })
    );

    it.effect(`SIGKILL at ${point}: the next apply recovers first, then writes`, () =>
      Effect.gen(function* () {
        const target = yield* fixture(`recovery-next-${point}-`);
        yield* crash("apply", target, point);
        const { journal } = yield* onlyJournal(target.backups);
        const writer = yield* writerWith();
        const next = yield* writer.apply(target.file, [request], "write", target.backups);
        if (outcome === "preimage") next.pipe(O.isSome, assertTrue);
        else assertNone(next);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
        expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const first = trackedOf(
          (yield* fs
            .readFileString(path.join(target.backups, `${journal.id}.json`))
            .pipe(Effect.flatMap(decodeJournal))).publication
        );
        expect(first.state._tag).toBe(point === "completed" ? "completed" : "recovered");
      })
    );
  }

  it.effect("SIGKILL during recovery is reconciled again from the bytes on disk", () =>
    Effect.gen(function* () {
      const target = yield* fixture("recovery-twice-");
      yield* crash("apply", target, "exchange-returned");
      yield* crash("recover", target, "recovering");
      const { journal } = yield* onlyJournal(target.backups);
      const state = trackedOf(journal.publication).state;
      expect(state).toMatchObject({ _tag: "recovering", from: "staged" });
      const writer = yield* writerWith();
      expect(yield* writer.recover(target.backups)).toEqual([recovered(journal.id, "intended")]);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
      expect(yield* writer.recover(target.backups)).toEqual([]);
    })
  );

  for (const [point, outcome] of [
    ["staged", "preimage"],
    ["exchange-returned", "intended"],
  ] as const) {
    it.effect(`SIGKILL during a restore at ${point} recovers byte-exact`, () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const target = yield* fixture(`recovery-restore-${point}-`);
        const writer = yield* writerWith();
        const journal = O.getOrThrow(yield* writer.apply(target.file, [request], "write", target.backups));
        yield* crash("restore", target, point, journal.id);
        expect(yield* writer.recover(target.backups)).toEqual([recovered(journal.id, outcome, "restoration")]);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(outcome === "intended" ? native : intended));
        expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
        expect(yield* listing(target.backups)).toEqual([`${journal.id}.backup`, `${journal.id}.json`]);
        // A restoration that never landed is published afresh by the next restore.
        const restore = writer.restore(path.join(target.backups, `${journal.id}.json`), target.backups);
        if (outcome === "preimage") yield* restore;
        else yield* Effect.flip(restore);
        expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
        expect(yield* writer.recover(target.backups)).toEqual([]);
      })
    );
  }

  for (const [point, interference] of [
    ["staged", "replace"],
    ["exchange-returned", "in-place"],
  ] as const) {
    it.effect(`refuses a competing writer after SIGKILL at ${point} and keeps every artifact`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const target = yield* fixture(`recovery-competing-${point}-`);
        yield* crash("apply", target, point);
        if (interference === "replace") {
          yield* fs.writeFileString(path.join(target.root, "competitor"), competitor);
          yield* fs.rename(path.join(target.root, "competitor"), target.file);
        } else yield* fs.writeFileString(target.file, competitor);
        const { journal } = yield* onlyJournal(target.backups);
        const before = { root: yield* listing(target.root), backups: yield* listing(target.backups) };
        const publication = trackedOf(journal.publication);
        const writer = yield* writerWith();
        const [report] = yield* writer.recover(target.backups);
        expect(report?.result).toMatchObject({ _tag: "refused", reason: "competing-writer" });
        expect(yield* fs.readFileString(target.file)).toBe(competitor);
        expect(yield* listing(target.root)).toEqual(before.root);
        expect(A.length(before.root)).toBe(4);
        expect(yield* fileSha(publication.staging)).toBe(yield* textSha(point === "staged" ? intended : native));
        expect(yield* fileSha(path.join(target.backups, `${journal.id}.backup`))).toBe(yield* textSha(native));
        expect(trackedOf((yield* onlyJournal(target.backups)).journal.publication).state).toMatchObject({
          _tag: "refused",
          reason: "competing-writer",
        });
        // Refusal is durable: automatic recovery does not revisit it.
        expect(yield* writer.recover(target.backups)).toEqual([]);
        expect(yield* listing(target.backups)).toEqual(before.backups);
        // An explicit restore retries, and refuses again with the typed reason.
        const refusal = yield* Effect.flip(
          writer.restore(path.join(target.backups, `${journal.id}.json`), target.backups)
        );
        expect(refusal.reason).toBe("competing-writer");
        expect(refusal.message).toContain(`Journal: ${journal.id}`);
        expect(yield* fs.readFileString(target.file)).toBe(competitor);
        expect(yield* listing(target.root)).toEqual(before.root);
      })
    );
  }

  const propertyBase = ModelsApplyJournal.make({
    id: "models-property",
    file: "/srv/config/app.toml",
    backup: "/srv/backups/models-property.backup",
    beforeHash: "before",
    afterHash: "after",
    mode: 0o644,
    writes: O.some([request]),
    requestedFile: O.some("/srv/config/app.toml"),
    requestedLink: O.none(),
  });
  it.effect.prop(
    "round-trips every tracked publication state and decodes a missing state as legacy",
    { publication: Arbitrary.schema(ModelsTrackedPublication) },
    ({ publication }) =>
      Effect.gen(function* () {
        const encoded = yield* encodeJournal(
          ModelsApplyJournal.make({ ...propertyBase, publication, restoration: O.some(publication) })
        );
        // Arbitrary values are null-prototype records, so compare the canonical
        // encoding rather than object identity of the decoded instances.
        const decoded = yield* decodeJournal(encoded);
        expect(yield* encodeJournal(decoded)).toBe(encoded);
        expect(decoded.publication._tag).toBe("tracked");
        const record = yield* decodeRecord(encoded);
        const legacy = yield* decodeJournal(yield* encodeRecord(R.remove(record, "publication")));
        expect(legacy.publication._tag).toBe("legacy");
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("decodes a legacy journal to the legacy state and leaves it to restore", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const target = yield* fixture("recovery-legacy-");
      const writer = yield* writerWith();
      const applied = O.getOrThrow(yield* writer.apply(target.file, [request], "write", target.backups));
      const { file } = yield* onlyJournal(target.backups);
      const record = yield* fs.readFileString(file).pipe(Effect.flatMap(decodeRecord));
      yield* fs.writeFileString(file, yield* encodeRecord(R.remove(R.remove(record, "publication"), "restoration")));
      const { journal } = yield* onlyJournal(target.backups);
      expect(journal.publication._tag).toBe("legacy");
      assertNone(journal.restoration);
      const before = yield* listing(target.backups);
      expect(yield* writer.recover(target.backups)).toEqual([
        ModelsRecoveryReport.make({
          journal: applied.id,
          role: "publication",
          result: ModelsRecoveryResult.cases.skipped.make({ reason: "legacy" }),
        }),
      ]);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
      expect(yield* listing(target.backups)).toEqual(before);
      yield* writer.restore(file, target.backups);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
    })
  );

  it.effect("leaves a publication alone while its owning process is alive", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const target = yield* interrupted("recovery-alive-", "refuse");
      const { journal } = yield* onlyJournal(target.backups);
      expect(trackedOf(journal.publication).state._tag).toBe("staged");
      const writer = yield* writerWith();
      const before = yield* listing(target.root);
      expect(yield* writer.recover(target.backups)).toEqual([
        ModelsRecoveryReport.make({
          journal: journal.id,
          role: "publication",
          result: ModelsRecoveryResult.cases.skipped.make({ reason: "owner-alive" }),
        }),
      ]);
      const refusal = yield* Effect.flip(
        writer.restore(path.join(target.backups, `${journal.id}.json`), target.backups)
      );
      expect(refusal.reason).toBe("owner-alive");
      expect(yield* listing(target.root)).toEqual(before);
      yield* abandon(target.backups);
      expect(yield* writer.recover(target.backups)).toEqual([recovered(journal.id, "preimage")]);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
      expect(yield* listing(target.backups)).toEqual([`${journal.id}.json`]);
    })
  );

  it.effect("finishes a publication whose exchange landed before its process died", () =>
    Effect.gen(function* () {
      const target = yield* interrupted("recovery-landed-", "exchange-then-fail");
      const journal = yield* abandon(target.backups);
      const writer = yield* writerWith();
      expect(yield* writer.recover(target.backups)).toEqual([recovered(journal.id, "intended")]);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
    })
  );

  it.effect("returns a displaced competing writer to the live path and refuses", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const target = yield* interrupted("recovery-displaced-", "displace-then-fail");
      const journal = yield* abandon(target.backups);
      const publication = trackedOf(journal.publication);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
      expect(yield* fs.readFileString(publication.staging)).toBe(competitor);
      const writer = yield* writerWith();
      const [report] = yield* writer.recover(target.backups);
      expect(report?.result).toMatchObject({ _tag: "refused", reason: "competing-writer" });
      expect(report?.result._tag === "refused" && report.result.detail).toContain("returned to the live path");
      expect(yield* fs.readFileString(target.file)).toBe(competitor);
      expect(yield* fileSha(publication.staging)).toBe(yield* textSha(intended));
      expect(yield* writer.recover(target.backups)).toEqual([]);
      expect(yield* fs.readFileString(target.file)).toBe(competitor);
    })
  );

  it.effect("refuses an exchange when the target filesystem identity changed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const target = yield* interrupted("recovery-filesystem-", "displace-then-fail");
      const journal = yield* abandon(target.backups, (publication) =>
        ModelsTrackedPublication.make({ ...publication, filesystem: "0:other-filesystem" })
      );
      const writer = yield* writerWith();
      const [report] = yield* writer.recover(target.backups);
      expect(report?.result).toMatchObject({ _tag: "refused", reason: "filesystem-changed" });
      expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
      expect(yield* fs.readFileString(trackedOf(journal.publication).staging)).toBe(competitor);
    })
  );

  it.effect("refuses an exchange for a journal identity recorded without a mount id", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const target = yield* interrupted("recovery-older-identity-", "displace-then-fail");
      // Journals written before #1944 keyed the filesystem as `device:type`; that
      // key can never equal a mount-qualified identity, so recovery refuses.
      const journal = yield* abandon(target.backups, (publication) =>
        ModelsTrackedPublication.make({
          ...publication,
          filesystem: Str.replace(/^\d+:/, "")(publication.filesystem),
        })
      );
      expect(trackedOf(journal.publication).filesystem).toMatch(/^\d+:\d+:test-rename$/);
      const writer = yield* writerWith();
      const [report] = yield* writer.recover(target.backups);
      expect(report?.result).toMatchObject({ _tag: "refused", reason: "filesystem-changed" });
      expect(yield* fileSha(target.file)).toBe(yield* textSha(intended));
      expect(yield* fs.readFileString(trackedOf(journal.publication).staging)).toBe(competitor);
    })
  );

  for (const tamper of [
    "foreign-stage",
    "foreign-retained",
    "missing-target",
    "linked-target",
    "outside-path",
  ] as const) {
    it.effect(`refuses and keeps every artifact for ${tamper}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const target = yield* interrupted(`recovery-${tamper}-`, "refuse");
        const { journal } = yield* onlyJournal(target.backups);
        const publication = trackedOf(journal.publication);
        const outside = path.join(target.root, "outside.tmp");
        yield* fs.writeFileString(outside, intended);
        if (tamper === "foreign-stage") yield* fs.writeFileString(publication.staging, "foreign");
        if (tamper === "foreign-retained") {
          yield* fs.remove(publication.retained);
          yield* fs.writeFileString(publication.retained, "foreign");
        }
        if (tamper === "missing-target") yield* fs.remove(target.file);
        if (tamper === "linked-target") {
          yield* fs.rename(target.file, path.join(target.root, "moved.toml"));
          yield* fs.symlink(path.join(target.root, "moved.toml"), target.file);
        }
        yield* abandon(target.backups, (entry) =>
          tamper === "outside-path" ? ModelsTrackedPublication.make({ ...entry, staging: outside }) : entry
        );
        const before = yield* listing(target.root);
        const writer = yield* writerWith();
        const [report] = yield* writer.recover(target.backups);
        expect(report?.result).toMatchObject({
          _tag: "refused",
          reason:
            tamper === "missing-target"
              ? "target-missing"
              : tamper === "linked-target"
                ? "competing-writer"
                : "foreign-artifact",
        });
        expect(yield* listing(target.root)).toEqual(before);
        expect(yield* fs.readFileString(outside)).toBe(intended);
        expect(yield* listing(target.backups)).toEqual([`${journal.id}.backup`, `${journal.id}.json`]);
      })
    );
  }

  it.effect("restores through the resolved path of a symlinked backup directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* fixture("recovery-linked-backups-");
      const real = path.join(target.root, "real-backups");
      yield* fs.makeDirectory(real);
      yield* fs.symlink(real, target.backups);
      const writer = yield* writerWith(yield* interfering(target.file, "refuse"));
      yield* Effect.flip(writer.apply(target.file, [request], "write", target.backups));
      const journal = yield* abandon(target.backups);
      const restoring = yield* writerWith();
      yield* restoring.restore(path.join(real, `${journal.id}.json`), real);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
      expect(yield* listing(real)).toEqual([`${journal.id}.json`]);
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml", "real-backups"]);
    })
  );

  it.effect("skips undecodable and misnamed journals in a sweep", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* interrupted("recovery-misnamed-", "refuse");
      const { file, journal } = yield* onlyJournal(target.backups);
      yield* abandon(target.backups);
      yield* fs.rename(file, path.join(target.backups, "renamed.json"));
      yield* fs.writeFileString(path.join(target.backups, "garbage.json"), "{");
      const writer = yield* writerWith();
      expect(yield* writer.recover(target.backups)).toEqual([]);
      expect(yield* writer.recover(path.join(target.root, "absent"))).toEqual([]);
      expect(trackedOf(journal.publication).state._tag).toBe("staged");
    })
  );

  it.effect("preserves a foreign backup named by an abandoned journal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* interrupted("recovery-abandoned-foreign-", "refuse");
      const victim = path.join(target.root, "unrelated.txt");
      yield* fs.writeFileString(victim, "unrelated recovery data");
      yield* abandon(target.backups, (publication) =>
        ModelsTrackedPublication.make({
          ...publication,
          backup: O.some(victim),
          state: { _tag: "abandoned", from: "backed-up", detail: "synthetic interrupted writer" },
        })
      );
      const writer = yield* writerWith();
      const reports = yield* writer.recover(target.backups);
      expect(A.map(reports, (report) => report.result)).toEqual([
        expect.objectContaining({ _tag: "refused", reason: "foreign-artifact" }),
      ]);
      expect(yield* fs.readFileString(victim)).toBe("unrelated recovery data");
    })
  );

  it.effect("abandons a publication that failed before its exchange and drops its backup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* fixture("recovery-abandoned-");
      // A native writer replaces the target between planning and the drift check.
      const drifting = FileSystem.FileSystem.of({
        ...fs,
        chmod: Effect.fn("ModelsRecoveryTest.chmod")(function* (file, mode) {
          yield* fs.chmod(file, mode);
          if (Str.endsWith(".tmp")(file)) {
            yield* fs.writeFileString(path.join(target.root, "competitor"), competitor);
            yield* fs.rename(path.join(target.root, "competitor"), target.file);
          }
        }),
      });
      const writer = yield* writerWithFs(drifting);
      const refusal = yield* Effect.flip(writer.apply(target.file, [request], "write", target.backups));
      expect(refusal.message).toContain("Native file drifted after planning");
      const { journal } = yield* onlyJournal(target.backups);
      expect(trackedOf(journal.publication).state).toMatchObject({ _tag: "abandoned", from: "backed-up" });
      expect(yield* listing(target.backups)).toEqual([`${journal.id}.json`]);
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
      expect(yield* fs.readFileString(target.file)).toBe(competitor);
      // The writer never touched the target, so nothing is refused afterwards.
      const plain = yield* writerWith();
      expect(yield* plain.recover(target.backups)).toEqual([]);
      const next = yield* plain.apply(target.file, [request], "write", target.backups);
      next.pipe(O.isSome, assertTrue);
      expect(yield* fs.readFileString(target.file)).toBe(Str.replace('"competitor"', '"gpt-6.1-sol"')(competitor));
      expect(yield* listing(target.root)).toEqual(["backups", "config.toml"]);
    })
  );

  it.effect("lets exactly one of two concurrent recoverers reconcile a journal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const base = yield* ModelsAtomicExchange;
      const target = yield* interrupted("recovery-concurrent-", "displace-then-fail");
      const journal = yield* abandon(target.backups);
      const journalFile = `${target.backups}/${journal.id}.json`;
      const firstRead = yield* Deferred.make<void>();
      const secondRead = yield* Deferred.make<void>();
      const firstAtExchange = yield* Deferred.make<void>();
      const secondDone = yield* Deferred.make<void>();
      let exchanges = 0;
      // Both recoverers read the abandoned journal before either records
      // `recovering`; the first then waits at its exchange until the second ends.
      const reading = (read: Deferred.Deferred<void>, wait: Deferred.Deferred<void>) =>
        FileSystem.FileSystem.of({
          ...fs,
          readFileString: Effect.fn("ModelsRecoveryTest.readFileString")(function* (file, options) {
            const text = yield* fs.readFileString(file, options);
            if (file === journalFile) {
              yield* Deferred.succeed(read, undefined);
              yield* Deferred.await(wait);
            }
            return text;
          }),
        });
      const counting = (before: Effect.Effect<void>) =>
        ModelsAtomicExchange.of({
          qualify: base.qualify,
          exchange: Effect.fn("ModelsRecoveryTest.countedExchange")(function* (left, right) {
            if (left === target.file || right === target.file) {
              yield* before;
              exchanges += 1;
            }
            yield* base.exchange(left, right);
          }),
        });
      const first = yield* writerWithFs(
        reading(firstRead, secondRead),
        counting(Deferred.succeed(firstAtExchange, undefined).pipe(Effect.andThen(Deferred.await(secondDone))))
      );
      const second = yield* writerWithFs(reading(secondRead, firstAtExchange), counting(Effect.void));
      const [firstReports, secondReports] = yield* Effect.all(
        [
          first.recover(target.backups),
          second.recover(target.backups).pipe(Effect.ensuring(Deferred.succeed(secondDone, undefined))),
        ],
        { concurrency: "unbounded" }
      );
      expect(exchanges).toBe(1);
      expect(yield* fs.readFileString(target.file)).toBe(competitor);
      expect(yield* fileSha(trackedOf(journal.publication).staging)).toBe(yield* textSha(intended));
      expect(firstReports[0]?.result).toMatchObject({ _tag: "refused", reason: "competing-writer" });
      expect(secondReports).toEqual([
        ModelsRecoveryReport.make({
          journal: journal.id,
          role: "publication",
          result: ModelsRecoveryResult.cases.skipped.make({ reason: "lock-held" }),
        }),
      ]);
      expect(A.filter(yield* listing(target.backups), Str.endsWith(".recovering"))).toEqual([]);
    })
  );

  it.effect("reclaims a stale recovery lock and refuses past a live one", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* interrupted("recovery-lock-", "refuse");
      const journal = yield* abandon(target.backups);
      const lock = path.join(target.backups, `${journal.id}.recovering`);
      const writer = yield* writerWith();
      // A live owner (this process) holds the lock: recovery and restore stand back.
      const live = yield* fs.readFileString("/proc/self/stat");
      const boot = Str.trim(yield* fs.readFileString("/proc/sys/kernel/random/boot_id"));
      const fields = Str.split(
        Str.trim(Str.slice(O.getOrElse(Str.lastIndexOf(")")(live), constant(-1)) + 1)(live)),
        " "
      );
      const self = ModelsPublicationOwner.make({
        bootId: boot,
        pid: Number.parseInt(live, 10),
        startTicks: fields[19] ?? "",
      });
      yield* fs.writeFileString(lock, yield* encodeOwner(self));
      expect(yield* writer.recover(target.backups)).toEqual([
        ModelsRecoveryReport.make({
          journal: journal.id,
          role: "publication",
          result: ModelsRecoveryResult.cases.skipped.make({ reason: "lock-held" }),
        }),
      ]);
      const refusal = yield* Effect.flip(
        writer.restore(path.join(target.backups, `${journal.id}.json`), target.backups)
      );
      expect(refusal.reason).toBe("lock-held");
      expect(yield* fs.readFileString(lock)).toBe(yield* encodeOwner(self));
      // A dead owner's lock is stale and reclaimed.
      yield* fs.writeFileString(lock, yield* encodeOwner(deadOwner));
      expect(yield* writer.recover(target.backups)).toEqual([recovered(journal.id, "preimage")]);
      expect(yield* listing(target.backups)).toEqual([`${journal.id}.json`]);
      expect(yield* fileSha(target.file)).toBe(yield* textSha(native));
    })
  );

  it.effect("never reclaims a recent lock whose stamp is empty or partial", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* interrupted("recovery-partial-lock-", "refuse");
      const journal = yield* abandon(target.backups);
      const lock = path.join(target.backups, `${journal.id}.recovering`);
      const writer = yield* writerWith();
      const held = ModelsRecoveryReport.make({
        journal: journal.id,
        role: "publication",
        result: ModelsRecoveryResult.cases.skipped.make({ reason: "lock-held" }),
      });
      // A live recoverer caught between creating its lock and stamping it.
      for (const stamp of ["", '{"bootId":"']) {
        yield* fs.writeFileString(lock, stamp);
        expect(yield* writer.recover(target.backups)).toEqual([held]);
        expect(yield* fs.readFileString(lock)).toBe(stamp);
        expect(A.filter(yield* listing(target.backups), Str.includes(".recovering."))).toEqual([]);
      }
      // Past the grace period an unreadable stamp is stale and reclaimed.
      yield* fs.utimes(lock, 0, 0);
      expect(yield* writer.recover(target.backups)).toEqual([recovered(journal.id, "preimage")]);
      expect(yield* listing(target.backups)).toEqual([`${journal.id}.json`]);
    })
  );

  it.effect("fails recovery with a typed error when the lock cannot be created", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "recovery-lock-denied-" });
      const backups = path.join(home, ".config-backups");
      const file = path.join(home, "config.toml");
      yield* fs.writeFileString(file, native);
      const writer = yield* writerWith(yield* interfering(file, "refuse"));
      yield* Effect.flip(writer.apply(file, [request], "write", backups));
      const journal = yield* abandon(backups);
      const denied = (method: string, target: string) =>
        PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method, pathOrDescriptor: target });
      // EACCES on the lock itself, wherever the writer creates it.
      const denying = FileSystem.FileSystem.of({
        ...fs,
        open: Effect.fn("ModelsRecoveryTest.deniedOpen")(function* (target, options) {
          if (Str.endsWith(".recovering")(target)) return yield* denied("open", target);
          return yield* fs.open(target, options);
        }),
        link: Effect.fn("ModelsRecoveryTest.deniedLink")(function* (source, target) {
          if (Str.endsWith(".recovering")(target)) return yield* denied("link", target);
          yield* fs.link(source, target);
        }),
      });
      const refusal = yield* Effect.flip((yield* writerWithFs(denying)).recover(backups));
      expect(refusal._tag).toBe("ModelsLocatorError");
      expect(refusal.reason).toBe("lock-unavailable");
      const before = A.length(yield* TestConsole.logLines);
      yield* Effect.flip(
        run(["recover", "--home", home, "--repo", home]).pipe(Effect.provideService(FileSystem.FileSystem, denying))
      );
      expect(A.some(A.drop(yield* TestConsole.logLines, before), (line) => Str.includes("lock-held")(`${line}`))).toBe(
        false
      );
      expect(yield* listing(backups)).toEqual([`${journal.id}.backup`, `${journal.id}.json`]);
      expect(trackedOf((yield* onlyJournal(backups)).journal.publication).state._tag).toBe("staged");
    })
  );

  it.effect("models recover reports reconciled publications and fails on a refusal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "recovery-command-" });
      const backups = path.join(home, ".config-backups");
      const flags = ["--home", home, "--repo", home];
      yield* run(["recover", ...flags]);
      expect(yield* TestConsole.logLines).toContain(
        "models: recover reconciled 0 publication(s); 0 legacy journal(s) left for restore --journal"
      );
      const file = path.join(home, "config.toml");
      yield* fs.writeFileString(file, native);
      const writer = yield* writerWith(yield* interfering(file, "refuse"));
      yield* Effect.flip(writer.apply(file, [request], "write", backups));
      const journal = yield* abandon(backups);
      yield* run(["recover", ...flags]);
      expect(yield* TestConsole.logLines).toContain(`models: recovered ${journal.id} (publication) to preimage`);
      expect(yield* fileSha(file)).toBe(yield* textSha(native));
      const displacing = yield* writerWith(yield* interfering(file, "displace-then-fail"));
      yield* Effect.flip(displacing.apply(file, [request], "write", backups));
      yield* fs.makeDirectory(path.join(home, "settled"));
      yield* fs.rename(path.join(backups, `${journal.id}.json`), path.join(home, "settled", `${journal.id}.json`));
      const second = yield* abandon(backups);
      yield* Effect.flip(run(["recover", ...flags]));
      expect(
        A.some(yield* TestConsole.logLines, (line) =>
          Str.startsWith(`models: refused recovery ${second.id} (publication): competing-writer:`)(`${line}`)
        )
      ).toBe(true);
    })
  );
});
