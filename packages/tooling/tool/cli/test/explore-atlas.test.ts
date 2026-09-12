import {
  buildExplorationProjection,
  checkExplorationAtlas,
  explorationProjectionDriftPaths,
  writeExplorationAtlas,
} from "@beep/repo-cli/commands/Explore";
import {
  PacketEvent,
  PacketEventStoreLive,
  packetEventDigest,
  packetEventFileName,
  renderPacketEventFile,
} from "@beep/repo-cli/test/Goals";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { describe, expect, it } from "vitest";
import { permutedDirectoryReadsFileSystem } from "./support/CommandTest.ts";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const testLayer = Layer.mergeAll(
  NodeServices.layer,
  PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)),
  TestConsole.layer
);
const PROJECTION_REPEAT_RUNS = 20;

const provideTestLayer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(Layer.build(testLayer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const manifest = (slug: string, title: string, status: string, stage: string) => ({
  schemaVersion: "exploration-manifest/v1",
  exploration: { slug, title, status, stage, updated: "2026-08-27" },
});

const readme = (title: string, stage: string, status: string, statusSuffix = "") => `# ${title}

## Status

Stage: \`${stage}\`
Status: \`${status}\`${statusSuffix}

Status context stays authored.

## Next Open Question

Which question survives projection?

## Trail

- 2026-08-27: authored trail survives projection.
`;

const errorLines = Effect.fnUntraced(function* () {
  return A.filter(yield* TestConsole.errorLines, P.isString);
});

const writePacket = Effect.fnUntraced(function* (root: string, slug: string, document: unknown, readmeContent: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packet = path.join(root, "explorations", slug);
  yield* fs.makeDirectory(path.join(packet, "ops"), { recursive: true });
  yield* fs.writeFileString(path.join(packet, "ops", "manifest.json"), encodeJson(document));
  yield* fs.writeFileString(path.join(packet, "README.md"), readmeContent);
});

const writeStream = Effect.fnUntraced(function* (
  root: string,
  slug: string,
  specs: ReadonlyArray<{ readonly body: PacketEvent["body"]; readonly at: string }>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, "explorations", slug, "ops", "events");
  yield* fs.makeDirectory(directory, { recursive: true });
  let parent = O.none<string>();
  let seq = 0;
  for (const spec of specs) {
    seq += 1;
    const event = PacketEvent.make({
      schemaVersion: "packet-event/v1",
      packet: slug,
      root: "explorations",
      seq,
      ...(O.isSome(parent) ? { parent: parent.value } : {}),
      expectedRevision: seq - 1,
      at: spec.at,
      actor: "test",
      body: spec.body,
    });
    const id = yield* packetEventDigest(event);
    const content = yield* renderPacketEventFile(event);
    yield* fs.writeFileString(path.join(directory, packetEventFileName(event, id)), content);
    parent = O.some(id);
  }
});

describe("exploration projections", () => {
  it("preserves metadata when projected README bytes are already current", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-metadata-" });
          yield* writePacket(
            root,
            "alpha",
            manifest("alpha", "Alpha", "active", "research"),
            readme("Alpha", "research", "active")
          );
          yield* writeExplorationAtlas(root);

          const readmePath = path.join(root, "explorations", "alpha", "README.md");
          yield* fs.chmod(readmePath, 0o744);
          const before = yield* fs.readFileString(readmePath);
          yield* writeExplorationAtlas(root);
          const after = yield* fs.stat(readmePath);

          expect(yield* fs.readFileString(readmePath)).toBe(before);
          expect(after.mode & 0o777).toBe(0o744);
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));

  it("renders adoption-derived D3 state and preserves authored README sections", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-" });
          yield* writePacket(
            root,
            "zeta",
            manifest("zeta", "Zeta", "active", "shape"),
            readme("Zeta", "shape", "active")
          );
          yield* writePacket(
            root,
            "alpha",
            manifest("alpha", "Alpha", "active", "research"),
            readme("Alpha", "research", "active", " — `authored` status detail survives projection.")
          );
          yield* writePacket(
            root,
            "done",
            manifest("done", "Done", "graduated", "graduate"),
            readme("Done", "graduate", "graduated")
          );
          yield* writePacket(
            root,
            "rejected",
            manifest("rejected", "Rejected", "killed", "align"),
            readme("Rejected", "align", "killed")
          );
          yield* fs.makeDirectory(path.join(root, "explorations", "broken"), { recursive: true });
          yield* fs.makeDirectory(path.join(root, "explorations", "_internal"), { recursive: true });

          const projection = yield* buildExplorationProjection(root);
          const repeated = yield* Effect.forEach(
            A.makeBy(PROJECTION_REPEAT_RUNS, (index) => index),
            (index) =>
              buildExplorationProjection(root).pipe(
                Effect.provideService(FileSystem.FileSystem, permutedDirectoryReadsFileSystem(fs, index))
              ),
            { concurrency: 1 }
          );

          expect(projection.atlasContent).toContain("5 exploration packets.");
          expect(projection.atlasContent).toContain("## Active (2)");
          expect(projection.atlasContent).toContain("## Graduated (1)");
          expect(projection.atlasContent).toContain("## Killed (1)");
          expect(projection.atlasContent).toContain("## Underivable packets (1)");
          expect(projection.atlasContent).toContain("manifest-adoption");
          expect(projection.atlasContent.indexOf("[Alpha]")).toBeLessThan(projection.atlasContent.indexOf("[Zeta]"));
          expect(A.every(repeated, (next) => next.atlasContent === projection.atlasContent)).toBe(true);
          expect(
            A.every(
              repeated,
              (next) =>
                A.length(next.readmes) === A.length(projection.readmes) &&
                A.every(
                  A.zip(next.readmes, projection.readmes),
                  ([nextReadme, firstReadme]) =>
                    nextReadme.path === firstReadme.path && nextReadme.projected === firstReadme.projected
                )
            )
          ).toBe(true);
          expect(projection.issues).toHaveLength(1);
          expect(projection.issues[0]?.detail).toContain("manifest is missing or invalid");

          const alpha = A.findFirst(projection.readmes, (item) => item.path.endsWith("/alpha/README.md"));
          expect(O.isSome(alpha)).toBe(true);
          if (O.isSome(alpha)) {
            expect(alpha.value.projected).toContain("<!-- BEGIN GENERATED: EXPLORATION STATUS -->");
            expect(alpha.value.projected).toContain("Which question survives projection?");
            expect(alpha.value.projected).toContain("authored trail survives projection");
            expect(alpha.value.projected).toContain("Status context stays authored.");
            expect(alpha.value.projected).toContain("Status note: `authored` status detail survives projection.");
          }
          expect(explorationProjectionDriftPaths(projection, O.none())).toHaveLength(4);
          expect(
            explorationProjectionDriftPaths(projection, O.some(`${projection.atlasContent}authored doctrine`))
          ).toContain("explorations/ATLAS.md");
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));

  it("uses the event fold after opt-in and exposes furthest versus resume stage", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-stream-" });
          yield* writePacket(
            root,
            "looped",
            manifest("looped", "Looped", "parked", "research"),
            readme("Looped", "research", "parked")
          );
          yield* writeStream(root, "looped", [
            {
              body: { type: "packet-created", status: "active", stage: "shape", ordinal: 3 },
              at: "2026-08-27T00:00:00.000Z",
            },
            { body: { type: "stage-entered", stage: "research", ordinal: 1 }, at: "2026-08-27T00:01:00.000Z" },
            {
              body: { type: "status-set", status: "parked", previous: "active" },
              at: "2026-08-27T00:02:00.000Z",
            },
          ]);

          const projection = yield* buildExplorationProjection(root);

          expect(projection.issues).toEqual([]);
          expect(projection.atlasContent).toContain(
            "| [Looped](./looped/README.md) | research | shape | event-stream | 2026-08-27 |"
          );
          expect(projection.readmes[0]?.projected).toContain("Stage: `research`");
          expect(projection.readmes[0]?.projected).toContain("Status: `parked`");
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));

  it("fails closed instead of falling back when an opted-in stream is underivable", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-invalid-stream-" });
          yield* writePacket(
            root,
            "invalid-stream",
            manifest("invalid-stream", "Invalid stream", "active", "capture"),
            readme("Invalid stream", "capture", "active")
          );
          const events = path.join(root, "explorations", "invalid-stream", "ops", "events");
          yield* fs.makeDirectory(events, { recursive: true });
          yield* fs.writeFileString(path.join(events, "not-a-cas-event.json"), "{}\n");

          const projection = yield* buildExplorationProjection(root);

          expect(projection.atlasContent).toContain("## Underivable packets (1)");
          expect(A.some(projection.issues, (issue) => issue.detail.includes("unreadable or invalid"))).toBe(true);
          expect(projection.atlasContent).not.toContain("manifest-adoption");
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));

  it("rejects malformed generated README markers", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-markers-" });
          yield* writePacket(
            root,
            "malformed",
            manifest("malformed", "Malformed", "active", "capture"),
            `# Malformed

## Status

<!-- END GENERATED: EXPLORATION STATUS -->
Status: \`active\`
<!-- BEGIN GENERATED: EXPLORATION STATUS -->

## Next Open Question

Does this fail closed?
`
          );

          const projection = yield* buildExplorationProjection(root);

          expect(projection.issues[0]?.detail).toContain("malformed generated markers");
          expect(projection.readmes).toEqual([]);
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));

  it("prints every underivable input on stderr before the silent reported exit", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-refusal-" });
          yield* writePacket(
            root,
            "alpha",
            manifest("alpha", "Alpha", "active", "research"),
            readme("Alpha", "research", "active")
          );
          yield* writePacket(
            root,
            "renamed",
            manifest("moved", "Moved", "active", "capture"),
            readme("Moved", "capture", "active")
          );
          const manifestPath = path.join(root, "explorations", "renamed", "ops", "manifest.json");
          const refusal = [
            "[explore:atlas] 1 underivable projection input(s); repair the packet inputs, never explorations/ATLAS.md:",
            `- ${manifestPath}: manifest slug is moved, not directory renamed`,
          ];

          const checkError = yield* checkExplorationAtlas(root).pipe(Effect.flip);
          const writeError = yield* writeExplorationAtlas(root).pipe(Effect.flip);

          const sentinel = {
            _tag: "CliReportedExit",
            exitCode: 1,
            message:
              "explore atlas: 1 underivable projection input(s); repair the packet inputs, never explorations/ATLAS.md.",
          };
          expect(checkError).toMatchObject(sentinel);
          expect(writeError).toMatchObject(sentinel);
          expect(yield* errorLines()).toEqual([...refusal, ...refusal]);
          expect(yield* fs.exists(path.join(root, "explorations", "ATLAS.md"))).toBe(false);
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));

  it("refuses README drift, names the git-ignored Atlas alongside it, and only advises on a stale Atlas", () =>
    Effect.runPromise(
      provideTestLayer(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectory({ prefix: "beep-exploration-atlas-drift-" });
          yield* writePacket(
            root,
            "alpha",
            manifest("alpha", "Alpha", "active", "research"),
            readme("Alpha", "research", "active")
          );
          const readmePath = path.join(root, "explorations", "alpha", "README.md");
          const atlasPath = path.join(root, "explorations", "ATLAS.md");
          const driftHeader =
            "[explore:atlas] 1 generated projection(s) drift; run `bun run beep explore atlas --write`:";

          const authoredReadme = yield* fs.readFileString(readmePath);
          const readmeDrift = yield* checkExplorationAtlas(root).pipe(Effect.flip);
          yield* writeExplorationAtlas(root);
          const staleAtlas = `${yield* fs.readFileString(atlasPath)}authored doctrine\n`;
          yield* fs.writeFileString(atlasPath, staleAtlas);
          // A stale Atlas alone is git-ignored workstation state no hosted lane carries: advisory only.
          yield* checkExplorationAtlas(root);
          expect(yield* fs.readFileString(atlasPath)).toBe(staleAtlas);
          // README drift still refuses, and the stale Atlas is named alongside it.
          yield* fs.writeFileString(readmePath, authoredReadme);
          const bothDrift = yield* checkExplorationAtlas(root).pipe(Effect.flip);
          yield* writeExplorationAtlas(root);
          yield* checkExplorationAtlas(root);

          const sentinel = (count: number) => ({
            _tag: "CliReportedExit",
            exitCode: 1,
            message: `explore atlas: ${count} generated projection(s) drift; run \`bun run beep explore atlas --write\`.`,
          });
          expect(readmeDrift).toMatchObject(sentinel(1));
          expect(bothDrift).toMatchObject(sentinel(2));
          expect(yield* errorLines()).toEqual([
            driftHeader,
            `- ${readmePath}`,
            "[explore:atlas] 2 generated projection(s) drift; run `bun run beep explore atlas --write`:",
            `- ${readmePath}`,
            "- explorations/ATLAS.md",
            "[explore:atlas] explorations/ATLAS.md is a git-ignored local projection: a stale copy fails only local checks, and the rewrite never appears in git diff.",
          ]);
          expect(A.filter(yield* TestConsole.logLines, P.isString)).toEqual([
            "[explore:atlas] advisory: explorations/ATLAS.md is stale (git-ignored local projection); run `bun run beep explore atlas --write`.",
            "[explore:atlas] OK: D3 Atlas and README projections are current.",
          ]);
          yield* fs.remove(root, { recursive: true });
        })
      )
    ));
});
