/**
 * Comment-preserving YAML file updater over the `@beep/yaml` kit: values are
 * read from the parsed document and written back as byte-minimal edits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { YamlStringifyOptions } from "@beep/yaml/Yaml";
import { YamlDocument } from "@beep/yaml/YamlDocument";
import { YamlFormat } from "@beep/yaml/YamlFormat";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { VersionSyncError } from "../../VersionSync.schemas.ts";
import type { YamlPath } from "@beep/yaml/YamlEdit";
import type { YamlNode } from "@beep/yaml/YamlNode";

const $I = $RepoCliId.create("commands/VersionSync/internal/updaters/YamlFileUpdater");

const YamlNodeValueAsString = S.Unknown.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value) => `${value}`,
      encode: (value) => value,
    })
  ),
  $I.annoteSchema("YamlNodeValueAsString", {
    description: "Schema transformation that normalizes arbitrary YAML node values into comparable strings.",
  })
);

const decodeYamlNodeValueAsString = S.decodeUnknownOption(YamlNodeValueAsString);
const yamlNodeValueAsString = (value: unknown): string =>
  O.getOrElse(decodeYamlNodeValueAsString(value), () => `${value}`);

// The node at `yamlPath`, or none when the path is absent.
const nodeAtPath = (document: YamlDocument, yamlPath: YamlPath): O.Option<YamlNode> =>
  pipe(
    O.fromNullishOr(document.contents),
    O.flatMap((root) => root.find(yamlPath))
  );

// The resolved value at `yamlPath`, or none when the path is absent.
const valueAtPath = (document: YamlDocument, yamlPath: YamlPath): O.Option<unknown> =>
  O.map(nodeAtPath(document, yamlPath), (node) => node.toValue());

// Whether `updated` keeps every byte of `original` outside `node`'s source span.
const changesOnlySpan = (original: string, updated: string, node: YamlNode): boolean => {
  const prefix = Str.slice(0, node.offset)(original);
  const suffix = Str.slice(node.offset + node.length)(original);
  return (
    Str.length(updated) >= Str.length(prefix) + Str.length(suffix) &&
    Str.startsWith(prefix)(updated) &&
    Str.endsWith(suffix)(updated)
  );
};

const parseYamlFile = (filePath: string, text: string) =>
  YamlDocument.parse(text).pipe(VersionSyncError.mapError(`Failed to parse ${filePath}`, filePath));

// A removal, an insertion, or a replacement the kit cannot splice in place
// re-serializes the whole document. These are the `yaml` npm defaults the
// updater wrote with before R4 (sequences indented under their key, quotes
// chosen per value as that package chooses them), which is also the layout of
// the repo's workflow files.
const restructureOptions = YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "auto" });

// A scalar replacement first tries the splice: `quoteStyle` is not a
// document-shaping option, so `modify` still replaces only the target span,
// and a plain target that now needs quotes takes the same per-value quote.
const spliceOptions = YamlStringifyOptions.make({ quoteStyle: "auto" });

const modifyYamlFile = (
  filePath: string,
  text: string,
  yamlPath: YamlPath,
  value: unknown,
  options?: YamlStringifyOptions
) =>
  YamlFormat.modifyToString(text, yamlPath, value, options).pipe(
    VersionSyncError.mapError(`Failed to edit ${filePath}`, filePath)
  );

type UpdateYamlValueOptions = {
  readonly value: string;
};

/**
 * Update a value at a specific path in a YAML file, preserving comments and formatting.
 *
 * Reads the current value through `YamlDocument.parse` and writes the new one
 * with `YamlFormat.modifyToString`. Returns `true` when the file was modified,
 * `false` when already correct.
 *
 * **Details**
 *
 * An existing single-line scalar is spliced in place: only its bytes change.
 * When the kit cannot splice (the key is missing, so the edit is an
 * insertion; or the target is a block, multi-line, tagged or anchored scalar,
 * or a collection), the whole document is re-serialized in the `yaml` npm
 * layout: sequences indented under their key, quotes chosen per value.
 * Comments survive both paths.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updateYamlValue: {
  (
    filePath: string,
    yamlPath: ReadonlyArray<string | number>,
    options: UpdateYamlValueOptions
  ): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (
    yamlPath: ReadonlyArray<string | number>,
    options: UpdateYamlValueOptions
  ): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(
  3,
  Effect.fn(function* (filePath: string, yamlPath: ReadonlyArray<string | number>, options: UpdateYamlValueOptions) {
    const fs = yield* FileSystem.FileSystem;

    const original = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

    const document = yield* parseYamlFile(filePath, original);
    const target = nodeAtPath(document, yamlPath);
    const currentValue = O.getOrUndefined(O.map(target, (node) => node.toValue()));

    if (Str.equivalence(yamlNodeValueAsString(currentValue), options.value)) {
      return false;
    }

    const restructured = modifyYamlFile(filePath, original, yamlPath, options.value, restructureOptions);
    const updated = yield* O.match(target, {
      onNone: () => restructured,
      onSome: (node) =>
        modifyYamlFile(filePath, original, yamlPath, options.value, spliceOptions).pipe(
          Effect.flatMap((spliced) =>
            changesOnlySpan(original, spliced, node) ? Effect.succeed(spliced) : restructured
          )
        ),
    });

    if (Str.equivalence(updated, original)) {
      return false;
    }

    yield* fs
      .writeFileString(filePath, updated)
      .pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

    return true;
  })
);

/**
 * Replace `node-version: <value>` with `node-version-file: .nvmrc` in a workflow YAML.
 *
 * This is a structural fix that eliminates future drift by having CI read `.nvmrc` directly.
 * Uses `YamlFormat.modifyToString` for comment-preserving edits.
 * Returns `true` when the file was modified, `false` when no changes needed.
 *
 * @category utilities
 * @since 0.0.0
 */
