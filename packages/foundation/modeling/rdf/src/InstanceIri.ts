/**
 * Instance IRIs: the IRI a content id prints as, and its parser.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI } from "@beep/identity/Iri";
import { mint, namespace } from "@beep/identity/Registry";
import { ContentHash } from "@beep/schema/ContentHash";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const instancePrefix = `${namespace("instance").iri}sha256-`;

const instanceSegment = (hash: ContentHash): string => Str.replace("sha256:", "sha256-")(hash);

const decodeContentHash = S.decodeUnknownOption(ContentHash);

/**
 * The instance IRI a content id prints as:
 * `https://beep-effect.com/ns/instance/sha256-<hex>`.
 *
 * **Details**
 *
 * Annotation, occurrence, run-entity, activity and capture ids all print this
 * way; their domain tags keep the hashes of different brands apart.
 *
 * **Example** (Print an id)
 *
 * ```ts import.meta.vitest name="Print an id as an instance IRI"
 * import { instanceIri } from "@beep/rdf/InstanceIri"
 * import { ContentHash } from "@beep/schema/ContentHash"
 *
 * instanceIri(ContentHash.make(`sha256:${"a".repeat(64)}`)) === `https://beep-effect.com/ns/instance/sha256-${"a".repeat(64)}` // => true
 * ```
 *
 * @param hash - A content id.
 * @returns Its instance IRI.
 * @category mapping
 * @since 0.0.0
 */
export const instanceIri = (hash: ContentHash): IRI => IRI.make(mint("instance", instanceSegment(hash)));

/**
 * The content id an instance IRI prints, or none for any other IRI.
 *
 * **Example** (Parse an instance IRI)
 *
 * ```ts import.meta.vitest name="Parse an instance IRI"
 * import { instanceHash, instanceIri } from "@beep/rdf/InstanceIri"
 * import { IRI } from "@beep/identity/Iri"
 * import { ContentHash } from "@beep/schema/ContentHash"
 * import * as O from "effect/Option"
 *
 * const hash = ContentHash.make(`sha256:${"a".repeat(64)}`)
 * O.contains(instanceHash(instanceIri(hash)), hash) // => true
 * O.isNone(instanceHash(IRI.make("https://example.org/activity/1"))) // => true
 * ```
 *
 * @param value - An IRI.
 * @returns The content id it prints, when it is an instance IRI.
 * @category mapping
 * @since 0.0.0
 */
export const instanceHash = (value: IRI): O.Option<ContentHash> =>
  O.some(value).pipe(
    O.filter(Str.startsWith(instancePrefix)),
    O.flatMap((instance) => decodeContentHash(`sha256:${Str.slice(instancePrefix.length)(instance)}`))
  );
