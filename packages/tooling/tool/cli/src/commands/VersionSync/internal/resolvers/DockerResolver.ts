/**
 * Docker image version resolver.
 *
 * Parses `docker-compose.yml` for `image:` fields and optionally resolves
 * latest tags from Docker Hub.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeYamlTextAs } from "@beep/schema/Yaml";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, identity, Match, Number as N, Order, Path, SchemaTransformation } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import {
  NetworkUnavailableError,
  VersionCategoryReport,
  VersionCategoryStatusThunk,
  VersionDriftItem,
  VersionSyncError,
} from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/DockerResolver");
const STABLE_DOCKER_TAG_PATTERN = /^(?!latest$)(?!.*(?:rc|beta|alpha|nightly|dev|snapshot)).+$/i;

// ── Docker Hub API ──────────────────────────────────────────────────────────

/**
 * @category validation
 * @since 0.0.0
 */
class DockerTagResult extends S.Class<DockerTagResult>($I`DockerTagResult`)(
  {
    name: S.String,
  },
  $I.annote("DockerTagResult", {
    description: "Docker image tag result schema",
  })
) {}

/**
 * @category validation
 * @since 0.0.0
 */
class DockerTagsResponse extends S.Class<DockerTagsResponse>($I`DockerTagsResponse`)(
  {
    results: S.Array(DockerTagResult),
  },
  $I.annote("DockerTagsResponse", {
    description: "Docker image tags response schema",
  })
) {}

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A Docker image reference parsed from docker-compose.yml.
 *
 * @category models
 * @since 0.0.0
 */
class DockerImageRef extends S.Class<DockerImageRef>($I`DockerImageRef`)(
  {
    service: S.String,
    fullImage: S.String,
    registry: S.String,
    repository: S.String,
    tag: S.String,
    yamlPath: S.Array(S.Union([S.String, S.Finite])),
  },
  $I.annote("DockerImageRef", {
    description: "Docker image reference parsed from docker-compose.yml",
  })
) {}

class DockerImageElement extends DockerImageRef.extend<DockerImageElement>($I`DockerImageElement`)(
  {
    latest: S.Option(S.String),
  },
  $I.annote("DockerImageElement", {
    description: "Docker image reference with latest tag information",
  })
) {}

class DockerComposeService extends S.Class<DockerComposeService>($I`DockerComposeService`)(
  {
    image: S.optionalKey(S.Unknown),
  },
  $I.annote("DockerComposeService", {
    description: "Subset of docker-compose service fields required for image version resolution.",
  })
) {}

class DockerComposeDocument extends S.Class<DockerComposeDocument>($I`DockerComposeDocument`)(
  {
    services: S.Record(S.String, DockerComposeService).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, DockerComposeService>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, DockerComposeService>()))
    ),
  },
  $I.annote("DockerComposeDocument", {
    description: "Subset of docker-compose fields required for image version resolution.",
  })
) {}
/**
 * Resolved Docker image state.
 *
 * @category models
 * @since 0.0.0
 */
export class DockerImageState extends S.Class<DockerImageState>($I`DockerImageState`)(
  {
    images: S.Array(DockerImageElement).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<DockerImageElement>())),
      S.withDecodingDefault(Effect.succeed(A.empty<DockerImageElement>()))
    ),
  },
  $I.annote("DockerImageState", {
    description: "Resolved Docker image state",
  })
) {}

const StableDockerTag = S.String.check(S.isPattern(STABLE_DOCKER_TAG_PATTERN)).pipe(
  S.brand("StableDockerTag"),
  $I.annoteSchema("StableDockerTag", {
    description: "Docker tag that is pinned and excludes known unstable/pre-release markers.",
  })
);
const isStableTag = S.is(StableDockerTag);

