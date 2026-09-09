// Bind reviewed source snapshots to a freshly generated executable census.
// This recipe does not execute any planned command or grant runtime authority.
import {
  CacheCensusReport,
  CacheEntrypointArtifactReference,
  CacheEntrypointReviewRequest,
} from "@beep/repo-cli/commands/Cache";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { NodeCrypto } from "@effect/platform-node";
import { Console, Effect, Order } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const packet = "goals/turborepo-task-qualification/research";
const suffix = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(Bun.argv[3] ?? "current")
);
const output = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(Bun.argv[4] ?? "entrypoint-review-request.json")
);
const commandGroupsName = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(Bun.argv[6] ?? `command-groups-${suffix}.json`)
);
const reviewNames = Bun.argv[5]
  ? [await Effect.runPromise(S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(Bun.argv[5]))]
  : [
      "command-decomposition.md",
      "dynamic-entrypoints.md",
      "quality-yeet-entrypoints.md",
      "workflow-boundaries.md",
      "entrypoint-census-integration.md",
    ];
const censusPath = await Effect.runPromise(S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(Bun.argv[2]));
const census = await Effect.runPromise(
  S.decodeEffect(S.fromJsonString(CacheCensusReport))(await Bun.file(censusPath).text())
);
const Checkpoint = S.Struct({ sources: S.Array(CacheEvidenceReference) });
const historicalSources = await Promise.all(
  A.map(
    ["dynamic-entrypoints-checkpoint.json", "quality-yeet-checkpoint.json", "workflow-sources-checkpoint.json"],
    async (name) =>
      Effect.runPromise(S.decodeEffect(S.fromJsonString(Checkpoint))(await Bun.file(`${packet}/${name}`).text()))
  )
);
const sourcePaths = A.sort(
  A.dedupe([
    ...A.map(census.sources, (row) => row.path),
    ...A.flatMap(historicalSources, (checkpoint) => A.map(checkpoint.sources, (row) => row.path)),
    `${packet}/refresh-command-groups.py`,
    `${packet}/refresh-entrypoint-review.ts`,
    "packages/tooling/tool/cli/src/commands/Cache/Cache.census.ts",
    "packages/tooling/tool/cli/src/commands/Cache/Cache.command.ts",
    "packages/tooling/tool/cli/src/commands/Cache/Cache.schemas.ts",
    "packages/tooling/tool/cli/src/commands/Cache/Cache.entrypoints.schemas.ts",
    "packages/tooling/tool/cli/src/commands/Cache/Cache.entrypoints.ts",
    "packages/tooling/tool/cli/src/commands/Cache/Cache.evidence.ts",
    "packages/tooling/tool/cli/src/internal/cli/FsGuards.ts",
  ]),
  Order.String
);
const reference = async (path: string) =>
  CacheEvidenceReference.make({
    path,
    sha256: await Effect.runPromise(
      S.decodeEffect(Sha256HexFromBytes)(await Bun.file(path).bytes()).pipe(Effect.provide(NodeCrypto.layer))
    ),
  });
const artifact = async (format: CacheEntrypointArtifactReference["format"], name: string) =>
  CacheEntrypointArtifactReference.make({ format, reference: await reference(`${packet}/${name}`) });
const request = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEntrypointReviewRequest)({
    schemaVersion: "cache-entrypoint-review-request/v1",
    sources: await Promise.all(A.map(sourcePaths, reference)),
    artifacts: await Promise.all([
      artifact("cache-entrypoint-plans/v2", `entrypoint-plans-${suffix}.json`),
      artifact("cache-entrypoint-plans/v2", `entrypoint-plans-hosted-${suffix}.json`),
      artifact("cache-yeet-planner-review/v1", `yeet-plans-${suffix}.json`),
      artifact("cache-yeet-planner-review/v1", `yeet-plans-hosted-${suffix}.json`),
      artifact(
        "cache-workflow-source-snapshot/v1",
        suffix === "current" ? "workflow-sources.json" : `workflow-sources-${suffix}.json`
      ),
      artifact("cache-command-groups/v1", commandGroupsName),
    ]),
    reviews: await Promise.all(A.map(reviewNames, (name) => reference(`${packet}/${name}`))),
    unresolved: [
      "Source planner scenarios do not exhaust dynamic interpreter decisions or prove their runtime outcomes.",
      "Candidate semantic reads, writes, captures and signed/shadow comparisons remain required.",
      "Hosted expanded workflows, remote action sources and required statuses retain their existing proof owners.",
    ],
  })
);
const text = await Effect.runPromise(S.encodeEffect(S.fromJsonString(CacheEntrypointReviewRequest))(request));
await Bun.write(`${packet}/${output}`, `${text}\n`);
await Effect.runPromise(
  Console.log(
    `Bound ${request.sources.length} source files, ${request.artifacts.length} complete snapshots and ${request.reviews.length} reviews.`
  )
);
