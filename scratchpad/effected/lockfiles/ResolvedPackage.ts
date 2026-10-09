import { IntegrityHash } from "../npm/index.ts";
import { Effect, Schema } from "effect";

const EMPTY_DEPENDENCIES: { readonly [name: string]: string } = {};

const EMPTY_PEER_META: { readonly [name: string]: { readonly optional: boolean } } = {};

const EMPTY_EDGE_NAMES: ReadonlyArray<string> = [];

/**
 * A package resolved from a lockfile.
 *
 * @remarks
 * The common shape every format's entries normalize into:
 *
 * - `instanceId` — the lockfile-native identity of this *instance*, verbatim:
 *   pnpm's snapshot key (`react-dom@18.3.1(react@17.0.2)`), npm's full entry
 *   key (`node_modules/express/node_modules/debug`), bun's `packages` key
 *   (`@acme/lib/react-dom`) or yarn's locator (`react-dom@npm:18.3.1`). It is
 *   **opaque** — no scheme is synthesized and none should be parsed by a
 *   consumer; it exists so `resolved` can name an instance, and so two
 *   peer-resolved variants of one `name@version` stay distinguishable.
 * - `name` — the resolved package name. For pnpm *workspace* packages
 *   straight out of `Lockfile.parse` this is the importer path until
 *   `Lockfile#withImporterNames` rewrites it.
 * - `version` — the resolved version string (pnpm workspace packages carry
 *   `"0.0.0"`; the lockfile does not record their real versions).
 * - `integrity` — optional `@effected/npm` `IntegrityHash`, covering npm/pnpm
 *   `sha512-...` SRI and yarn Berry's `10c0/...` cache checksums (the yarn
 *   textual form). An *absent* integrity is omitted, so a `ResolvedPackage` may
 *   carry none; a *present but unparseable* integrity fails the parse typed at
 *   validation rather than being silently dropped.
 * - `isWorkspace` — `true` for workspace-local packages.
 * - `relativePath` — the workspace-relative directory for workspace
 *   packages, when the lockfile records one.
 * - `dependencies` — the package's own dependency map, defaulting to `{}`
 *   both at construction and when decoding serialized data.
 * - `peerDependencies` — the package's *declared* peer ranges, keyed by peer
 *   name. Every format records them (pnpm and npm as their own section, bun
 *   inline in the package tuple's info object, yarn Berry as an entry
 *   section), so this is populated across all four. Declarations only: what
 *   the package *asks for*, never what actually resolved.
 * - `peerDependenciesMeta` — the per-peer flags, normalized to
 *   `{ optional: boolean }`. bun spells optional peers as an `optionalPeers`
 *   array of names rather than a meta object; that spelling is normalized
 *   into this shape so one consumer algorithm serves every format. A peer
 *   with no meta entry is required.
 * - `resolved` — this instance's *outgoing edges*: dependency (and, where the
 *   format records it, peer) name → the `instanceId` that name actually
 *   resolved to in this instance's context. This is the answer to "which
 *   concrete version of P did X get", which `peerDependencies` deliberately
 *   does not answer.
 *
 *   Every entry is **verified**: an edge is emitted only when the composed or
 *   walked-up identity matches a real instance in the same lockfile. An edge
 *   that cannot be resolved honestly is *omitted*, never guessed — a wrong
 *   resolved edge is a silent wrong answer, an absent one is a visible gap.
 *   yarn records peer resolution virtually and is therefore dependency-edges
 *   only.
 *
 * - `unresolvedEdges` — dependency names whose edge the lockfile **records**
 *   but this model could not name: a `link:` target that is not a workspace
 *   importer, a composed identity matching no instance. It is the companion
 *   `resolved` needs to be honest, because an absent key in `resolved` would
 *   otherwise mean two different things — "nothing is there" and "something is
 *   there that I could not name" — and a consumer reading the first meaning
 *   for the second turns this package's gap into its own false positive.
 *
 *   A dependency the lockfile simply does not record is **not** an unresolved
 *   edge; it is an absence, and must not appear here. npm and bun contribute
 *   nothing at all: their sections are *declarations* resolved positionally, so
 *   "the walk found nothing" is genuine absence. A fail-closed signal that is
 *   always on is a signal nobody reads.
 *
 * All four record fields — `dependencies`, `peerDependencies`,
 * `peerDependenciesMeta` and `resolved` — default to `{}` at construction and
 * when decoding, and `unresolvedEdges` defaults to `[]`. An absent section is
 * therefore an empty collection, never `undefined`.
 *
 * @public
 */
export class ResolvedPackage extends Schema.Class<ResolvedPackage>("ResolvedPackage")({
	name: Schema.NonEmptyString,
	version: Schema.String,
	instanceId: Schema.NonEmptyString,
	integrity: Schema.optionalKey(IntegrityHash),
	isWorkspace: Schema.Boolean,
	relativePath: Schema.optionalKey(Schema.String),
	dependencies: Schema.Record(Schema.String, Schema.String).pipe(
		Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_DEPENDENCIES)),
		Schema.withConstructorDefault(Effect.succeed(EMPTY_DEPENDENCIES)),
	),
	peerDependencies: Schema.Record(Schema.String, Schema.String).pipe(
		Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_DEPENDENCIES)),
		Schema.withConstructorDefault(Effect.succeed(EMPTY_DEPENDENCIES)),
	),
	peerDependenciesMeta: Schema.Record(Schema.String, Schema.Struct({ optional: Schema.Boolean })).pipe(
		Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_PEER_META)),
		Schema.withConstructorDefault(Effect.succeed(EMPTY_PEER_META)),
	),
	resolved: Schema.Record(Schema.String, Schema.String).pipe(
		Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_DEPENDENCIES)),
		Schema.withConstructorDefault(Effect.succeed(EMPTY_DEPENDENCIES)),
	),
	unresolvedEdges: Schema.Array(Schema.String).pipe(
		Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_EDGE_NAMES)),
		Schema.withConstructorDefault(Effect.succeed(EMPTY_EDGE_NAMES)),
	),
}) {}
