/**
 * The pure string-to-string core of managed sections: parsing a document
 * into sections, reconciling desired sections, and the parse error.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ManagedSectionId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ReconcileInput, ReconcileOutput, reconcile } from "./internal/reconcile.ts";
import { detectEol, identityOf, normalizeEol, ScanFailureReason, scan } from "./internal/scan.ts";
import { PlacedSection } from "./Section.ts";
import { Eol, SectionDialect } from "./SectionDialect.ts";
import { CheckOutcome } from "./SectionOutcome.ts";
import type { Section, SectionId } from "./Section.ts";
import type { SectionRenderError } from "./SectionDialect.ts";

const $I = $ManagedSectionId.create("SectionDocument");

const optionalKeyOmittedWhenAbsent = (key: string | undefined) => O.getSomesStruct({ key: O.fromUndefinedOr(key) });

/**
 * Raised when a document's managed-section structure cannot be read without
 * guessing.
 *
 * **Gotchas**
 *
 * Every reason names an ambiguity whose silent resolution corrupts a file.
 * A skipped unterminated marker makes the next write append a **second** copy
 * of the section; a duplicate means every sync updates the first copy while
 * the stale second one lives on disk forever. Malformed input therefore fails
 * through the typed channel with the line that identifies it, and the user
 * fixes their file.
 *
 * **Example** (Construct a duplicate-section failure)
 *
 * ```ts
 * import { SectionParseError } from "@beep/managed-section/SectionDocument";
 *
 * const error = SectionParseError.make({ reason: "duplicateSection", line: 7, key: "example-tool" });
 * console.log(error.message) // Managed section appears twice for section "example-tool" at line 7
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SectionParseError extends S.TaggedError<SectionParseError, { readonly brand: unique symbol }>(
  $I`SectionParseError`
)(
  "SectionParseError",
  {
    /**
     * Which ambiguity was found.
     *
     * @since 0.0.0
     */
    reason: ScanFailureReason.pipe(
      $I.annoteKey("SectionParseError.reason", { description: "Which ambiguity was found." })
    ),
    /**
     * 1-based line of the offending marker.
     *
     * @since 0.0.0
     */
    line: S.Finite.pipe(
      $I.annoteKey("SectionParseError.line", { description: "1-based line of the offending marker." })
    ),
    /**
     * The section key involved, when the failure names one.
     *
     * @since 0.0.0
     */
    key: S.optionalKey(S.String).pipe(
      $I.annoteKey("SectionParseError.key", { description: "The section key involved, when the failure names one." })
    ),
    /**
     * The file the document came from. Absent for a document parsed from a string.
     *
     * @since 0.0.0
     */
    path: S.optionalKey(S.String).pipe(
      $I.annoteKey("SectionParseError.path", {
        description: "The file the document came from. Absent for a document parsed from a string.",
      })
    ),
  },
  $I.annoteError<SectionParseError>("SectionParseError", {
    description: "Raised when a document's managed-section structure cannot be read without guessing.",
  })
) {
  /**
   * Explains the ambiguity, identifying its section and source location when available.
   *
   * **Example** (Describe an orphaned closing marker)
   *
   * ```ts
   * import { SectionParseError } from "@beep/managed-section/SectionDocument";
   *
   * const error = SectionParseError.make({ reason: "orphanedEnd", line: 3 });
   * console.log(error.message) // End marker closes no open section at line 3
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const where = this.path === undefined ? `line ${this.line}` : `${this.path}:${this.line}`;
    const which = this.key === undefined ? "" : ` for section "${this.key}"`;
    return `${REASON_PROSE[this.reason]}${which} at ${where}`;
  }

  /**
   * The same failure, attributed to a file.
   *
   * **Details**
   *
   * The pure core has no path to report; the service that read the file
   * attaches one on the way out.
   *
   * **Example** (Attribute a parse failure to its file)
   *
   * ```ts
   * import { SectionParseError } from "@beep/managed-section/SectionDocument";
   *
   * const error = SectionParseError.make({ reason: "orphanedEnd", line: 3 });
   * const attributed = SectionParseError.at(error, "config.sh");
   * console.log(attributed.message) // End marker closes no open section at config.sh:3
   * ```
   * @category constructors
   * @since 0.0.0
   */
  static readonly at: {
    (error: SectionParseError, path: string): SectionParseError;
    (path: string): (error: SectionParseError) => SectionParseError;
  } = dual(
    2,
    (error: SectionParseError, path: string): SectionParseError =>
      SectionParseError.make({
        reason: error.reason,
        line: error.line,
        ...optionalKeyOmittedWhenAbsent(error.key),
        path,
      })
  );
}

const REASON_PROSE: Record<ScanFailureReason, string> = {
  unterminatedSection: "Managed section is never closed",
  orphanedEnd: "End marker closes no open section",
  overlappingSections: "Managed section opens inside another",
  duplicateSection: "Managed section appears twice",
};

