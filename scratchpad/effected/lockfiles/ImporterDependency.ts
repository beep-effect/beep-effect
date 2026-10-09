import { $ScratchpadId } from "@beep/identity/packages";
import { DependencyField, DependencySpecifier } from "../npm/index.ts";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/ImporterDependency");

/**
 * One declared dependency of one workspace importer, as the lockfile records it.
 *
 * @remarks
 * - `name` — the dependency's package name.
 * - `specifier` — the declared range, typed through `@effected/npm`'s
 *   `DependencySpecifier.FromString` codec: the decoded value is a tag-matchable
 *   `ClassifiedSpecifier` (`catalog:` / `workspace:` / range / dist-tag / raw),
 *   while encoding round-trips the **exact original string byte-for-byte** — the
 *   guarantee a before/after lockfile diff relies on.
 * - `version` — the concrete resolved version, **populated by pnpm only**:
 *   comparable across refs and printable. pnpm records `{ specifier, version }`
 *   per importer dependency, and the parser splits pnpm's peer-disambiguation
 *   suffix off into `peerSuffix`, so `version` is always the plain version — or
 *   a non-registry resolution (`link:../utils`, `file:...`). A `file:`
 *   resolution is suffixed like a registry version when the package declares
 *   peers and is split the same way; a `link:` is never suffixed and passes
 *   through verbatim. bun and npm record resolved versions on their package entries
 *   instead, so for those formats `version` is absent and a consumer joins by
 *   `name` against `Lockfile.packages`.
 * - `peerSuffix` — pnpm's peer-disambiguation context: the raw parenthesized
 *   chain the lockfile recorded after the version, e.g.
 *   `(effect@4.0.0)(ioredis@5.11.1(supports-color@8.1.1))`. Present
 *   only when the lockfile recorded one — never for suffix-free pnpm entries,
 *   and never for the other formats, which do not record peer context per
 *   importer dependency.
 * - `depType` — which dependency map declared it, spelled with `@effected/npm`'s
 *   kit-wide `DependencyField` vocabulary.
 *
 * @public
 */
export class ImporterDependency extends S.Class<ImporterDependency>($I`ImporterDependency`)({
	name: S.NonEmptyString.annotateKey({ description: "Dependency package declared by this workspace importer" }),
	specifier: DependencySpecifier.FromString.annotateKey({ description: "Declared dependency range or protocol, classified for inspection while preserving its exact original spelling when encoded" }),
	version: S.optionalKey(S.String).annotateKey({ description: "pnpm-recorded resolved version or protocol resolution with peer context removed; absent for bun and npm" }),
	peerSuffix: S.optionalKey(S.String).annotateKey({ description: "Raw parenthesized peer context following a pnpm importer dependency's resolution, present only when recorded" }),
	depType: DependencyField.annotateKey({ description: "Dependency section that declared this entry: runtime, development, peer or optional" }),
}, $I.annote("ImporterDependency", { description: "One declared dependency of one workspace importer, as the lockfile records it." })) {}
