import { LibrarySource } from "@beep/repo-cli/commands/Research";
import { acquireLibraryPaper } from "@beep/repo-cli/test/ResearchLibrary";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";

const source = LibrarySource.make({
  id: "bounded-paper",
  kind: "paper",
  canonicalUrl: "https://publisher.example/paper",
  identity: "https://publisher.example/paper",
  revision: "",
  repository: "",
  ownership: "external",
  locators: [],
});
const bytes = (text: string) => new TextEncoder().encode(text);
const runBody = Effect.fn("test.paper.runBody")(function* (
  chunks: ReadonlyArray<Uint8Array>,
  headers: Record<string, string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "paper-body-bound-" });
  let pulls = 0;
  let cancellations = 0;
  let extractors = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = A.get(chunks, pulls);
        pulls++;
        if (chunk._tag === "Some") controller.enqueue(chunk.value);
        else controller.close();
      },
      cancel() {
        cancellations++;
      },
    },
    { highWaterMark: 0 }
  );
  const client = HttpClient.make((request) => {
    expect(request.url).toBe(source.canonicalUrl);
    return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(body, { status: 200, headers })));
  });
  const spawner = ChildProcessSpawner.make((command) =>
    Effect.gen(function* () {
      if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("Unexpected piped extractor fixture");
      expect(command.command).toBe("pdftotext");
      expect(command.args).toEqual(["-enc", "UTF-8", path.join(root, "capture/source.pdf"), "-"]);
      const retained = yield* fs.readFile(path.join(root, "capture/source.pdf"));
      expect(new TextDecoder().decode(retained.subarray(0, 5))).toBe("%PDF-");
      extractors++;
      const text = bytes("Full fixture paper content.");
      return ChildProcessSpawner.makeHandle({
        all: Stream.make(text),
        stdout: Stream.make(text),
        stderr: Stream.empty,
        stdin: Sink.drain,
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        pid: ChildProcessSpawner.ProcessId(1),
        unref: Effect.succeed(Effect.void),
      });
    })
  );
  const result = yield* acquireLibraryPaper(root, source, "capture").pipe(
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
  );
  return { result, pulls, cancellations, extractors, root, fs, path };
});
it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "bounded paper HTTP bodies",
  (it) => {
    const declaredCases: ReadonlyArray<readonly [string, string, string]> = [
      ["HTML-labelled response", "text/html", "50000001"],
      ["PDF", "application/pdf", "50000001"],
    ];
    for (const [label, contentType, contentLength] of declaredCases) {
      it.effect(`rejects declared oversized ${label} without reading the body and releases it`, () =>
        Effect.gen(function* () {
          const actual = yield* runBody([bytes("must not be read")], {
            "content-type": contentType,
            "content-length": contentLength,
          });
          expect(actual.result.status).toBe("blocked");
          expect(actual.result.complete).toBe(false);
          expect(actual.result.reason).toContain("declared");
          expect(actual.pulls).toBe(0);
          expect(actual.cancellations).toBe(1);
          expect(actual.extractors).toBe(0);
        })
      );
    }
    for (const contentLength of ["", "1", "not-a-number", "9000000"]) {
      it.effect(`stops chunked landing overflow with ${contentLength || "absent"} content length`, () =>
        Effect.gen(function* () {
          const headers: Record<string, string> =
            contentLength === ""
              ? { "content-type": "text/html" }
              : { "content-type": "text/html", "content-length": contentLength };
          const actual = yield* runBody(
            A.map(A.range(1, 9), () => new Uint8Array(1_000_000)),
            headers
          );
          expect(actual.result.status).toBe("blocked");
          expect(actual.result.complete).toBe(false);
          expect(actual.result.reason).toContain("5000000-byte observed stream limit");
          expect(actual.pulls).toBe(6);
          expect(actual.cancellations).toBe(1);
          expect(actual.extractors).toBe(0);
        })
      );
    }
    it.effect("enforces PDF stream limit despite an understated header and cancels before later chunks", () =>
      Effect.gen(function* () {
        const chunk = new Uint8Array(1_000_000);
        chunk.set(bytes("%PDF-"));
        const actual = yield* runBody(
          A.map(A.range(1, 54), () => chunk),
          { "content-type": "application/pdf", "content-length": "1" }
        );
        expect(actual.result.status).toBe("blocked");
        expect(actual.result.complete).toBe(false);
        expect(actual.result.reason).toContain("50000000-byte observed stream limit");
        expect(actual.pulls).toBe(51);
        expect(actual.cancellations).toBe(1);
        expect(actual.extractors).toBe(0);
      })
    );
    it.effect("sniffs split PDF signature on a landing locator without trusting absent MIME", () =>
      Effect.gen(function* () {
        const actual = yield* runBody([bytes("%P"), bytes("DF-"), new Uint8Array(6_000_000)], {
          "content-length": "6000005",
        });
        expect(actual.result.status).toBe("readable");
        expect(actual.result.complete).toBe(true);
        expect(actual.extractors).toBe(1);
        const artifact = A.findFirst(actual.result.artifacts, (value) => value.role === "raw-full-text");
        expect(artifact._tag).toBe("Some");
        if (artifact._tag !== "Some") return;
        expect(artifact.value.bytes).toBe(6_000_005);
        expect(yield* actual.fs.readFileString(actual.path.join(actual.root, "capture/source.txt"))).toBe(
          "Full fixture paper content."
        );
      })
    );
    for (const contentLength of ["", "6000005"]) {
      it.effect(`accepts an HTML-labelled PDF with ${contentLength || "absent"} content length`, () =>
        Effect.gen(function* () {
          const headers: Record<string, string> =
            contentLength === ""
              ? { "content-type": "text/html" }
              : { "content-type": "text/html", "content-length": contentLength };
          const actual = yield* runBody([bytes("%PDF-"), new Uint8Array(6_000_000)], headers);
          expect(actual.result.status).toBe("readable");
          expect(actual.result.complete).toBe(true);
          expect(actual.extractors).toBe(1);
          const retained = yield* actual.fs.readFile(actual.path.join(actual.root, "capture/source.pdf"));
          expect(retained.byteLength).toBe(6_000_005);
          expect(new TextDecoder().decode(retained.subarray(0, 5))).toBe("%PDF-");
        })
      );
    }
    it.effect("retains valid bounded PDF bytes and extracted text with a misleading small length", () =>
      Effect.gen(function* () {
        const pdf = bytes("%PDF-1.4\nfixture paper");
        const actual = yield* runBody([pdf], { "content-type": "application/pdf", "content-length": "1" });
        expect(actual.result.status).toBe("readable");
        expect(actual.result.complete).toBe(true);
        expect(actual.extractors).toBe(1);
        expect(A.fromIterable(yield* actual.fs.readFile(actual.path.join(actual.root, "capture/source.pdf")))).toEqual(
          A.fromIterable(pdf)
        );
      })
    );
  }
);
