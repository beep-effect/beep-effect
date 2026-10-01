import { Document } from "@beep/documents-domain/aggregates/Document";
import { DocumentIntakeActionError } from "@beep/documents-use-cases/public";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { createEffectActor, waitFor } from "@xstate/effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import { Reactivity } from "effect/reactivity";
import * as Stream from "effect/Stream";
import { DesktopIntakeClient, workspaceVaultKey } from "@/intake/DesktopIntake.client";
import { batchIdFor } from "@/intake/DocumentIntake.models";
import { intakeBatchMachine } from "@/intake/IntakeBatch.machine";
import { intakeClient, intakeFile, workspaceId } from "./support/IntakeHarness.ts";
import type { IntakeResultEntry } from "@/intake/DocumentIntake.models";

const startBatch = (client: DesktopIntakeClient["Service"], files: ReadonlyArray<File>) =>
  createEffectActor(intakeBatchMachine, {
    input: { intakeBatchId: batchIdFor(files), workspaceId, files },
  }).pipe(Effect.provideService(DesktopIntakeClient, client));

// `join` types its failure as `unknown`; waiting for the final snapshot keeps the error channel typed.
const settled = Effect.fnUntraced(function* (actor: Effect.Success<ReturnType<typeof startBatch>>) {
  const done = yield* waitFor(actor, (snapshot) => snapshot.status === "done");
  if (done.output === undefined) {
    throw new TypeError("a settled batch has an output");
  }
  return done.output;
});

const filedDocument = Effect.map(
  Arbitrary.sampleEffect(Arbitrary.schema(Document), { count: 1, seed: 0 }),
  (samples) => {
    const [document] = samples;
    if (document === undefined) {
      throw new TypeError("the Document schema produced no sample");
    }
    return document;
  }
);

const unreadableFile = (name: string): File => {
  const file = new File(["content"], name);
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: () => Promise.reject(new Error("private read failure /home/operator")),
  });
  return file;
};

describe("intake batch machine", () => {
  it.layer(Reactivity.layer)((it) => {
    it.effect(
      "files each document in order and reports one result per file",
      Effect.fnUntraced(function* () {
        const document = yield* filedDocument;
        const gate = Promise.withResolvers<ArrayBuffer>();
        const first = new File(["content"], "first.txt");
        Object.defineProperty(first, "arrayBuffer", { configurable: true, value: () => gate.promise });
        const files = [first, new File([], "empty.txt"), unreadableFile("unreadable.txt"), intakeFile("rejected.txt")];
        const payloads = yield* Ref.make<ReadonlyArray<unknown>>([]);
        const actor = yield* startBatch(
          intakeClient({
            IntakeDroppedFile: (payload) =>
              Effect.flatMap(Ref.updateAndGet(payloads, A.append(payload)), (seen) =>
                A.length(seen) === 1
                  ? Effect.succeed(document)
                  : Effect.fail(DocumentIntakeActionError.new("Document intake unavailable."))
              ),
          }),
          files
        );
        const emitted = yield* Queue.unbounded<IntakeResultEntry>();
        actor.on("file.result", (event) => Queue.offerUnsafe(emitted, event.entry));
        expect(actor.getSnapshot().matches("reading")).toBe(true);

        gate.resolve(new Uint8Array([1, 2, 3]).buffer);
        const output = yield* settled(actor);

        expect(output.intakeBatchId).toBe(batchIdFor(files));
        expect(A.map(output.entries, (entry) => entry.kind)).toEqual(["document", "failure", "failure", "failure"]);
        expect(
          A.flatMap(output.entries, (entry) =>
            entry.kind === "failure" ? [`${entry.fileName}: ${entry.message}`] : []
          )
        ).toEqual([
          "empty.txt: This file is empty, so there is nothing to file.",
          "unreadable.txt: Intake failed.",
          "rejected.txt: Document intake unavailable.",
        ]);
        expect(yield* Queue.takeN(emitted, 4)).toEqual(output.entries);
        expect(yield* Ref.get(payloads)).toMatchObject([
          { intakeBatchId: batchIdFor(files), originalFileName: "first.txt", workspaceId },
          { intakeBatchId: batchIdFor(files), originalFileName: "rejected.txt", workspaceId },
        ]);
      }, Effect.scoped)
    );

    it.effect(
      "completes at once for a batch without files",
      Effect.fnUntraced(function* () {
        const actor = yield* startBatch(intakeClient({}), []);
        const output = yield* settled(actor);
        expect(output).toEqual({ intakeBatchId: batchIdFor([]), entries: [] });
      }, Effect.scoped)
    );

    it.effect(
      "invalidates the workspace vault configuration after filing a document",
      Effect.fnUntraced(function* () {
        const document = yield* filedDocument;
        const reads = yield* Queue.unbounded<number>();
        const counter = yield* Ref.make(0);
        yield* Effect.forkScoped(
          Reactivity.stream(
            Ref.updateAndGet(counter, (count) => count + 1),
            [workspaceVaultKey(workspaceId)]
          ).pipe(Stream.runForEach((count) => Queue.offer(reads, count)))
        );
        expect(yield* Queue.take(reads)).toBe(1);

        const actor = yield* startBatch(intakeClient({ IntakeDroppedFile: () => Effect.succeed(document) }), [
          intakeFile("filed.txt"),
        ]);
        yield* settled(actor);
        expect(yield* Queue.take(reads)).toBe(2);
      }, Effect.scoped)
    );
  });
});
