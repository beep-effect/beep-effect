import type { Option, PlatformError } from "effect";
import { Context, Effect, FileSystem, Layer, Schema } from "effect";
import type { Section, SectionId } from "./Section.ts";
import type { SectionRenderError } from "./SectionDialect.ts";
import { SectionDialect } from "./SectionDialect.ts";
import { SectionDocument, SectionParseError } from "./SectionDocument.ts";
import type { CheckOutcome, SyncOutcome } from "./SectionOutcome.ts";

/**
 * Raised when the file behind a managed-section operation could not be read or
 * written.
 *
 * @remarks
 * The underlying `PlatformError` is preserved structurally in `cause` rather
 * than stringified. `operation` is what a bare platform error cannot tell a
 * caller: these operations are read-modify-write, so "it failed" is ambiguous
 * about whether the document was even seen.
 *
 * A **missing** file is not an error — it reads as a document with no
 * sections, and a sync creates it.
 *
 * @public
 */
export class SectionFileError extends Schema.TaggedError<SectionFileError>()("SectionFileError", {
	/** The file the operation was against. */
	path: Schema.String,
	/** Which half of the read-modify-write failed. */
	operation: Schema.Literals(["read", "write"]),
	/** The underlying failure, preserved structurally. */
	cause: Schema.Defect(),
}) {
	override get message(): string {
		return `Failed to ${this.operation} managed sections in "${this.path}"`;
	}
}

/**
 * The {@link ManagedSection} service shape.
 *
 * @remarks
 * Exported so a consumer can type a function against the shape without naming
 * the service class, and so the surface is a reviewable declaration rather
 * than whatever the implementation happened to return.
 *
 * Every member is **data-first**: the path comes first and nothing is dual,
 * so a member can be stubbed with a one-line override in
 * {@link ManagedSection.layerTest}.
 *
 * @public
 */
export interface ManagedSectionShape {
	/** The section with this identity, if the file has one. */
	readonly read: (
		path: string,
		id: SectionId,
	) => Effect.Effect<Option.Option<Section>, SectionParseError | SectionFileError>;

	/** Every managed section in the file, in document order. */
	readonly readAll: (path: string) => Effect.Effect<ReadonlyArray<Section>, SectionParseError | SectionFileError>;

	/** Whether the file carries a section with this identity. */
	readonly isManaged: (path: string, id: SectionId) => Effect.Effect<boolean, SectionParseError | SectionFileError>;

	/** Make one section say what it should, writing only if that changes the file. */
	readonly sync: (
		path: string,
		section: Section,
	) => Effect.Effect<SyncOutcome, SectionParseError | SectionRenderError | SectionFileError>;

	/**
	 * Make a whole set of sections say what they should, in declared order.
	 *
	 * @remarks
	 * The declared order is written into the file — see
	 * {@link SectionDocument.reconcile}. Writes only if the text changes.
	 */
	readonly syncAll: (
		path: string,
		sections: ReadonlyArray<Section>,
	) => Effect.Effect<ReadonlyArray<SyncOutcome>, SectionParseError | SectionRenderError | SectionFileError>;

	/** Compare one section against the file, changing nothing. */
	readonly check: (path: string, section: Section) => Effect.Effect<CheckOutcome, SectionParseError | SectionFileError>;

	/** Compare a set of sections against the file from a single read. */
	readonly checkAll: (
		path: string,
		sections: ReadonlyArray<Section>,
	) => Effect.Effect<ReadonlyArray<CheckOutcome>, SectionParseError | SectionFileError>;

	/** Remove a section. `false` when it was not there. */
	readonly remove: (path: string, id: SectionId) => Effect.Effect<boolean, SectionParseError | SectionFileError>;
}

/**
 * How a `ManagedSection` layer reads and writes markers.
 *
 * @public
 */
export interface ManagedSectionOptions {
	/** Defaults to {@link SectionDialect.default}. */
	readonly dialect?: SectionDialect;
}

const notFound = (error: PlatformError.PlatformError): boolean => error.reason._tag === "NotFound";

