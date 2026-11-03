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
import { decodeYamlTextWith } from "@beep/repo-cli-kit/schema/TextCodec";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { SemVer } from "@beep/semver/SemVer";
import { A, Str, thunkFalse } from "@beep/utils";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow, identity } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import {
  NetworkUnavailableError,
  VersionCategoryReport,
  VersionCategoryStatusEnum,
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
class DockerTagResult extends S.Opaque<DockerTagResult, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
  }).pipe(
    $I.annoteSchema("DockerTagResult", {
      description: "Docker image tag result schema",
    })
  )
) {}

/**
 * @category validation
 * @since 0.0.0
 */
class DockerTagsResponse extends S.Opaque<DockerTagsResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    results: S.Array(DockerTagResult),
  }).pipe(
    $I.annoteSchema("DockerTagsResponse", {
      description: "Docker image tags response schema",
    })
  )
) {}

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A Docker image reference parsed from docker-compose.yml.
 *
 * @category models
 * @since 0.0.0
 */
class DockerImageRef extends S.Class<DockerImageRef, { readonly brand: unique symbol }>($I`DockerImageRef`)(
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

class DockerComposeService extends S.Opaque<DockerComposeService, { readonly brand: unique symbol }>()(
  S.Struct({
    image: S.optionalKey(S.Unknown),
  }).pipe(
    $I.annoteSchema("DockerComposeService", {
      description: "Subset of docker-compose service fields required for image version resolution.",
    })
  )
) {}

class DockerComposeDocument extends S.Opaque<DockerComposeDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    services: S.Record(S.String, DockerComposeService).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, DockerComposeService>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, DockerComposeService>()))
    ),
  }).pipe(
    $I.annoteSchema("DockerComposeDocument", {
      description: "Subset of docker-compose fields required for image version resolution.",
    })
  )
) {}

const decodeDockerComposeDocument = decodeYamlTextWith(S.decodeUnknownEffect(DockerComposeDocument));
/**
 * Resolved Docker image state.
 *
 * @category models
 * @since 0.0.0
 */
export class DockerImageState extends S.Opaque<DockerImageState, { readonly brand: unique symbol }>()(
  S.Struct({
    images: ArrayKeyDefaultEmpty(DockerImageElement),
  }).pipe(
    $I.annoteSchema("DockerImageState", {
      description: "Resolved Docker image state",
    })
  )
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

// ── Version ordering ────────────────────────────────────────────────────────

/**
 * Parse a stable `MAJOR.MINOR.PATCH` version after an optional leading `v`: strict SemVer with no
 * prerelease, no build metadata and no surrounding whitespace.
 */
const parseStableVersion: (text: string) => O.Option<SemVer> = flow(
  Str.replace(/^v/, ""),
  O.liftPredicate((value) => value === Str.trim(value)),
  O.flatMap(flow(SemVer.parseResult, Result.getSuccess)),
  O.filter((version) => version.isStable && A.isReadonlyArrayEmpty(version.build))
);

// The first tag holding the highest version; a later tag replaces it only when strictly newer.
const newestTag = (candidates: ReadonlyArray<readonly [string, SemVer]>): O.Option<string> =>
  O.map(
    A.reduce(candidates, O.none<readonly [string, SemVer]>(), (best, candidate) =>
      O.isSome(best) && SemVer.lte(candidate[1], best.value[1]) ? best : O.some(candidate)
    ),
    ([tag]) => tag
  );

const versionedTags = (
  tags: ReadonlyArray<string>,
  version: (tag: string) => O.Option<SemVer>
): ReadonlyArray<readonly [string, SemVer]> =>
  A.getSomes(
    A.map(
      A.filter(tags, isStableTag),
      (tag): O.Option<readonly [string, SemVer]> => O.map(version(tag), (parsed) => [tag, parsed] as const)
    )
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

const VERSION_PATTERN = /v?\d+\.\d+\.\d+/;

// Version embedded in a tag such as `pg17-v0.8.0`.
const embeddedVersion = (tag: string): O.Option<SemVer> =>
  O.flatMap(
    O.flatMap(Str.match(VERSION_PATTERN)(tag), (match) => A.get(match, 0)),
    parseStableVersion
  );

// Prefix shared by the current tag's family, such as `pg17` for `pg17` and `pg17-v0.8.0`.
const tagFamily = (currentTag: string): string =>
  O.getOrElse(
    O.flatMap(Str.match(/^(pg\d+)/)(currentTag), (match) => O.fromUndefinedOr(match[1])),
    () => currentTag
  );

/**
 * Pick the newest stable Docker Hub tag for an image.
 *
 * **Details**
 *
 * pgvector images keep the current tag's `pgNN` family and read the version embedded in the tag; every other
 * image (Redis included) takes the newest pure `MAJOR.MINOR.PATCH` tag, with an optional leading `v`. Tags
 * carrying prerelease markers, `latest`, or a non-SemVer core (leading zeros) never win. Among tags with the
 * same version, the first one listed wins.
 *
 * **Example** (Pick the newest pure version tag)
 *
 * ```ts
 * import { selectLatestDockerTag } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/DockerResolver"
 * import * as O from "effect/Option"
 *
 * const tags = ["8.10.2-alpine", "8.10.2", "8.9.0", "latest"]
 * const latest = selectLatestDockerTag({ repository: "redis", tag: "8.2.1" }, tags)
 * console.log(O.getOrElse(latest, () => "none")) // "8.10.2"
 * ```
 *
 * @param ref - The pinned image: its Docker Hub repository (`redis`, `pgvector/pgvector`) and current tag.
 * @param tags - Tag names Docker Hub returned, in its listing order.
 * @returns The newest stable tag, when any tag qualifies.
 * @category utilities
 * @since 0.0.0
 */
export const selectLatestDockerTag: {
  (ref: Pick<DockerImageRef, "repository" | "tag">, tags: ReadonlyArray<string>): O.Option<string>;
  (tags: ReadonlyArray<string>): (ref: Pick<DockerImageRef, "repository" | "tag">) => O.Option<string>;
} = dual(
  2,
  (ref: Pick<DockerImageRef, "repository" | "tag">, tags: ReadonlyArray<string>): O.Option<string> =>
    Str.includes("pgvector")(Str.toLowerCase(ref.repository))
      ? newestTag(versionedTags(A.filter(tags, Str.startsWith(tagFamily(ref.tag))), embeddedVersion))
      : newestTag(versionedTags(tags, parseStableVersion))
);

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

    const composeDocument = yield* decodeDockerComposeDocument(content).pipe(
      VersionSyncError.mapError("Failed to parse docker-compose.yml", "docker-compose.yml")
    );

    let images = A.empty<DockerImageElement>();

    for (const [serviceName, service] of R.toEntries(composeDocument.services)) {
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

  const result = selectLatestDockerTag(ref, tagNames);

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
      onEmpty: constant(VersionCategoryStatusEnum.ok),
      onNonEmpty: () =>
        Bool.match(hasUnpinned, {
          onTrue: constant(VersionCategoryStatusEnum.unpinned),
          onFalse: constant(VersionCategoryStatusEnum.drift),
        }),
    }),
    items,
    latest: O.none(),
    error: O.none(),
  });
};