const MajorOnlyDockerTag = S.String.check(S.isPattern(/^\d+$/)).pipe(
  S.brand("MajorOnlyDockerTag"),
  $I.annoteSchema("MajorOnlyDockerTag", {
    description: "Pinned Docker tag containing only a major version number.",
  })
);
const isMajorOnlyDockerTag = S.is(MajorOnlyDockerTag);

const LatestDockerTag = S.Literal("latest").pipe(
  $I.annoteSchema("LatestDockerTag", {
    description: "Unpinned floating Docker tag.",
  })
);
const isLatestDockerTag = S.is(LatestDockerTag);

const UnknownDockerImageValueToString = S.Unknown.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value) => `${value}`,
      encode: identity,
    })
  ),
  $I.annoteSchema("UnknownDockerImageValueToString", {
    description: "Schema transformation that normalizes docker image field values to strings.",
  })
);
const decodeDockerImageValueToString = S.decodeUnknownOption(UnknownDockerImageValueToString);
const dockerImageValueToString = (value: unknown): string =>
  O.getOrElse(decodeDockerImageValueToString(value), () => `${value}`);

// ── Semver-like sorting ─────────────────────────────────────────────────────

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

const parseSemverPart = N.parse;

const parseSemver = (tag: string): O.Option<readonly [number, number, number]> =>
  O.flatMap(Str.match(SEMVER_PATTERN)(tag), (match) =>
    O.flatMap(parseSemverPart(match[1]), (major) =>
      O.flatMap(parseSemverPart(match[2]), (minor) =>
        O.map(parseSemverPart(match[3]), (patch) => [major, minor, patch] as const)
      )
    )
  );

const semverCompare = (a: readonly [number, number, number], b: readonly [number, number, number]): number => {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
};

const toOrdering = (n: number): -1 | 0 | 1 =>
  Match.value(n).pipe(
    Match.when(
      (value) => value < 0,
      () => -1 as const
    ),
    Match.when(
      (value) => value > 0,
      () => 1 as const
    ),
    Match.orElse(() => 0 as const)
  );

// ── Helpers ─────────────────────────────────────────────────────────────────

const parseImageRef = (service: string, image: string, yamlPath: ReadonlyArray<string | number>): DockerImageRef => {
  const colonIdx = O.getOrElse(Str.lastIndexOf(":")(image), () => -1);
  const slashIdx = O.getOrElse(Str.indexOf("/")(image), () => -1);

  let repository: string;
  let tag: string;

  if (colonIdx > 0 && (slashIdx < 0 || colonIdx > slashIdx)) {
    repository = Str.substring(0, colonIdx)(image);
    tag = Str.substring(colonIdx + 1)(image);
  } else {
    repository = image;
    tag = "latest";
  }

  // Detect official images (no slash) vs namespaced
  const registry = slashIdx < 0 ? "library" : "";

  return DockerImageRef.make({ service, fullImage: image, registry, repository, tag, yamlPath });
};

const dockerHubTagsUrl = (repository: string): string => {
  const hasNamespace = Str.includes("/")(repository);
  const repo = hasNamespace ? repository : `library/${repository}`;
  return `https://hub.docker.com/v2/repositories/${repo}/tags/?page_size=100&ordering=last_updated`;
};

// ── Tag resolution strategies ───────────────────────────────────────────────

const findLatestForRedis = (tags: ReadonlyArray<string>): O.Option<string> => {
  // Find latest semver tag without alpine/bookworm/etc suffixes
  let best: O.Option<readonly [number, number, number]> = O.none();
  let bestTag = "";

  for (const tag of tags) {
    if (!isStableTag(tag)) continue;
    // Pure semver tags only (no suffix)
    const sv = parseSemver(tag);
    if (O.isSome(sv)) {
      if (O.isNone(best) || semverCompare(sv.value, best.value) > 0) {
        best = sv;
        bestTag = tag;
      }
    }
  }

  return Str.equivalence(bestTag, Str.empty) ? O.none() : O.some(bestTag);
};