/**
 * Decodes file bytes **without** consuming a byte-order mark.
 *
 * @remarks
 * `FileSystem.readFileString` decodes through a default `TextDecoder`, which
 * strips a leading BOM. Reading through it would make the first sync of a
 * BOM-carrying file silently delete the BOM, which violates this package's
 * central promise that every byte outside a managed span survives. Reading
 * bytes and decoding with `ignoreBOM: true` keeps the mark in the leading
 * text span, where it is preserved like any other content.
 */
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

const make = (options: ManagedSectionOptions = {}): Effect.Effect<ManagedSectionShape, never, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const dialect = options.dialect ?? SectionDialect.default;

		/**
		 * Read and parse, degrading a missing file to an empty document.
		 *
		 * One read, not an `exists` probe followed by a read: two syscalls with a
		 * race between them, where the file can appear or vanish in the gap.
		 */
		const load = (path: string): Effect.Effect<SectionDocument, SectionParseError | SectionFileError> =>
			fs.readFile(path).pipe(
				Effect.map((bytes) => decoder.decode(bytes)),
				Effect.catchTag("PlatformError", (error) =>
					notFound(error)
						? Effect.succeed("")
						: Effect.fail(new SectionFileError({ path, operation: "read", cause: error })),
				),
				Effect.flatMap((text) =>
					Effect.fromResult(SectionDocument.parseResult(text, dialect)).pipe(
						Effect.mapError((error) => SectionParseError.at(path, error)),
					),
				),
			);

		const store = (path: string, text: string): Effect.Effect<void, SectionFileError> =>
			fs
				.writeFileString(path, text)
				.pipe(
					Effect.catchTag("PlatformError", (error) =>
						Effect.fail(new SectionFileError({ path, operation: "write", cause: error })),
					),
				);

		const syncAll: ManagedSectionShape["syncAll"] = Effect.fn("ManagedSection.syncAll")(function* (
			path: string,
			sections: ReadonlyArray<Section>,
		) {
			yield* Effect.annotateCurrentSpan({ path, sections: sections.length });
			const document = yield* load(path);
			const reconciled = yield* Effect.fromResult(document.reconcile(sections));
			// Writing an identical file churns mtimes and makes every sync look
			// like a change to anything watching.
			if (reconciled.changed) {
				yield* store(path, reconciled.text);
			}
			return reconciled.outcomes;
		});

		return {
			read: Effect.fn("ManagedSection.read")(function* (path: string, id: SectionId) {
				yield* Effect.annotateCurrentSpan({ path, key: id.key });
				return (yield* load(path)).read(id);
			}),

			readAll: Effect.fn("ManagedSection.readAll")(function* (path: string) {
				yield* Effect.annotateCurrentSpan({ path });
				return (yield* load(path)).sections.map((placed) => placed.section);
			}),

			isManaged: Effect.fn("ManagedSection.isManaged")(function* (path: string, id: SectionId) {
				yield* Effect.annotateCurrentSpan({ path, key: id.key });
				return (yield* load(path)).has(id);
			}),

			// `sync` IS `syncAll` with one element: with a single declared section
			// there is nothing to reorder, so the two agree exactly. A second
			// implementation would be a second ordering rule waiting to drift.
			sync: Effect.fn("ManagedSection.sync")(function* (path: string, section: Section) {
				yield* Effect.annotateCurrentSpan({ path, key: section.key });
				const outcomes = yield* syncAll(path, [section]);
				// syncAll returns one outcome per declared section.
				return outcomes[0] as SyncOutcome;
			}),

			syncAll,

			check: Effect.fn("ManagedSection.check")(function* (path: string, section: Section) {
				yield* Effect.annotateCurrentSpan({ path, key: section.key });
				return (yield* load(path)).check(section);
			}),

			checkAll: Effect.fn("ManagedSection.checkAll")(function* (path: string, sections: ReadonlyArray<Section>) {
				yield* Effect.annotateCurrentSpan({ path, sections: sections.length });
				const document = yield* load(path);
				return sections.map((section) => document.check(section));
			}),

			remove: Effect.fn("ManagedSection.remove")(function* (path: string, id: SectionId) {
				yield* Effect.annotateCurrentSpan({ path, key: id.key });
				const document = yield* load(path);
				const next = document.remove(id);
				if (next._tag === "None") {
					return false;
				}
				yield* store(path, next.value);
				return true;
			}),
		} satisfies ManagedSectionShape;
	});

