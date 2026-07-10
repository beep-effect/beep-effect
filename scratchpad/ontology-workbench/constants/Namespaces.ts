import {$ScratchpadId} from "@beep/identity";
import {SchemaUtils, StrFromUnknown} from "@beep/schema";
import {pipe} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("ontology-workbench/constants/Namespaces");
const decodeUnknownStringOption = S.decodeUnknownOption(StrFromUnknown);

const optionFromNullishOrOption = (value: unknown): O.Option<unknown> =>
	O.isOption(value) ? value : O.fromNullishOr(value);

const optionalUnknownString = (value: unknown): O.Option<string> =>
	pipe(optionFromNullishOrOption(value), O.flatMap(decodeUnknownStringOption));

const propertyValue = <const Key extends PropertyKey>(entry: object, key: Key): O.Option<unknown> =>
	P.hasProperty(entry, key) ? O.some(entry[key]) : O.none();

const propertyString = <const Key extends PropertyKey>(entry: object, key: Key): O.Option<string> =>
	pipe(propertyValue(entry, key), O.flatMap(optionalUnknownString));

const propertyStringOrEmpty = <const Key extends PropertyKey>(entry: object, key: Key): string =>
	pipe(propertyString(entry, key), O.getOrElse(() => ""));

const uriFromEntry = (entry: object): string =>
	pipe(
		propertyString(entry, "uri"),
		O.orElse(() => propertyString(entry, "namespace")),
		O.getOrElse(() => "")
	);

const optionalTrimmedString = (value: unknown): O.Option<string> =>
	pipe(optionFromNullishOrOption(value), O.filter(P.isString), O.map(Str.trim), O.filter(Str.isNonEmpty));

export const DEFAULT_NAMESPACE_PREFIX = "";
export const DEFAULT_NAMESPACE_URI = "http://example.com/";

export class NamespaceEntry extends S.Class<NamespaceEntry>($I`NamespaceEntry`)({
	prefix: S.String.pipe(SchemaUtils.withKeyDefaults(DEFAULT_NAMESPACE_PREFIX)),
	uri: S.String.pipe(SchemaUtils.withKeyDefaults(DEFAULT_NAMESPACE_URI)),
	namespace: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	color: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}, $I.annote("NamespaceEntry", {
	description: "A namespace entry for an RDF vocabulary",
})) {
	static readonly defaultEntry: NamespaceEntry = NamespaceEntry.make({
		prefix: DEFAULT_NAMESPACE_PREFIX,
		uri: DEFAULT_NAMESPACE_URI,
		namespace: O.some(DEFAULT_NAMESPACE_URI),
	});

	static readonly ensureDefaultNamespaceMap = (input?: Record<string, string>): Record<string, string> => {
		if (P.isUndefined(input) || !P.isObjectKeyword(input)) return R.empty<string, string>();
		const result = R.empty<string, string>();

		for (const [k, v] of R.toEntries(input)) {
			if (!P.isString(v)) continue;
			result[optionalUnknownString(k).pipe(O.getOrElse(() => ""))] = v;
		}
		return result;
	}

	/**
	 * Convert a `NamespaceEntry[]` to a Record<string,string> for worker protocol.
	 *
	 * **Example** ()
	 *
	 * ```ts
	 * ```
	 *
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly entriesToRecord = (entries: Array<NamespaceEntry>): Record<string, string> => {
		const result = R.empty<string, string>();
		for (const e of entries) result[e.prefix] = e.uri;
		return result;
	}

	/**
	 * Convert a `Record<string,string>` to `NamespaceEntry[]`
	 */
	static readonly recordToEntries = (record: Record<string, string>): Array<NamespaceEntry> =>
		pipe(
			R.toEntries(record),
			A.map(([prefix, uri]) => NamespaceEntry.make({
				prefix,
				uri,
			}))
		)

	/**
	 * Normalize a raw entry, accepting either .uri or .namespace for the URI field.
	 *
	 */
	static readonly normalizeEntry = (entry: Record<string, unknown> | NamespaceEntry): NamespaceEntry => {
		const uri = uriFromEntry(entry);
		return NamespaceEntry.make({
			prefix: propertyStringOrEmpty(entry, "prefix"),
			uri,
			namespace: O.some(uri),
			color: propertyValue(entry, "color").pipe(O.flatMap(optionalTrimmedString)),
		});
	};

	/**
	 * Normalize and validate a registry array, returning the default namespace
	 * entry when the registry is empty.
	 */
	static readonly ensureDefaultRegistry = (
		entries: ReadonlyArray<Record<string, unknown> | NamespaceEntry>,
	): Array<NamespaceEntry> =>
		pipe(
			entries,
			A.map(NamespaceEntry.normalizeEntry),
			A.match({
				onEmpty: () => A.make(NamespaceEntry.defaultEntry),
				onNonEmpty: (normalized) => A.copy(normalized),
			})
		);
}