const VERSION_PATTERN = /v?(\d+)\.(\d+)\.(\d+)/;

const findLatestForPgvector = (tags: ReadonlyArray<string>, currentTag: string): O.Option<string> => {
  // Current tag is like "pg17" — find latest "pg17-v*" or similar
  const prefix = O.getOrElse(
    O.flatMap(Str.match(/^(pg\d+)/)(currentTag), (match) => O.fromUndefinedOr(match[1])),
    () => currentTag
  );

  let candidates = A.empty<{ tag: string; version: readonly [number, number, number] }>();

  for (const tag of tags) {
    if (!Str.startsWith(prefix)(tag)) continue;
    if (!isStableTag(tag)) continue;
    // Pattern: pg17-v0.8.0 or similar with version suffix
    const version = O.flatMap(Str.match(VERSION_PATTERN)(tag), (versionMatch) =>
      O.flatMap(parseSemverPart(versionMatch[1]), (major) =>
        O.flatMap(parseSemverPart(versionMatch[2]), (minor) =>
          O.map(parseSemverPart(versionMatch[3]), (patch) => [major, minor, patch] as const)
        )
      )
    );
    if (O.isSome(version)) {
      candidates = A.append(candidates, {
        tag,
        version: version.value,
      });
    }
  }

  if (A.isArrayEmpty(candidates)) return O.none();

  type Candidate = { tag: string; version: readonly [number, number, number] };
  const sorted = A.sort(
    candidates,
    Order.make<Candidate>((a, b) => toOrdering(semverCompare(b.version, a.version)))
  );
  return O.map(A.get(sorted, 0), (c) => c.tag);
};

const findLatestSemver = (tags: ReadonlyArray<string>): O.Option<string> => {
  let best: O.Option<readonly [number, number, number]> = O.none();
  let bestTag = "";

  for (const tag of tags) {
    if (!isStableTag(tag)) continue;
    const sv = parseSemver(tag);
    if (O.isSome(sv)) {
      if (O.isNone(best) || semverCompare(sv.value, best.value) > 0) {
        best = sv;
        bestTag = tag;
      }
    }
  }

  return Str.equivalence(bestTag, Str.empty) ? O.none() : O.some(bestTag);
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve Docker image state from docker-compose.yml.
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveDockerImages: {
  (
    repoRoot: string,
    skipNetwork: boolean
  ): Effect.Effect<DockerImageState, VersionSyncError, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient>;
  (
    skipNetwork: boolean
  ): (
    repoRoot: string
  ) => Effect.Effect<DockerImageState, VersionSyncError, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient>;
} = dual(
  2,
  Effect.fn(function* (repoRoot: string, skipNetwork: boolean) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const composePath = path.join(repoRoot, "docker-compose.yml");
    const composeExists = yield* fs.exists(composePath).pipe(Effect.orElseSucceed(thunkFalse));

    if (!composeExists) {
      return DockerImageState.make({});
    }

    const content = yield* fs
      .readFileString(composePath)
      .pipe(VersionSyncError.mapError("Failed to read docker-compose.yml", "docker-compose.yml"));

    const composeDocument = yield* decodeYamlTextAs(DockerComposeDocument)(content).pipe(
      VersionSyncError.mapError("Failed to parse docker-compose.yml", "docker-compose.yml")
    );

    let images = A.empty<DockerImageElement>();

    for (const serviceName of R.keys(composeDocument.services)) {
      const service = composeDocument.services[serviceName];
      if (service.image === undefined) {
        continue;
      }

      const imageStr = dockerImageValueToString(service.image);
      const yamlPath = ["services", serviceName, "image"] as const;
      const ref = parseImageRef(serviceName, imageStr, yamlPath);

      if (skipNetwork) {
        images = A.append(images, DockerImageElement.make({ ...ref, latest: O.none() }));
        continue;
      }

      // Fetch latest tag from Docker Hub
      const latest = yield* fetchLatestDockerTag(ref).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));

      images = A.append(images, DockerImageElement.make({ ...ref, latest }));
    }

    return DockerImageState.make({ images });
  })
);