const unimplemented = (member: string): never => {
	throw new Error(`ManagedSection.makeTest: ${member}() was called but not stubbed — pass a \`${member}\` override.`);
};

/**
 * Managed sections in files: read, compare, sync and remove delimited blocks
 * whose surrounding content belongs to the user.
 *
 * @remarks
 * A thin shell over {@link SectionDocument}: every member reads the file, runs
 * the pure core, and writes back only when the text actually changed. All the
 * interesting behavior — and all the interesting tests — live in the pure core.
 *
 * `FileSystem` is required in `R` and discharged by the consumer's platform
 * layer at the edge. No `Path` is required: paths are handed to `FileSystem`
 * untouched.
 *
 * @example
 * ```ts
 * import { CommentStyle, ManagedSection, SectionId } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const Base = SectionId.make({ key: "base", commentStyle: CommentStyle.hash });
 * const Tool = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
 *
 * const program = Effect.gen(function* () {
 *   const sections = yield* ManagedSection;
 *   // Declared order is written into the file, so `base` precedes `tool`.
 *   return yield* sections.syncAll(".husky/pre-commit", [
 *     Base.section("preamble"),
 *     Tool.section("run-the-tool"),
 *   ]);
 * });
 * ```
 *
 * @public
 */
export class ManagedSection extends Context.Service<ManagedSection, ManagedSectionShape>()(
	"@effected/templates/ManagedSection",
) {
	/**
	 * The default layer, reading and writing {@link SectionDialect.default}
	 * markers.
	 *
	 * @remarks
	 * A bound `const`, not a function, so it memoizes by reference.
	 */
	static readonly layer: Layer.Layer<ManagedSection, never, FileSystem.FileSystem> = Layer.effect(this, make());

	/**
	 * A layer with a custom marker dialect.
	 *
	 * @remarks
	 * A parameterized layer factory mints a **fresh reference per call**, and
	 * layers memoize by reference — bind the result to a `const` and reuse it
	 * rather than calling `layerWith(...)` at each composition site.
	 */
	static readonly layerWith = (
		options: ManagedSectionOptions,
	): Layer.Layer<ManagedSection, never, FileSystem.FileSystem> => Layer.effect(ManagedSection, make(options));

	/**
	 * A test double. Members a suite does not stub **die when called**, rather
	 * than returning a plausible-looking answer that makes a wrong test pass.
	 */
	static readonly makeTest = (overrides: Partial<ManagedSectionShape> = {}): ManagedSectionShape => ({
		read: () => Effect.sync(() => unimplemented("read")),
		readAll: () => Effect.sync(() => unimplemented("readAll")),
		isManaged: () => Effect.sync(() => unimplemented("isManaged")),
		sync: () => Effect.sync(() => unimplemented("sync")),
		syncAll: () => Effect.sync(() => unimplemented("syncAll")),
		check: () => Effect.sync(() => unimplemented("check")),
		checkAll: () => Effect.sync(() => unimplemented("checkAll")),
		remove: () => Effect.sync(() => unimplemented("remove")),
		...overrides,
	});

	/**
	 * The test layer: {@link ManagedSection.makeTest} behind `Layer.succeed`, so
	 * a suite provides only the members it exercises.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh reference per call — bind it
	 * to a `const` rather than calling it at each composition site.
	 */
	static readonly layerTest = (overrides: Partial<ManagedSectionShape> = {}): Layer.Layer<ManagedSection> =>
		Layer.succeed(ManagedSection, ManagedSection.makeTest(overrides));
}