export const replaceNodeVersionWithFile: {
  (
    filePath: string,
    locations: ReadonlyArray<{ readonly yamlPath: ReadonlyArray<string | number> }>
  ): Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
  (
    locations: ReadonlyArray<{ readonly yamlPath: ReadonlyArray<string | number> }>
  ): (filePath: string) => Effect.Effect<boolean, VersionSyncError, FileSystem.FileSystem>;
} = dual(
  2,
  Effect.fn(function* (
    filePath: string,
    locations: ReadonlyArray<{ readonly yamlPath: ReadonlyArray<string | number> }>
  ) {
    const fs = yield* FileSystem.FileSystem;

    const original = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError(`Failed to read ${filePath}`, filePath));

    let updated = original;
    let changed = false;

    for (const loc of locations) {
      const document = yield* parseYamlFile(filePath, updated);

      if (O.isSome(O.filter(valueAtPath(document, loc.yamlPath), P.isNotNullish))) {
        // Remove node-version
        updated = yield* modifyYamlFile(filePath, updated, loc.yamlPath, undefined, restructureOptions);

        // Add node-version-file: .nvmrc at the same level
        const withPath = A.dropRight(loc.yamlPath, 1);
        const withNode = valueAtPath(yield* parseYamlFile(filePath, updated), withPath);

        if (O.isSome(withNode) && P.isObject(withNode.value) && !A.isArray(withNode.value)) {
          // Set node-version-file on the `with:` block
          updated = yield* modifyYamlFile(
            filePath,
            updated,
            A.append(withPath, "node-version-file"),
            ".nvmrc",
            restructureOptions
          );
          changed = true;
        }
      }
    }

    if (!changed) {
      return false;
    }

    if (Str.equivalence(updated, original)) {
      return false;
    }

    yield* fs
      .writeFileString(filePath, updated)
      .pipe(VersionSyncError.mapError(`Failed to write ${filePath}`, filePath));

    return true;
  })
);