/**
 * Fetch the latest appropriate tag for a Docker image from Docker Hub.
 *
 * @category utilities
 * @since 0.0.0
 */
const fetchLatestDockerTag: (
  ref: DockerImageRef
) => Effect.Effect<string, NetworkUnavailableError, HttpClient.HttpClient> = Effect.fn(function* (ref) {
  const client = yield* HttpClient.HttpClient;
  const url = dockerHubTagsUrl(ref.repository);

  const response = yield* client
    .get(url, { headers: { "User-Agent": "beep-cli/0.0.0" } })
    .pipe(NetworkUnavailableError.mapError(`Docker Hub API request failed for ${ref.repository}`));

  const body = yield* HttpClientResponse.schemaBodyJson(DockerTagsResponse)(response).pipe(
    NetworkUnavailableError.mapError(`Failed to parse Docker Hub response for ${ref.repository}`)
  );

  const tagNames = A.map(body.results, (r) => r.name);

  // Strategy depends on image
  const repoLower = Str.toLowerCase(ref.repository);
  const result: O.Option<string> = Match.value(repoLower).pipe(
    Match.when("redis", () => findLatestForRedis(tagNames)),
    Match.when("library/redis", () => findLatestForRedis(tagNames)),
    Match.when(Str.includes("pgvector"), () => findLatestForPgvector(tagNames, ref.tag)),
    Match.orElse(() => findLatestSemver(tagNames))
  );

  if (O.isNone(result)) {
    return yield* NetworkUnavailableError.new(`No suitable tag found for ${ref.repository}`);
  }

  return result.value;
});

/**
 * Build the Docker category report from resolved state.
 *
 * @param state - The resolved Docker image state.
 * @returns The version category report for Docker images.
 * @category utilities
 * @since 0.0.0
 */
export const buildDockerReport: (state: DockerImageState) => VersionCategoryReport = (state) => {
  let items = A.empty<VersionDriftItem>();
  let hasUnpinned = false;

  for (const img of state.images) {
    const isUnpinnedTag = isLatestDockerTag(img.tag);
    const isMajorOnly = isMajorOnlyDockerTag(img.tag);

    if (isUnpinnedTag) {
      hasUnpinned = true;
    }

    if (O.isSome(img.latest) && !Str.equivalence(img.tag, img.latest.value)) {
      items = A.append(
        items,
        VersionDriftItem.make({
          file: "docker-compose.yml",
          field: `image (${img.service})`,
          current: img.fullImage,
          expected: `${img.repository}:${img.latest.value}`,
          line: O.none(),
        })
      );
    } else if (isUnpinnedTag && O.isNone(img.latest)) {
      // Tag is "latest" but we couldn't resolve — still report as unpinned
      items = A.append(
        items,
        VersionDriftItem.make({
          file: "docker-compose.yml",
          field: `image (${img.service})`,
          current: img.fullImage,
          expected: `${img.repository}:<pin to specific version>`,
          line: O.none(),
        })
      );
    } else if (isMajorOnly && O.isNone(img.latest)) {
      items = A.append(
        items,
        VersionDriftItem.make({
          file: "docker-compose.yml",
          field: `image (${img.service})`,
          current: img.fullImage,
          expected: `${img.repository}:<pin to specific tag>`,
          line: O.none(),
        })
      );
    }
  }

  return VersionCategoryReport.cases.docker.make({
    status: A.match(items, {
      onEmpty: VersionCategoryStatusThunk.ok,
      onNonEmpty: () =>
        Bool.match(hasUnpinned, {
          onTrue: VersionCategoryStatusThunk.unpinned,
          onFalse: VersionCategoryStatusThunk.drift,
        }),
    }),
    items,
    latest: O.none(),
    error: O.none(),
  });
};
