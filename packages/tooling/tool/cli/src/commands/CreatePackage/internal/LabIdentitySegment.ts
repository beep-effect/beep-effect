/**
 * Generated labs identity-segment writer and diff for the `@beep/identity`
 * composer registry (`packages/foundation/modeling/identity/src/packages.ts`).
 *
 * The registry keeps a marker-fenced, machine-owned labs segment: a
 * pure `generatedLabComposers` group after the flat `generatedComposers` call,
 * plus a marker-fenced block of independent pure `$I.create("<slug>")` leaf
 * exports before the authored export section. This module is the single writer for that segment:
 * create-package (forward), delete-package (reconstructive inverse),
 * `lint identity-registry --fix`, and `beep architecture` all route lab
 * registrations through {@link LabIdentitySegment.syncLabIdentitySegment},
 * which deterministically re-renders both regions from the live
 * `apps/labs/*` workspace catalog via a marker-anchored text splice — never
 * the ts-morph printer — so authored registry text is byte-preserved.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { isLabsWorkspacePath } from "@beep/repo-cli-kit/cli/Labs/index";
import { workspaceDirectories } from "@beep/repo-cli-kit/RepoWorkspaces";
import { DomainError } from "@beep/repo-utils";
import { A, Str, Text } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { PURE_ANNOTATION } from "./IdentityExportBlock.ts";
import { CreatePackageIdentityRegistration } from "./IdentityRegistration.ts";

const $I = $RepoCliId.create("commands/CreatePackage/internal/LabIdentitySegment");

/**
 * Marker comment prefix opening the generated labs composer group.
 *
 * **Example** (Reference the marker prefix)
 *
 * ```ts
 * import { LAB_COMPOSERS_START_MARKER } from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment"
 *
 * console.log(LAB_COMPOSERS_START_MARKER) // "// GENERATED LAB COMPOSERS START"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LAB_COMPOSERS_START_MARKER = "// GENERATED LAB COMPOSERS START";

/**
 * Marker comment prefix closing the generated labs composer group.
 *
 * **Example** (Reference the marker prefix)
 *
 * ```ts
 * import { LAB_COMPOSERS_END_MARKER } from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment"
 *
 * console.log(LAB_COMPOSERS_END_MARKER) // "// GENERATED LAB COMPOSERS END"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LAB_COMPOSERS_END_MARKER = "// GENERATED LAB COMPOSERS END";

/**
 * Marker comment prefix opening the generated labs export block.
 *
 * **Example** (Reference the marker prefix)
 *
 * ```ts
 * import { LAB_EXPORTS_START_MARKER } from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment"
 *
 * console.log(LAB_EXPORTS_START_MARKER) // "// GENERATED LAB EXPORTS START"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LAB_EXPORTS_START_MARKER = "// GENERATED LAB EXPORTS START";

/**
 * Marker comment prefix closing the generated labs export block.
 *
 * **Example** (Reference the marker prefix)
 *
 * ```ts
 * import { LAB_EXPORTS_END_MARKER } from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment"
 *
 * console.log(LAB_EXPORTS_END_MARKER) // "// GENERATED LAB EXPORTS END"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LAB_EXPORTS_END_MARKER = "// GENERATED LAB EXPORTS END";

/**
 * Read/diff snapshot of the generated labs segment against the live
 * `apps/labs/*` workspace catalog.
 *
 * **Example** (Construct a labs segment state)
 *
 * ```ts
 * import { LabIdentitySegmentState } from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment"
 *
 * const state = LabIdentitySegmentState.make({
 *   expectedSlugs: ["probe-lab"],
 *   actualComposerSlugs: ["probe-lab"],
 *   actualExportSlugs: ["probe-lab"],
 *   misplacedSlugs: [],
 * })
 * console.log(state.expectedSlugs) // ["probe-lab"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LabIdentitySegmentState extends S.Opaque<LabIdentitySegmentState, { readonly brand: unique symbol }>()(
  S.Struct({
    expectedSlugs: S.Array(S.NonEmptyString),
    actualComposerSlugs: S.Array(S.NonEmptyString),
    actualExportSlugs: S.Array(S.NonEmptyString),
    misplacedSlugs: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("LabIdentitySegmentState", {
      description:
        "Labs identity-segment diff: expected lab slugs from the workspace catalog, actual composer/export slugs read from the marker-fenced regions, and live lab slugs registered outside the regions.",
    })
  )
) {}

const BEEP_SCOPE_PREFIX = "@beep/";
const BIOME_LINE_WIDTH = 120;
const EMPTY_LAB_COMPOSERS_REGION = "const generatedLabComposers = {};";
const LAB_COMPOSERS_DECLARATION_HEAD = `const generatedLabComposers = ${PURE_ANNOTATION} $I.compose`;
const LEAF_INITIALIZER_JOIN = ` = ${PURE_ANNOTATION} $I.create(`;

const markerError = (problem: string, marker: string): DomainError =>
  DomainError.make({
    message: `Generated labs marker "${marker}" ${problem} in the identity composer registry. The registry substrate requires all four generated-labs markers exactly once (see packages/foundation/modeling/identity/src/packages.ts); restore the marker lines, then rerun \`bun run beep lint identity-registry --fix\` to regenerate the labs segment.`,
  });

const markerIndexOnce = (content: string, marker: string): Effect.Effect<number, DomainError> =>
  pipe(
    Str.indexOf(marker)(content),
    O.match({
      onNone: () => Effect.fail(markerError("is missing", marker)),
      onSome: (first) => {
        const uniqueMarker = pipe(
          Str.lastIndexOf(marker)(content),
          O.filter((last) => last === first),
          O.map(() => first)
        );
        return pipe(
          uniqueMarker,
          O.map(Effect.succeed),
          O.getOrElse(() => Effect.fail(markerError("appears more than once", marker)))
        );
      },
    })
  );

const locateRegion = Effect.fnUntraced(function* (content: string, startMarker: string, endMarker: string) {
  const startIndex = yield* markerIndexOnce(content, startMarker);
  const endIndex = yield* markerIndexOnce(content, endMarker);
  const newlineAfterStart = Str.indexOf("\n")(Str.slice(startIndex)(content));

  if (O.isNone(newlineAfterStart) || endIndex < startIndex) {
    return yield* markerError("is malformed", startMarker);
  }

  const bodyStart = startIndex + newlineAfterStart.value + 1;
  const endLineStart = pipe(
    Str.lastIndexOf("\n")(Str.slice(0, endIndex)(content)),
    O.match({ onNone: () => 0, onSome: (index) => index + 1 })
  );

  if (endLineStart < bodyStart) {
    return yield* markerError("is malformed", endMarker);
  }

  return [bodyStart, endLineStart] as const;
});

const spliceRegion = Effect.fnUntraced(function* (
  content: string,
  startMarker: string,
  endMarker: string,
  body: string
) {
  const [bodyStart, bodyEnd] = yield* locateRegion(content, startMarker, endMarker);
  const bodyWithNewline = Str.isEmpty(body) ? Str.empty : `${body}\n`;
  return `${Str.slice(0, bodyStart)(content)}${bodyWithNewline}${Str.slice(bodyEnd)(content)}`;
});

const regionBody = Effect.fnUntraced(function* (content: string, startMarker: string, endMarker: string) {
  const [bodyStart, bodyEnd] = yield* locateRegion(content, startMarker, endMarker);
  return Str.slice(bodyStart, bodyEnd)(content);
});

const renderLabComposersRegion = (slugs: ReadonlyArray<string>): string => {
  if (A.isReadonlyArrayEmpty(slugs)) {
    return EMPTY_LAB_COMPOSERS_REGION;
  }

  const sorted = A.sort(slugs, Order.String);
  const singleLine = `${LAB_COMPOSERS_DECLARATION_HEAD}(${A.join(
    A.map(sorted, (slug) => `"${slug}"`),
    ", "
  )});`;

  return Str.length(singleLine) <= BIOME_LINE_WIDTH
    ? singleLine
    : Text.joinLines([
        `${LAB_COMPOSERS_DECLARATION_HEAD}(`,
        A.join(
          A.map(sorted, (slug) => `  "${slug}"`),
          ",\n"
        ),
        ");",
      ]);
};

const labExportBlock = (slug: string): string => {
  const block = CreatePackageIdentityRegistration.typedIdentityExportBlock(slug);
  const lastLineStart = pipe(Str.lastIndexOf("\n")(block), O.match({ onNone: () => 0, onSome: (index) => index + 1 }));

  if (Str.length(block) - lastLineStart <= BIOME_LINE_WIDTH) {
    return block;
  }

  const leafCall = `$I.create("${slug}");`;
  const headWidth = Str.length(block) - lastLineStart - Str.length(leafCall) + Str.length("$I.create(");

  return headWidth <= BIOME_LINE_WIDTH
    ? Str.replace(leafCall, `$I.create(\n  "${slug}"\n);`)(block)
    : Str.replace(LEAF_INITIALIZER_JOIN, ` =\n  ${PURE_ANNOTATION} $I.create(`)(block);
};

const renderLabExportsRegion = (slugs: ReadonlyArray<string>): string =>
  A.join(A.map(A.sort(slugs, Order.String), labExportBlock), "\n");

const replaceLabRegions = Effect.fnUntraced(function* (content: string, slugs: ReadonlyArray<string>) {
  const withComposers = yield* spliceRegion(
    content,
    LAB_COMPOSERS_START_MARKER,
    LAB_COMPOSERS_END_MARKER,
    renderLabComposersRegion(slugs)
  );
  return yield* spliceRegion(
    withComposers,
    LAB_EXPORTS_START_MARKER,
    LAB_EXPORTS_END_MARKER,
    renderLabExportsRegion(slugs)
  );
});

const expectedLabSlugs = Effect.fn("LabIdentitySegment.expectedLabSlugs")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const workspaces = yield* workspaceDirectories(repoRoot);
  let slugs = A.empty<string>();

  for (const [name, dir] of workspaces) {
    if (Str.startsWith(BEEP_SCOPE_PREFIX)(name) && isLabsWorkspacePath(path.relative(repoRoot, dir))) {
      slugs = A.append(slugs, Str.replace(BEEP_SCOPE_PREFIX, Str.empty)(name));
    }
  }

  return A.sort(slugs, Order.String);
});

const stateFromRegistryContent = Effect.fnUntraced(function* (content: string, expectedSlugs: ReadonlyArray<string>) {
  const composersBody = yield* regionBody(content, LAB_COMPOSERS_START_MARKER, LAB_COMPOSERS_END_MARKER);
  const exportsBody = yield* regionBody(content, LAB_EXPORTS_START_MARKER, LAB_EXPORTS_END_MARKER);
  const withoutComposersRegion = yield* spliceRegion(
    content,
    LAB_COMPOSERS_START_MARKER,
    LAB_COMPOSERS_END_MARKER,
    Str.empty
  );
  const remainder = yield* spliceRegion(
    withoutComposersRegion,
    LAB_EXPORTS_START_MARKER,
    LAB_EXPORTS_END_MARKER,
    Str.empty
  );
  const remainderComposerSlugs = HashSet.fromIterable(
    CreatePackageIdentityRegistration.registeredIdentityComposerSlugs(remainder)
  );
  const misplacedSlugs = A.filter(
    expectedSlugs,
    (slug) =>
      HashSet.has(remainderComposerSlugs, slug) ||
      CreatePackageIdentityRegistration.accessorExportPattern(slug).test(remainder)
  );

  return LabIdentitySegmentState.make({
    expectedSlugs,
    actualComposerSlugs: CreatePackageIdentityRegistration.registeredIdentityComposerSlugs(composersBody),
    actualExportSlugs: CreatePackageIdentityRegistration.registeredIdentityExportSlugs(exportsBody),
    misplacedSlugs,
  });
});

const readRegistryContent = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const identityPackagesFilePath = yield* CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath(repoRoot);
  const absolutePath = path.join(repoRoot, identityPackagesFilePath);
  const content = yield* fs
    .readFileString(absolutePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${absolutePath}"`)));
  return [absolutePath, content] as const;
});

const syncLabIdentitySegment = Effect.fn("LabIdentitySegment.syncLabIdentitySegment")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const [absolutePath, content] = yield* readRegistryContent(repoRoot);
  const expected = yield* expectedLabSlugs(repoRoot);
  const next = yield* replaceLabRegions(content, expected);
  const changed = !Str.equivalence(content, next);

  if (changed) {
    yield* fs
      .writeFileString(absolutePath, next)
      .pipe(Effect.mapError(DomainError.newCause(`Failed to write "${absolutePath}"`)));
  }

  const state = yield* stateFromRegistryContent(next, expected);
  return { changed, state };
});

const diffLabIdentitySegment = Effect.fn("LabIdentitySegment.diffLabIdentitySegment")(function* (repoRoot: string) {
  const [, content] = yield* readRegistryContent(repoRoot);
  const expected = yield* expectedLabSlugs(repoRoot);
  return yield* stateFromRegistryContent(content, expected);
});

/**
 * Labs identity-segment surface shared by create-package, delete-package,
 * the identity-registry lint, and the architecture command.
 *
 * **Details**
 *
 * - `syncLabIdentitySegment` regenerates both marker-fenced labs regions from the live workspace
 *   catalog and writes the registry only when the rendered text differs. `diffLabIdentitySegment`
 *   is the read-only diff for lint and doctor consumers and never writes.
 * - `expectedLabSlugs` lists the beep-scoped slugs whose directory sits below `apps/labs`,
 *   sorted by slug. The diff also reports live labs registered outside the regions.
 * - `renderLabComposersRegion` renders the empty object for zero labs (`$I.compose` requires at
 *   least one segment), otherwise one `$I.compose(...)` call over the sorted slugs.
 * - `renderLabExportsRegion` renders one typed export per sorted slug from the
 *   `typedIdentityExportBlock` template, so the identity package docgen and JSDoc lint stay
 *   green; it is empty for zero labs.
 * - Both renderers emit the layout biome writes at the root `formatter.lineWidth` of 120, so
 *   `yeet repair` never rewrites a regenerated region.
 *
 * **Gotchas**
 *
 * The labs compose group is a pure registry that only `RepoPkgs` evaluates: a bundle that never
 * reads `RepoPkgs` drops the group and its slugs.
 *
 * **Example** (Build a labs segment sync effect)
 *
 * ```ts
 * import { LabIdentitySegment } from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment"
 * import * as Effect from "effect/Effect";
 * const program = LabIdentitySegment.syncLabIdentitySegment("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const LabIdentitySegment = {
  diffLabIdentitySegment,
  expectedLabSlugs,
  renderLabComposersRegion,
  renderLabExportsRegion,
  syncLabIdentitySegment,
} as const;