/**
 * The plain reconciliation result, sharing its schema with the pure core.
 *
 * **Example** (Construct an unchanged reconciliation result)
 *
 * ```ts
 * import { SectionReconciliation } from "@beep/managed-section/SectionDocument";
 *
 * const result = SectionReconciliation.make({ text: "hello", outcomes: [], changed: false });
 * console.log(result.changed) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SectionReconciliation = ReconcileOutput;
/**
 * The text, ordered section outcomes, and change indicator validated by {@link SectionReconciliation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SectionReconciliation = typeof SectionReconciliation.Type;

/**
 * A parsed document: its text, the dialect it was read with, and every
 * managed section found in it.
 *
 * **Details**
 *
 * This is the package's pure core. Parsing, inspection, reconciliation and
 * removal are all string-to-string, so every interesting invariant —
 * idempotency, text preservation, ordering normalization, line-ending
 * handling, marker-injection refusal — is assertable from a string literal
 * with no layer, no runtime and no filesystem.
 *
 * **Example** (Parse a document and reconcile a section)
 *
 * ```ts
 * import { SectionDocument } from "@beep/managed-section/SectionDocument";
 * import { SectionId } from "@beep/managed-section/Section";
 * import { CommentStyle } from "@beep/managed-section/CommentStyle";
 * import * as Result from "effect/Result";
 *
 * const doc = SectionDocument.parseResult("# User preamble\n");
 * const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
 * let changed = false;
 * if (Result.isSuccess(doc)) {
 *   const next = doc.success.reconcile([id.section("echo hello")]);
 *   changed = Result.isSuccess(next) && next.success.changed;
 * }
 * console.log(changed) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SectionDocument extends S.Class<SectionDocument, { readonly brand: unique symbol }>($I`SectionDocument`)(
  {
    /**
     * The document's source text, exactly as parsed.
     *
     * @since 0.0.0
     */
    text: S.String.pipe(
      $I.annoteKey("SectionDocument.text", { description: "The document's source text, exactly as parsed." })
    ),
    /**
     * The marker vocabulary this document was read with.
     *
     * @since 0.0.0
     */
    dialect: SectionDialect.pipe(
      $I.annoteKey("SectionDocument.dialect", { description: "The marker vocabulary this document was read with." })
    ),
    /**
     * Every managed section found, in document order.
     *
     * @since 0.0.0
     */
    sections: S.Array(PlacedSection).pipe(
      $I.annoteKey("SectionDocument.sections", { description: "Every managed section found, in document order." })
    ),
    /**
     * The document's dominant line ending.
     *
     * @since 0.0.0
     */
    eol: Eol.pipe($I.annoteKey("SectionDocument.eol", { description: "The document's dominant line ending." })),
  },
  $I.annote("SectionDocument", {
    description: "A parsed document: its text, the dialect it was read with, and every managed section found in it.",
  })
) {
  /**
   * Parse a document. The synchronous primitive.
   *
   * **Details**
   *
   * Pure computation exposes the sync form as the primitive; {@link SectionDocument.parse}
   * derives from this and adds only the tracing span, so the two cannot drift.
   * Synchronous callers — a lint hook, a build plugin — use this directly and
   * never build an Effect runtime.
   *
   * **Example** (Parse source without an Effect runtime)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import * as Result from "effect/Result";
   *
   * const result = SectionDocument.parseResult("# User preamble\n");
   * console.log(Result.isSuccess(result) && result.success.sections.length) // 0
   * ```
   * @category parsing
   * @since 0.0.0
   */
  static readonly parseResult: {
    (text: string, dialect?: SectionDialect): Result.Result<SectionDocument, SectionParseError>;
    (dialect?: SectionDialect): (text: string) => Result.Result<SectionDocument, SectionParseError>;
  } = dual(
    (args) => P.isString(args[0]),
    (
      text: string,
      dialect: SectionDialect = SectionDialect.default
    ): Result.Result<SectionDocument, SectionParseError> => {
      const scanned = scan(text, dialect);
      if (!scanned.ok) {
        const { reason, line, key } = scanned.failure;
        return Result.fail(
          SectionParseError.make({ reason, line, ...O.getSomesStruct({ key: O.fromUndefinedOr(key) }) })
        );
      }
      return Result.succeed(SectionDocument.make({ text, dialect, sections: scanned.sections, eol: detectEol(text) }));
    }
  );

  /**
   * Parse a document, in `Effect`.
   *
   * **Details**
   *
   * Defined in terms of {@link SectionDocument.parseResult} — synchronous
   * callers can use that variant directly.
   *
   * **Example** (Run document parsing in an Effect)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(SectionDocument.parse("# User preamble\n"));
   * console.log(doc.text === "# User preamble\n") // true
   * ```
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse: {
    (text: string, dialect?: SectionDialect): Effect.Effect<SectionDocument, SectionParseError>;
    (dialect?: SectionDialect): (text: string) => Effect.Effect<SectionDocument, SectionParseError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("SectionDocument.parse")(
      (
        text: string,
        dialect: SectionDialect = SectionDialect.default
      ): Effect.Effect<SectionDocument, SectionParseError> =>
        Effect.fromResult(SectionDocument.parseResult(text, dialect))
    )
  );

  /**
   * The section with this identity, if the document has one.
   *
   * **Example** (Read a section from its rendered markers)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
   * const source = Effect.runSync(Effect.fromResult(SectionDocument.parseResult("")))
   *   .dialect.render(id.section("echo hello"));
   * const text = Effect.runSync(Effect.fromResult(source));
   * const doc = Effect.runSync(SectionDocument.parse(text));
   * console.log(O.getOrUndefined(doc.read(id))?.content) // echo hello
   * ```
   * @category getters
   * @since 0.0.0
   */
  read(id: SectionId): O.Option<Section> {
    const identity = identityOf(id.key, id.commentStyle);
    return O.map(
      A.findFirst(this.sections, (placed) => identityOf(placed.section.key, placed.section.commentStyle) === identity),
      (placed) => placed.section
    );
  }

  /**
   * Whether the document carries a section with this identity.
   *
   * **Example** (Test for an absent section identity)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import * as Effect from "effect/Effect";
   *
   * const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
   * const doc = Effect.runSync(SectionDocument.parse("# User preamble\n"));
   * console.log(doc.has(id)) // false
   * ```
   * @category predicates
   * @since 0.0.0
   */
  has(id: SectionId): boolean {
    return O.isSome(this.read(id));
  }

  /**
   * Compare a declared section against the document, changing nothing.
   *
   * **Details**
   *
   * Total: there is no way for a comparison to fail. Line endings are
   * normalized on both sides, so a CRLF document does not report drift
   * against LF content forever.
   *
   * **Example** (Detect a section missing from a document)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import * as Effect from "effect/Effect";
   *
   * const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
   * const doc = Effect.runSync(SectionDocument.parse(""));
   * console.log(doc.check(id.section("echo hello"))._tag) // Absent
   * ```
   * @category queries
   * @since 0.0.0
   */
  check(section: Section): CheckOutcome {
    const expected = section.withContent(normalizeEol(section.content));
    const current = this.read(section.id);
    if (O.isNone(current)) {
      return CheckOutcome.Absent({ id: section.id });
    }
    return Equal.equals(current.value, expected)
      ? CheckOutcome.UpToDate({ section: current.value })
      : CheckOutcome.Drifted({ onDisk: current.value, expected });
  }

  /**
   * Fit a declared set of sections into this document.
   *
   * **Details**
   *
   * Declared sections come back **in declared order** — the ordering
   * normalization is a guarantee consumers depend on, not a side effect.
   * Text outside a managed span and sections this dialect does not own are
   * preserved byte-for-byte. Nothing is rendered into the output until every
   * declared section has rendered successfully, so a refusal leaves the
   * document untouched.
   *
   * **Example** (Insert a section while preserving the preamble)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import * as Effect from "effect/Effect";
   *
   * const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
   * const doc = Effect.runSync(SectionDocument.parse("# User preamble\n"));
   * const result = Effect.runSync(Effect.fromResult(doc.reconcile([id.section("echo hello")])));
   * console.log(result.changed) // true
   * ```
   * @category combinators
   * @since 0.0.0
   */
  reconcile(sections: ReadonlyArray<Section>): Result.Result<SectionReconciliation, SectionRenderError> {
    return reconcile(
      ReconcileInput.make({
        text: this.text,
        placed: this.sections,
        declared: A.map(sections, (section) => section.withContent(normalizeEol(section.content))),
        dialect: this.dialect,
        eol: this.eol,
      })
    );
  }

  /**
   * The document with this section removed, or `none` if it was not there.
   *
   * **Details**
   *
   * The blank lines around the removed block collapse into a single
   * separator, so repeated removals never accumulate gaps.
   *
   * **Example** (Remove a section and retain surrounding text)
   *
   * ```ts
   * import { SectionDocument } from "@beep/managed-section/SectionDocument";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
   * const doc = Effect.runSync(SectionDocument.parse("# User preamble\n"));
   * const result = Effect.runSync(Effect.fromResult(doc.reconcile([id.section("echo hello")])));
   * const updated = Effect.runSync(SectionDocument.parse(result.text));
   * console.log(O.getOrUndefined(updated.remove(id)) === doc.text) // true
   * ```
   * @category combinators
   * @since 0.0.0
   */
  remove(id: SectionId): O.Option<string> {
    const identity = identityOf(id.key, id.commentStyle);
    const placed = A.findFirst(
      this.sections,
      (candidate) => identityOf(candidate.section.key, candidate.section.commentStyle) === identity
    );
    if (O.isNone(placed)) {
      return O.none();
    }
    const found = placed.value;
    const eol: Eol = this.eol;
    const bom = Str.startsWith("\uFEFF")(this.text) ? "\uFEFF" : "";
    const before = Str.replace(/(?:\r?\n)+$/, "")(Str.slice(bom.length, found.start)(this.text));
    const after = Str.replace(/^(?:\r?\n)+/, "")(Str.slice(found.end)(this.text));
    if (before !== "" && after !== "") {
      return O.some(`${bom}${before}${eol}${eol}${after}`);
    }
    if (before !== "") {
      return O.some(`${bom}${before}${eol}`);
    }
    return O.some(bom + after);
  }
}
