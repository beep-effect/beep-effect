/**
 * The formatting/modification concept: non-mutating text splices (TomlEdit)
 * that conservatively normalize whitespace or change a value at a path, both
 * computed against the linear CST so comments and layout survive every
 * operation. Format is syntactic and structural — every edit derives from an
 * expression or value span, never from naive line splitting, so a byte
 * inside a multi-line string is untouchable by construction. Modify resolves
 * its path through the SEMANTIC view and pins the insertion-placement rules:
 * root inserts land after the last root expression (before the first
 * header), section inserts after the section's last non-trivia expression,
 * dotted tables render as dotted keys appended to their defining section,
 * and inline or implicit tables refuse with a typed error.
 *
 * **Details**
 *
 * Cycle firewall: the engine throws raw carriers (RawTomlError,
 * GuardExceeded); this module materializes TomlDiagnostic instances and the
 * tagged TomlModificationError. The dependency edge runs facade → engine
 * only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TomlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { isGuardExceeded, MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { analyze } from "./internal/semantic.ts";
import { renderInlineValue, renderKey } from "./internal/stringifyValue.ts";
import { TomlDiagnostic, TomlErrorCode } from "./TomlDiagnostic.ts";
import { TomlDocument } from "./TomlDocument.ts";
import { TomlEdit } from "./TomlEdit.ts";
import type { TomlErrorCodeRaw } from "./internal/diagnostics.ts";
import type { TomlParseError } from "./Toml.ts";
import type { TomlPath, TomlRange, TomlSegment } from "./TomlEdit.ts";
import type {
  TomlArray,
  TomlArrayTableHeader,
  TomlExpression,
  TomlInlineEntry,
  TomlInlineTable,
  TomlKeyValue,
  TomlTableHeader,
  TomlTrivia,
  TomlValueNode,
} from "./TomlNode.ts";

const $I = $TomlId.create("TomlFormat");

class TomlFormatInvariantError extends S.TaggedError<
  TomlFormatInvariantError,
  {
    readonly brand: unique symbol;
  }
>($I`TomlFormatInvariantError`)(
  "TomlFormatInvariantError",
  {
    message: S.String.pipe(
      $I.annoteKey("TomlFormatInvariantError.message", {
        description:
          "Explanation of the missing CST node, path segment or splice span required by formatting or modification.",
      })
    ),
  },
  $I.annoteError<TomlFormatInvariantError>("TomlFormatInvariantError", {
    description: "A programmer defect encountered while computing TOML formatting or modification edits.",
  })
) {}

/**
 * A range accepted at the `format`/`formatToString` call sites: either a
 * {@link TomlRange} instance or a plain `{ offset, length }` literal (the two
 * are structurally interchangeable — only `offset`/`length` are read).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlRangeLike =
  | TomlRange
  | {
      readonly offset: number;
      readonly length: number;
    };

/**
 * **Example** (Select CRLF formatting)
 *
 * ```ts
 * import { TomlFormattingOptions } from "@beep/toml/TomlFormat";
 *
 * const options = TomlFormattingOptions.make({ newline: "\r\n" });
 * console.log(JSON.stringify(options.newline)) // "\r\n"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class TomlFormattingOptions extends S.Opaque<
  TomlFormattingOptions,
  {
    readonly brand: unique symbol;
  }
>()(
  S.Struct({
    newline: S.optionalKey(S.Literals(["\n", "\r\n"])).pipe(
      $I.annoteKey("TomlFormattingOptions.newline", {
        description:
          "LF or CRLF used to normalize line endings outside multiline strings during formatting and terminate inserted lines during modification",
      })
    ),
  }).pipe(
    $I.annoteSchema("TomlFormattingOptions", {
      description:
        "Options controlling formatting and modification behavior. The only knob is `newline`: for `format` it normalizes every newline outside multi-line strings; for `modify` it overrides the dominant newline inherited by inserted lines.",
    })
  )
) {}

/**
 * **Example** (Construct a structured modification failure)
 *
 * ```ts
 * import { TomlDiagnostic } from "@beep/toml/TomlDiagnostic";
 * import { TomlModificationError } from "@beep/toml/TomlFormat";
 *
 * const diagnostic = TomlDiagnostic.fromRaw("x = 1\n", {
 *   code: "DottedKeyConflict", message: "missing key", offset: 0, length: 1,
 * });
 * const error = TomlModificationError.make({ diagnostic });
 * console.log(error.diagnostic.code) // DottedKeyConflict
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TomlModificationError extends S.TaggedError<
  TomlModificationError,
  {
    readonly brand: unique symbol;
  }
>($I`TomlModificationError`)(
  "TomlModificationError",
  {
    diagnostic: TomlDiagnostic.pipe(
      $I.annoteKey("TomlModificationError.diagnostic", {
        description:
          "Structured failure detail carrying the code, message and source position explaining why modification failed",
      })
    ),
  },
  $I.annoteError<TomlModificationError>("TomlModificationError", {
    description:
      "Raised when `TomlFormat.modify` cannot resolve the requested path against the document's semantic view, when the insertion target refuses (an inline table or an implicitly created table), or when the replacement value cannot render as TOML. Carries one structured TomlDiagnostic — never a collapsed `reason` string.",
  })
) {
  /**
   * Explains a modification failure with its diagnostic code and message.
   *
   * **Example** (Read the modification failure message)
   *
   * ```ts
   * import { TomlDiagnostic } from "@beep/toml/TomlDiagnostic";
   * import { TomlModificationError } from "@beep/toml/TomlFormat";
   *
   * const diagnostic = TomlDiagnostic.fromRaw("x = 1\n", {
   *   code: "DottedKeyConflict", message: "missing key", offset: 0, length: 1,
   * });
   * const error = TomlModificationError.make({ diagnostic });
   * console.log(error.message) // TOML modification failed: DottedKeyConflict missing key
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `TOML modification failed: ${this.diagnostic.code} ${this.diagnostic.message}`;
  }
}

const TAB = "\t";
const LF = "\n";
const CR = "\r";
const SPACE = " ";
const BANG = "!";
const HASH = "#";
const BOM = "\ufeff";

const isWs = (code: string | undefined): boolean => code === SPACE || code === TAB;

const scanWs: {
  (source: string, pos: number, end: number): number;
  (pos: number, end: number): (source: string) => number;
} = dual(3, (source: string, pos: number, end: number): number => {
  let i = pos;
  while (i < end && isWs(source[i])) {
    i++;
  }
  return i;
});

const scanWsBack: {
  (source: string, pos: number, start: number): number;
  (pos: number, start: number): (source: string) => number;
} = dual(3, (source: string, pos: number, start: number): number => {
  let i = pos;
  while (i > start && isWs(source[i - 1])) {
    i--;
  }
  return i;
});

const dominantNewline = (source: string): "\n" | "\r\n" => {
  let newlines = 0;
  let crlf = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== LF) {
      continue;
    }
    newlines++;
    if (i > 0 && source[i - 1] === CR) {
      crlf++;
    }
  }
  return crlf > newlines - crlf ? "\r\n" : "\n";
};

interface TaggedEdit {
  readonly exprEnd: number;
  readonly exprOffset: number;
  readonly length: number;
  readonly newText: string;
  readonly offset: number;
}

const isMultilineString = (node: TomlValueNode): boolean =>
  P.isTagged(node, "TomlString") && (node.style === "multiline-basic" || node.style === "multiline-literal");

const childValues = (node: TomlValueNode): ReadonlyArray<TomlValueNode> => {
  if (P.isTagged(node, "TomlArray")) {
    return node.items;
  }
  return P.isTagged(node, "TomlInlineTable") ? A.map(node.entries, (entry) => entry.value) : [];
};

const collectProtectedMultilineStringSpans: {
  (node: TomlValueNode, out: Array<readonly [number, number]>): void;
  (out: Array<readonly [number, number]>): (node: TomlValueNode) => void;
} = dual(2, (node: TomlValueNode, out: Array<readonly [number, number]>): void => {
  if (isMultilineString(node)) {
    out.push([node.offset, node.offset + node.length]);
    return;
  }
  for (const child of childValues(node)) {
    collectProtectedMultilineStringSpans(child, out);
  }
});

class NonRedundantFormatEmitter {
  readonly edits: Array<TaggedEdit> = [];
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  readonly push: {
    (expr: TomlExpression, offset: number, length: number, newText: string): void;
    (offset: number, length: number, newText: string): (expr: TomlExpression) => void;
  } = dual(4, (expr: TomlExpression, offset: number, length: number, newText: string): void => {
    if (Str.slice(offset, offset + length)(this.source) !== newText) {
      this.edits.push({
        offset,
        length,
        newText,
        exprOffset: expr.offset,
        exprEnd: expr.offset + expr.length,
      });
    }
  });
}

const skipBom: {
  (source: string, lineStart: number): number;
  (lineStart: number): (source: string) => number;
} = dual(2, (source: string, lineStart: number): number => (lineStart === 0 && source[0] === BOM ? 1 : lineStart));

const formatLeading: {
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression): void;
  (emit: NonRedundantFormatEmitter, expr: TomlExpression): (source: string) => void;
} = dual(3, (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression): void => {
  const start = skipBom(source, expr.offset);
  const end = scanWs(source, start, expr.offset + expr.length);
  if (end > start) {
    emit.push(expr, start, end - start, "");
  }
});

const formatCommentBody: {
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression, bodyStart: number, lineEnd: number): void;
  (emit: NonRedundantFormatEmitter, expr: TomlExpression, bodyStart: number, lineEnd: number): (source: string) => void;
} = dual(
  5,
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression, bodyStart: number, lineEnd: number): void => {
    const bodyEnd = scanWsBack(source, lineEnd, bodyStart);
    if (bodyEnd < lineEnd) {
      emit.push(expr, bodyEnd, lineEnd - bodyEnd, "");
    }
    if (bodyEnd > bodyStart) {
      const code = source[bodyStart];
      if (code !== SPACE && code !== TAB && code !== BANG) {
        emit.push(expr, bodyStart, 0, " ");
      }
    }
  }
);

const newlineStart: {
  (source: string, exprEnd: number, contentEnd: number): number;
  (exprEnd: number, contentEnd: number): (source: string) => number;
} = dual(3, (source: string, exprEnd: number, contentEnd: number): number => {
  let nlStart = exprEnd;
  if (nlStart > contentEnd && source[nlStart - 1] === LF) {
    nlStart -= 1;
    if (nlStart > contentEnd && source[nlStart - 1] === CR) {
      nlStart -= 1;
    }
  }
  return nlStart;
});

const formatTail: {
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression, contentEnd: number): void;
  (emit: NonRedundantFormatEmitter, expr: TomlExpression, contentEnd: number): (source: string) => void;
} = dual(4, (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression, contentEnd: number): void => {
  const nlStart = newlineStart(source, expr.offset + expr.length, contentEnd);
  const boundedTailCommentStart = scanWs(source, contentEnd, nlStart);
  if (boundedTailCommentStart >= nlStart || source[boundedTailCommentStart] !== HASH) {
    if (nlStart > contentEnd) {
      emit.push(expr, contentEnd, nlStart - contentEnd, "");
    }
    return;
  }
  emit.push(expr, contentEnd, boundedTailCommentStart - contentEnd, " ");
  formatCommentBody(source, emit, expr, boundedTailCommentStart + 1, nlStart);
});

const scanLineEnd: {
  (source: string, pos: number, end: number): number;
  (pos: number, end: number): (source: string) => number;
} = dual(3, (source: string, pos: number, end: number): number => {
  let j = pos;
  while (j < end && source[j] !== LF && source[j] !== CR) {
    j++;
  }
  return j;
});

const skipNewline: {
  (source: string, pos: number, end: number): number;
  (pos: number, end: number): (source: string) => number;
} = dual(3, (source: string, pos: number, end: number): number => {
  if (pos >= end) {
    return pos;
  }
  const isCrlf = source[pos] === CR && pos + 1 < end && source[pos + 1] === LF;
  return pos + (isCrlf ? 2 : 1);
});

const formatTriviaLine: {
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlTrivia, start: number, lineEnd: number): void;
  (emit: NonRedundantFormatEmitter, expr: TomlTrivia, start: number, lineEnd: number): (source: string) => void;
} = dual(
  5,
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlTrivia, start: number, lineEnd: number): void => {
    const wsEnd = scanWs(source, start, lineEnd);
    if (wsEnd >= lineEnd) {
      if (lineEnd > start) {
        emit.push(expr, start, lineEnd - start, "");
      }
      return;
    }
    if (wsEnd > start) {
      emit.push(expr, start, wsEnd - start, "");
    }
    formatCommentBody(source, emit, expr, wsEnd + 1, lineEnd);
  }
);

const formatTrivia: {
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlTrivia): void;
  (emit: NonRedundantFormatEmitter, expr: TomlTrivia): (source: string) => void;
} = dual(3, (source: string, emit: NonRedundantFormatEmitter, expr: TomlTrivia): void => {
  const end = expr.offset + expr.length;
  let i = expr.offset;
  while (i < end) {
    const lineEnd = scanLineEnd(source, i, end);
    formatTriviaLine(source, emit, expr, skipBom(source, i), lineEnd);
    i = skipNewline(source, lineEnd, end);
  }
});

const firstSpanEndingAfter: {
  (spans: ReadonlyArray<readonly [number, number]>, p: number, pos: number): number;
  (p: number, pos: number): (spans: ReadonlyArray<readonly [number, number]>) => number;
} = dual(3, (spans: ReadonlyArray<readonly [number, number]>, p: number, pos: number): number => {
  let index = p;
  let span = spans[index];
  while (span !== undefined && span[1] <= pos) {
    index++;
    span = spans[index];
  }
  return index;
});

const normalizeNewlineAt: {
  (
    source: string,
    emit: NonRedundantFormatEmitter,
    expr: TomlExpression,
    i: number,
    end: number,
    target: "\n" | "\r\n"
  ): number;
  (
    emit: NonRedundantFormatEmitter,
    expr: TomlExpression,
    i: number,
    end: number,
    target: "\n" | "\r\n"
  ): (source: string) => number;
} = dual(
  6,
  (
    source: string,
    emit: NonRedundantFormatEmitter,
    expr: TomlExpression,
    i: number,
    end: number,
    target: "\n" | "\r\n"
  ): number => {
    const code = source[i];
    if (code === CR && i + 1 < end && source[i + 1] === LF) {
      if (target === "\n") {
        emit.push(expr, i, 2, "\n");
      }
      return i + 2;
    }
    if (code === LF && target === "\r\n") {
      emit.push(expr, i, 1, "\r\n");
    }
    return i + 1;
  }
);

const normalizeNewlines: {
  (
    source: string,
    emit: NonRedundantFormatEmitter,
    expr: TomlExpression,
    protectedSpans: ReadonlyArray<readonly [number, number]>,
    target: "\n" | "\r\n"
  ): void;
  (
    emit: NonRedundantFormatEmitter,
    expr: TomlExpression,
    protectedSpans: ReadonlyArray<readonly [number, number]>,
    target: "\n" | "\r\n"
  ): (source: string) => void;
} = dual(
  5,
  (
    source: string,
    emit: NonRedundantFormatEmitter,
    expr: TomlExpression,
    protectedSpans: ReadonlyArray<readonly [number, number]>,
    target: "\n" | "\r\n"
  ): void => {
    const end = expr.offset + expr.length;
    let p = 0;
    let i = expr.offset;
    while (i < end) {
      p = firstSpanEndingAfter(protectedSpans, p, i);
      const protectedSpan = protectedSpans[p];
      i =
        protectedSpan !== undefined && i >= protectedSpan[0]
          ? protectedSpan[1]
          : normalizeNewlineAt(source, emit, expr, i, end, target);
    }
  }
);

const headerContentEnd: {
  (source: string, expr: TomlTableHeader | TomlArrayTableHeader): number;
  (expr: TomlTableHeader | TomlArrayTableHeader): (source: string) => number;
} = dual(2, (source: string, expr: TomlTableHeader | TomlArrayTableHeader): number => {
  const lastKey = A.getUnsafe(expr.keyPath, expr.keyPath.length - 1);
  const bracket = scanWs(source, lastKey.offset + lastKey.length, expr.offset + expr.length);
  return bracket + (P.isTagged(expr, "TomlArrayTableHeader") ? 2 : 1);
});

const formatExpressionLayout: {
  (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression): void;
  (emit: NonRedundantFormatEmitter, expr: TomlExpression): (source: string) => void;
} = dual(3, (source: string, emit: NonRedundantFormatEmitter, expr: TomlExpression): void => {
  if (P.isTagged(expr, "TomlTrivia")) {
    formatTrivia(source, emit, expr);
    return;
  }
  formatLeading(source, emit, expr);
  if (P.isTagged(expr, "TomlKeyValue")) {
    const lastKey = A.getUnsafe(expr.keyPath, expr.keyPath.length - 1);
    const keyEnd = lastKey.offset + lastKey.length;
    emit.push(expr, keyEnd, expr.value.offset - keyEnd, " = ");
    formatTail(source, emit, expr, expr.value.offset + expr.value.length);
    return;
  }
  formatTail(source, emit, expr, headerContentEnd(source, expr));
});

const protectedSpansOf = (expr: TomlExpression): ReadonlyArray<readonly [number, number]> => {
  const spans: Array<readonly [number, number]> = [];
  if (P.isTagged(expr, "TomlKeyValue")) {
    collectProtectedMultilineStringSpans(expr.value, spans);
  }
  return spans;
};

const formatFinalNewline: {
  (
    source: string,
    emit: NonRedundantFormatEmitter,
    expressions: ReadonlyArray<TomlExpression>,
    target: "\n" | "\r\n" | undefined
  ): void;
  (
    emit: NonRedundantFormatEmitter,
    expressions: ReadonlyArray<TomlExpression>,
    target: "\n" | "\r\n" | undefined
  ): (source: string) => void;
} = dual(
  4,
  (
    source: string,
    emit: NonRedundantFormatEmitter,
    expressions: ReadonlyArray<TomlExpression>,
    target: "\n" | "\r\n" | undefined
  ): void => {
    if (expressions.length === 0 || source[source.length - 1] === LF) {
      return;
    }
    const last = A.getUnsafe(expressions, expressions.length - 1);
    emit.push(last, source.length, 0, target ?? dominantNewline(source));
  }
);

const computeFormatEdits: {
  (source: string, options: TomlFormattingOptions | undefined): Array<TaggedEdit>;
  (options: TomlFormattingOptions | undefined): (source: string) => Array<TaggedEdit>;
} = dual(2, (source: string, options: TomlFormattingOptions | undefined): Array<TaggedEdit> => {
  const parsed = Result.try(() => parseExpressions(source));
  if (Result.isFailure(parsed)) return [];
  const expressions = parsed.success;
  const emit = new NonRedundantFormatEmitter(source);
  const target = options?.newline;
  for (const expr of expressions) {
    formatExpressionLayout(source, emit, expr);
    if (target !== undefined) {
      normalizeNewlines(source, emit, expr, protectedSpansOf(expr), target);
    }
  }
  formatFinalNewline(source, emit, expressions, target);
  return emit.edits;
});

interface Section {
  readonly header: TomlTableHeader | TomlArrayTableHeader | undefined;
  insertAfter: number | undefined;
}

const ResTableOrigin = LiteralKit(["root", "explicit", "implicit", "dotted", "element"]).pipe(
  $I.annoteSchema("ResTableOrigin", {
    description: "How a resolution table came to exist, determining insertion acceptance and key-path rendering.",
  })
);
type ResTableOrigin = typeof ResTableOrigin.Type;

interface ResTable {
  readonly entries: MutableHashMap.MutableHashMap<string, ResNode>;
  readonly kind: "table";
  origin: ResTableOrigin;
  readonly relPath: ReadonlyArray<string>;
  sectionIndex: number;
}

interface ResArrayTables {
  readonly elements: A.NonEmptyArray<ResTable>;
  readonly kind: "array-tables";
}

interface ResValue {
  readonly expr: TomlKeyValue;
  readonly kind: "value";
  readonly node: TomlValueNode;
}

type ResNode = ResTable | ResArrayTables | ResValue;

const mkTable: {
  (origin: ResTable["origin"], sectionIndex?: number, relPath?: ReadonlyArray<string>): ResTable;
  (sectionIndex?: number, relPath?: ReadonlyArray<string>): (origin: ResTable["origin"]) => ResTable;
} = dual(
  (args) => P.isString(args[0]),
  (origin: ResTable["origin"], sectionIndex = 0, relPath: ReadonlyArray<string> = []): ResTable => ({
    kind: "table",
    origin,
    entries: MutableHashMap.empty<string, ResNode>(),
    sectionIndex,
    relPath,
  })
);

const intoTable = (node: ResNode | undefined): ResTable => {
  if (node !== undefined && node.kind === "array-tables") {
    return A.lastNonEmpty(node.elements);
  }
  if (node !== undefined && node.kind === "table") {
    return node;
  }
  throw TomlFormatInvariantError.make({
    message: "invariant: semantic pass admitted a value where a table was navigated",
  });
};

const buildSemanticIndex = (
  expressions: ReadonlyArray<TomlExpression>
): { readonly root: ResTable; readonly sections: ReadonlyArray<Section> } => {
  const sections: Array<Section> = [
    {
      header: undefined,
      insertAfter: undefined,
    },
  ];
  for (const expr of expressions) {
    if (P.isTagged(expr, "TomlTableHeader") || P.isTagged(expr, "TomlArrayTableHeader")) {
      sections.push({ header: expr, insertAfter: expr.offset + expr.length });
    } else if (!P.isTagged(expr, "TomlTrivia")) {
      const section = A.getUnsafe(sections, sections.length - 1);
      section.insertAfter = expr.offset + expr.length;
    }
  }
  const root = mkTable("root");
  let sectionCounter = 0;
  const navigateHeaderPrefix = (path: ReadonlyArray<string>): ResTable => {
    let current = root;
    for (let i = 0; i < path.length - 1; i++) {
      const name = A.getUnsafe(path, i);
      let child = O.getOrUndefined(MutableHashMap.get(current.entries, name));
      if (child === undefined) {
        child = mkTable("implicit");
        MutableHashMap.set(current.entries, name, child);
      }
      current = intoTable(child);
    }
    return current;
  };
  analyze(expressions, {
    onTableStart: (path, header) => {
      if (header === undefined) {
        return;
      }
      sectionCounter += 1;
      const parent = navigateHeaderPrefix(path);
      const name = A.getUnsafe(path, path.length - 1);
      const existing = O.getOrUndefined(MutableHashMap.get(parent.entries, name));
      if (existing !== undefined && existing.kind === "table") {
        existing.origin = "explicit";
        existing.sectionIndex = sectionCounter;
      } else {
        MutableHashMap.set(parent.entries, name, mkTable("explicit", sectionCounter));
      }
    },
    onArrayTableStart: (path, _index, _header) => {
      sectionCounter += 1;
      const parent = navigateHeaderPrefix(path);
      const name = A.getUnsafe(path, path.length - 1);
      const existing = O.getOrUndefined(MutableHashMap.get(parent.entries, name));
      if (existing !== undefined && existing.kind === "array-tables") {
        existing.elements.push(mkTable("element", sectionCounter));
      } else {
        MutableHashMap.set(parent.entries, name, {
          kind: "array-tables",
          elements: [mkTable("element", sectionCounter)],
        });
      }
    },
    onKeyValue: (path, expr) => {
      const names = A.map(expr.keyPath, (key) => key.value);
      let current = root;
      for (let i = 0; i < path.length - names.length; i++) {
        const name = A.getUnsafe(path, i);
        current = current.entries.pipe(MutableHashMap.get(name), O.getOrUndefined, intoTable);
      }
      for (let j = 0; j < names.length - 1; j++) {
        const name = A.getUnsafe(names, j);
        let child = O.getOrUndefined(MutableHashMap.get(current.entries, name));
        if (child === undefined) {
          child = mkTable("dotted", sectionCounter, names.slice(0, j + 1));
          MutableHashMap.set(current.entries, name, child);
        }
        current = intoTable(child);
      }
      const name = A.getUnsafe(names, names.length - 1);
      MutableHashMap.set(current.entries, name, {
        kind: "value",
        node: expr.value,
        expr,
      });
    },
  });
  return { root, sections };
};

class ModifyFailure extends S.TaggedError<
  ModifyFailure,
  {
    readonly brand: unique symbol;
  }
>($I`ModifyFailure`)(
  "ModifyFailure",
  {
    code: TomlErrorCode.pipe(
      $I.annoteKey("ModifyFailure.code", {
        description: "Diagnostic category explaining why the modification path or target was rejected.",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("ModifyFailure.message", {
        description: "Original path-resolution or modification failure message.",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("ModifyFailure.offset", {
        description: "Starting source position of the rejected target in UTF-16 code units.",
      })
    ),
    len: S.Finite.pipe(
      $I.annoteKey("ModifyFailure.len", { description: "Length of the rejected target span in UTF-16 code units." })
    ),
  },
  $I.annoteError<ModifyFailure>("ModifyFailure", {
    description: "Internal modification failure materialized as a TomlModificationError at the facade boundary.",
  })
) {
  override readonly name = "ModifyFailure";
}

const isModifyFailure = S.is(ModifyFailure);

const failResolve: {
  (code: TomlErrorCodeRaw, message: string, offset?: number, length?: number): never;
  (message: string, offset?: number, length?: number): (code: TomlErrorCodeRaw) => never;
} = dual(
  (args) => P.isString(args[1]),
  (code: TomlErrorCodeRaw, message: string, offset = 0, length = 0): never => {
    throw ModifyFailure.make({ code, message, offset, len: length });
  }
);

const requireIndex: {
  (segment: TomlSegment, what: string, offset: number, length: number): number;
  (what: string, offset: number, length: number): (segment: TomlSegment) => number;
} = dual(4, (segment: TomlSegment, what: string, offset: number, length: number): number => {
  if (!P.isNumber(segment) || !Number.isInteger(segment) || segment < 0) {
    return failResolve(
      "DottedKeyConflict",
      `${what} requires a non-negative integer index, received "${String(segment)}"`,
      offset,
      length
    );
  }
  return segment;
});

interface Candidate {
  readonly entry: TomlInlineEntry;
  readonly index: number;
}

type DeleteTarget =
  | { readonly kind: "expression"; readonly expr: TomlKeyValue }
  | {
      readonly kind: "inline-entry";
      readonly table: TomlInlineTable;
      readonly index: number;
    }
  | {
      readonly kind: "array-item";
      readonly array: TomlArray;
      readonly index: number;
    };

type Cursor =
  | { readonly t: "table"; readonly table: ResTable }
  | { readonly t: "array-tables"; readonly node: ResArrayTables }
  | {
      readonly t: "cst";
      readonly node: TomlValueNode;
      readonly del: DeleteTarget;
    }
  | {
      readonly t: "inline";
      readonly table: TomlInlineTable;
      readonly candidates: ReadonlyArray<Candidate>;
      readonly depth: number;
    };

const cstCursor: {
  (node: TomlValueNode, del: DeleteTarget): Cursor;
  (del: DeleteTarget): (node: TomlValueNode) => Cursor;
} = dual(
  2,
  (node: TomlValueNode, del: DeleteTarget): Cursor =>
    P.isTagged(node, "TomlInlineTable")
      ? {
          t: "inline",
          table: node,
          candidates: A.map(node.entries, (entry, index) => ({ entry, index })),
          depth: 0,
        }
      : { t: "cst", node, del }
);

const stepInline: {
  (
    cur: Extract<Cursor, { t: "inline" }>,
    key: string
  ): {
    readonly matches: ReadonlyArray<Candidate>;
    readonly full: Candidate | undefined;
  };
  (
    key: string
  ): (cur: Extract<Cursor, { t: "inline" }>) => {
    readonly matches: ReadonlyArray<Candidate>;
    readonly full: Candidate | undefined;
  };
} = dual(
  2,
  (
    cur: Extract<Cursor, { t: "inline" }>,
    key: string
  ): {
    readonly matches: ReadonlyArray<Candidate>;
    readonly full: Candidate | undefined;
  } => {
    const matches = A.filter(cur.candidates, (candidate) => candidate.entry.keyPath[cur.depth]?.value === key);
    const first = matches[0];
    const full =
      matches.length === 1 && first !== undefined && first.entry.keyPath.length === cur.depth + 1 ? first : undefined;
    return { matches, full };
  }
);

type InlineCursor = Extract<Cursor, { t: "inline" }>;

const stepTable = (table: ResTable, key: string): Cursor => {
  const child = O.getOrUndefined(MutableHashMap.get(table.entries, key));
  if (child === undefined) {
    return failResolve(
      "DottedKeyConflict",
      `key "${key}" does not resolve — intermediate tables are never auto-created`
    );
  }
  if (child.kind === "table") {
    return { t: "table", table: child };
  }
  if (child.kind === "array-tables") {
    return { t: "array-tables", node: child };
  }
  return cstCursor(child.node, { kind: "expression", expr: child.expr });
};

const stepArrayTables = (node: ResArrayTables, segment: TomlSegment): Cursor => {
  const idx = requireIndex(segment, "an array of tables", 0, 0);
  if (idx >= node.elements.length) {
    return failResolve("DottedKeyConflict", `array-of-tables index ${idx} is out of bounds`);
  }
  const table = A.getUnsafe(node.elements, idx);
  return { t: "table", table };
};

const stepInlineScope = (cur: InlineCursor, key: string): Cursor => {
  const { matches, full } = stepInline(cur, key);
  if (matches.length === 0) {
    return failResolve(
      "DottedKeyConflict",
      `key "${key}" does not resolve in the inline table`,
      cur.table.offset,
      cur.table.length
    );
  }
  if (full !== undefined) {
    return cstCursor(full.entry.value, {
      kind: "inline-entry",
      table: cur.table,
      index: full.index,
    });
  }
  return {
    t: "inline",
    table: cur.table,
    candidates: matches,
    depth: cur.depth + 1,
  };
};

const stepCst = (node: TomlValueNode, segment: TomlSegment): Cursor => {
  if (!P.isTagged(node, "TomlArray")) {
    return failResolve("DottedKeyConflict", "cannot navigate through a scalar value", node.offset, node.length);
  }
  const idx = requireIndex(segment, "an array", node.offset, node.length);
  if (idx >= node.items.length) {
    return failResolve("DottedKeyConflict", `array index ${idx} is out of bounds`, node.offset, node.length);
  }
  const item = A.getUnsafe(node.items, idx);
  return cstCursor(item, { kind: "array-item", array: node, index: idx });
};

const step: {
  (cur: Cursor, segment: TomlSegment): Cursor;
  (segment: TomlSegment): (cur: Cursor) => Cursor;
} = dual(2, (cur: Cursor, segment: TomlSegment): Cursor => {
  if (cur.t === "table") {
    return stepTable(cur.table, String(segment));
  }
  if (cur.t === "array-tables") {
    return stepArrayTables(cur.node, segment);
  }
  if (cur.t === "inline") {
    return stepInlineScope(cur, String(segment));
  }
  return stepCst(cur.node, segment);
});

interface RawEdit {
  readonly length: number;
  readonly newText: string;
  readonly offset: number;
}

interface ModifyContext {
  readonly nl: "\n" | "\r\n";
  readonly sections: ReadonlyArray<Section>;
  readonly source: string;
}

const spliceArrayItem: {
  (array: TomlArray, index: number): RawEdit;
  (index: number): (array: TomlArray) => RawEdit;
} = dual(2, (array: TomlArray, index: number): RawEdit => {
  const items = array.items;
  if (items.length === 1) {
    return { offset: array.offset + 1, length: array.length - 2, newText: "" };
  }
  const current = A.getUnsafe(items, index);
  if (index < items.length - 1) {
    const next = A.getUnsafe(items, index + 1);
    return {
      offset: current.offset,
      length: next.offset - current.offset,
      newText: "",
    };
  }
  const previous = A.getUnsafe(items, index - 1);
  const prevEnd = previous.offset + previous.length;
  return {
    offset: prevEnd,
    length: current.offset + current.length - prevEnd,
    newText: "",
  };
});

const spliceInlineEntry: {
  (table: TomlInlineTable, index: number): RawEdit;
  (index: number): (table: TomlInlineTable) => RawEdit;
} = dual(2, (table: TomlInlineTable, index: number): RawEdit => {
  const entries = table.entries;
  if (entries.length === 1) {
    return { offset: table.offset + 1, length: table.length - 2, newText: "" };
  }
  const current = A.getUnsafe(entries, index);
  if (index < entries.length - 1) {
    const next = A.getUnsafe(entries, index + 1);
    return {
      offset: current.offset,
      length: next.offset - current.offset,
      newText: "",
    };
  }
  const previous = A.getUnsafe(entries, index - 1);
  const prevEnd = previous.offset + previous.length;
  return {
    offset: prevEnd,
    length: current.offset + current.length - prevEnd,
    newText: "",
  };
});

const rootInsertOffset = (ctx: ModifyContext): number => {
  const firstHeader = ctx.sections[1]?.header;
  const section = A.getUnsafe(ctx.sections, 0);
  return section.insertAfter ?? firstHeader?.offset ?? 0;
};

const sectionInsertOffset = (ctx: ModifyContext, sectionIndex: number): number => {
  const section = A.getUnsafe(ctx.sections, sectionIndex);
  return O.getOrThrow(O.fromUndefinedOr(section.insertAfter));
};

const insertEdit: {
  (table: ResTable, key: string, value: unknown, ctx: ModifyContext): RawEdit;
  (key: string, value: unknown, ctx: ModifyContext): (table: ResTable) => RawEdit;
} = dual(4, (table: ResTable, key: string, value: unknown, ctx: ModifyContext): RawEdit => {
  if (table.origin === "implicit") {
    return failResolve(
      "DottedKeyConflict",
      "the table was created implicitly by a longer header and has no section of its own to insert into"
    );
  }
  const keyPath = table.origin === "dotted" ? [...table.relPath, key] : [key];
  const line = `${pipe(keyPath, A.map(renderKey), A.join("."))} = ${renderInlineValue(value)}`;
  const offset = table.sectionIndex === 0 ? rootInsertOffset(ctx) : sectionInsertOffset(ctx, table.sectionIndex);
  const needLeading = offset > 0 && ctx.source[offset - 1] !== LF;
  return {
    offset,
    length: 0,
    newText: `${needLeading ? ctx.nl : ""}${line}${ctx.nl}`,
  };
});

const deleteTableValue = (key: string, existing: ResNode | undefined): Array<RawEdit> => {
  if (existing === undefined) {
    return [];
  }
  if (existing.kind !== "value") {
    return failResolve("DottedKeyConflict", `"${key}" is a table section, not a deletable value`);
  }
  return [
    {
      offset: existing.expr.offset,
      length: existing.expr.length,
      newText: "",
    },
  ];
};

const terminalTable = (table: ResTable, key: string, value: unknown, ctx: ModifyContext): Array<RawEdit> => {
  const existing = O.getOrUndefined(MutableHashMap.get(table.entries, key));
  if (value === undefined) {
    return deleteTableValue(key, existing);
  }
  if (existing === undefined) {
    return [insertEdit(table, key, value, ctx)];
  }
  if (existing.kind !== "value") {
    return failResolve("DottedKeyConflict", `"${key}" is already defined as a table and cannot become a value`);
  }
  return [
    {
      offset: existing.node.offset,
      length: existing.node.length,
      newText: renderInlineValue(value),
    },
  ];
};

const terminalArrayTables = (node: ResArrayTables, segment: TomlSegment, value: unknown): Array<RawEdit> => {
  const idx = requireIndex(segment, "an array of tables", 0, 0);
  const inBounds = idx < node.elements.length;
  if (value === undefined && !inBounds) {
    return [];
  }
  return failResolve(
    "DottedKeyConflict",
    inBounds
      ? `array-of-tables element ${idx} is a table section, not an addressable value`
      : `array-of-tables index ${idx} is out of bounds`
  );
};

const requireFullEntry = (cur: InlineCursor, key: string, full: Candidate | undefined): Candidate => {
  if (full === undefined) {
    return failResolve(
      "DottedKeyConflict",
      `"${key}" is a dotted-key group inside an inline table, not a single entry`,
      cur.table.offset,
      cur.table.length
    );
  }
  return full;
};

const terminalInline = (cur: InlineCursor, key: string, value: unknown): Array<RawEdit> => {
  const { matches, full } = stepInline(cur, key);
  if (value === undefined) {
    return matches.length === 0 ? [] : [spliceInlineEntry(cur.table, requireFullEntry(cur, key, full).index)];
  }
  if (matches.length === 0) {
    return failResolve(
      "InlineTableExtended",
      `inline table cannot be extended with new key "${key}"`,
      cur.table.offset,
      cur.table.length
    );
  }
  const entry = requireFullEntry(cur, key, full).entry;
  return [
    {
      offset: entry.value.offset,
      length: entry.value.length,
      newText: renderInlineValue(value),
    },
  ];
};

const terminalCst = (node: TomlValueNode, segment: TomlSegment, value: unknown): Array<RawEdit> => {
  if (!P.isTagged(node, "TomlArray")) {
    return failResolve("DottedKeyConflict", "cannot address a key beneath a scalar value", node.offset, node.length);
  }
  const idx = requireIndex(segment, "an array", node.offset, node.length);
  const inBounds = idx < node.items.length;
  if (value === undefined) {
    return inBounds ? [spliceArrayItem(node, idx)] : [];
  }
  if (!inBounds) {
    return failResolve(
      "DottedKeyConflict",
      `array index ${idx} is out of bounds — modify never appends array elements`,
      node.offset,
      node.length
    );
  }
  const item = A.getUnsafe(node.items, idx);
  return [
    {
      offset: item.offset,
      length: item.length,
      newText: renderInlineValue(value),
    },
  ];
};

const terminal: {
  (cur: Cursor, segment: TomlSegment, value: unknown, ctx: ModifyContext): Array<RawEdit>;
  (segment: TomlSegment, value: unknown, ctx: ModifyContext): (cur: Cursor) => Array<RawEdit>;
} = dual(4, (cur: Cursor, segment: TomlSegment, value: unknown, ctx: ModifyContext): Array<RawEdit> => {
  if (cur.t === "table") {
    return terminalTable(cur.table, String(segment), value, ctx);
  }
  if (cur.t === "array-tables") {
    return terminalArrayTables(cur.node, segment, value);
  }
  if (cur.t === "inline") {
    return terminalInline(cur, String(segment), value);
  }
  return terminalCst(cur.node, segment, value);
});

/**
 * Formats TOML text and modifies values at a path as byte-minimal edits that
 * leave comments and layout elsewhere untouched. Not instantiable.
 *
 * **Details**
 *
 * `format`/`formatToString` are pure and total: malformed input yields no
 * edits rather than corrupting the document, and every edit derives from an
 * expression or value span, so bytes inside multi-line strings are
 * untouchable by construction. `modify`/`modifyToString` carry a real error
 * channel — {@link TomlParseError} when the source does not parse and
 * {@link TomlModificationError} for path-resolution and insertion-target
 * failures — and every document they produce reparses cleanly.
 *
 * **Example** (Format TOML and modify a value while preserving comments)
 *
 * ```ts
 * import { TomlFormat } from "@beep/toml/TomlFormat";
 * import * as Effect from "effect/Effect";
 *
 * const formatted = TomlFormat.formatToString('  title="x"   #note\n[server]\nport=1');
 * console.log(JSON.stringify(formatted)) // "title = \"x\" # note\n[server]\nport = 1\n"
 *
 * const program = Effect.gen(function* () {
 *   return yield* TomlFormat.modifyToString("[server]\nport = 1 # dev\n", ["server", "port"], 2);
 * });
 * console.log(JSON.stringify(Effect.runSync(program))) // "[server]\nport = 2 # dev\n"
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export class TomlFormat {
  private constructor() {}

  /**
   * Computes conservative whitespace edits while preserving TOML values and layout.
   *
   * **Details**
   *
   * The edits produce one space around `=`, leading
   * indentation stripped, trailing whitespace stripped with one space before
   * a trailing `#`, one space after a non-empty `#` (unless it starts with
   * space, tab or an exclamation mark), a single final newline, and — when
   * `options.newline` is set — every newline normalized outside multi-line
   * strings. Nothing else: no reordering, no blank-line collapsing, no value
   * rewriting. `range` restricts edits to the expressions intersecting it.
   * Non-mutating — apply with `TomlEdit.applyAll` (or use
   * {@link TomlFormat.formatToString}). Pure and total.
   *
   * **Example** (Apply conservative whitespace edits)
   *
   * ```ts
   * import { TomlEdit } from "@beep/toml/TomlEdit";
   * import { TomlFormat } from "@beep/toml/TomlFormat";
   *
   * const source = "x=1";
   * const edits = TomlFormat.format(source);
   * console.log(JSON.stringify(TomlEdit.applyAll(source, edits))) // "x = 1\n"
   * ```
   *
   * @param text - The TOML source to format.
   * @param range - Optional sub-range; only edits whose expression intersects
   *   it are returned.
   * @param options - Optional {@link TomlFormattingOptions}.
   * @returns The edits that bring `text` (or `range`) to canonical shape;
   *   apply them with `TomlEdit.applyAll`.
   * @category formatting
   * @since 0.0.0
   */
  static readonly format: {
    (text: string, range?: TomlRangeLike, options?: TomlFormattingOptions): ReadonlyArray<TomlEdit>;
    (range?: TomlRangeLike, options?: TomlFormattingOptions): (text: string) => ReadonlyArray<TomlEdit>;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: TomlRangeLike, options?: TomlFormattingOptions): ReadonlyArray<TomlEdit> => {
      const tagged = computeFormatEdits(text, options);
      const filtered =
        range === undefined
          ? tagged
          : A.filter(
              tagged,
              (edit) => Math.max(edit.exprOffset, range.offset) <= Math.min(edit.exprEnd, range.offset + range.length)
            );
      return A.map(filtered, (edit) =>
        TomlEdit.make({
          offset: edit.offset,
          length: edit.length,
          content: edit.newText,
        })
      );
    }
  );

  /**
   * Format `text` and apply the resulting edits in one step
   * (`TomlEdit.applyAll ∘ format`). Pure and total.
   *
   * **Example** (Format a document in one step)
   *
   * ```ts
   * import { TomlFormat } from "@beep/toml/TomlFormat";
   *
   * console.log(JSON.stringify(TomlFormat.formatToString("x=1"))) // "x = 1\n"
   * ```
   *
   * @param text - The TOML source to format.
   * @param range - Optional sub-range; only edits whose expression intersects
   *   it are applied.
   * @param options - Optional {@link TomlFormattingOptions}.
   * @returns The formatted text.
   * @category formatting
   * @since 0.0.0
   */
  static readonly formatToString: {
    (text: string, range?: TomlRangeLike, options?: TomlFormattingOptions): string;
    (range?: TomlRangeLike, options?: TomlFormattingOptions): (text: string) => string;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: TomlRangeLike, options?: TomlFormattingOptions): string =>
      TomlEdit.applyAll(text, TomlFormat.format(text, range, options))
  );

  /**
   * Computes edits that replace, delete, or insert a value at a path resolved
   * through the document's semantic view.
   *
   * **Details**
   *
   * Every segment but the
   * last must resolve — intermediate tables are never auto-created. A
   * `value` of `undefined` deletes: a key-value's whole line, an inline
   * entry, or an array item, splicing separators. A new key inserts per the
   * pinned placement rules: root keys land after the last root expression
   * (before the first header), section keys after the section's last
   * expression, dotted-table keys as dotted keys appended to the defining
   * section; inline and implicitly created tables refuse. Inserted lines
   * inherit the document's dominant newline unless `options.newline`
   * overrides it. Every modified document reparses cleanly.
   *
   * **Example** (Apply a value replacement without changing its comment)
   *
   * ```ts
   * import { TomlEdit } from "@beep/toml/TomlEdit";
   * import { TomlFormat } from "@beep/toml/TomlFormat";
   * import * as Effect from "effect/Effect";
   *
   * const source = "x = 1 # keep\n";
   * const edits = Effect.runSync(TomlFormat.modify(source, ["x"], 2));
   * console.log(JSON.stringify(TomlEdit.applyAll(source, edits))) // "x = 2 # keep\n"
   * ```
   *
   * @param text - The TOML source to modify.
   * @param path - The location to set, replace or delete.
   * @param value - The plain JavaScript value to write; `undefined` deletes the
   *   target instead.
   * @param options - Optional {@link TomlFormattingOptions}; `newline` overrides
   *   the newline used for inserted lines.
   * @returns An `Effect` that succeeds with the edits to apply (via
   *   `TomlEdit.applyAll`), or fails with {@link TomlParseError} when the
   *   source does not parse, or {@link TomlModificationError} when `path`
   *   cannot be resolved or the insertion target is not allowed.
   * @category formatting
   * @since 0.0.0
   */
  static readonly modify: {
    (
      text: string,
      path: TomlPath,
      value: unknown,
      options?: TomlFormattingOptions
    ): Effect.Effect<Array<TomlEdit>, TomlParseError | TomlModificationError>;
    (
      path: TomlPath,
      value: unknown,
      options?: TomlFormattingOptions
    ): (text: string) => Effect.Effect<Array<TomlEdit>, TomlParseError | TomlModificationError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("TomlFormat.modify")(function* (
      text: string,
      path: TomlPath,
      value: unknown,
      options?: TomlFormattingOptions
    ) {
      const failWith: {
        (code: TomlErrorCodeRaw, message: string, offset?: number, length?: number): TomlModificationError;
        (message: string, offset?: number, length?: number): (code: TomlErrorCodeRaw) => TomlModificationError;
      } = dual(
        (args) => P.isString(args[1]),
        (code: TomlErrorCodeRaw, message: string, offset = 0, length = 0): TomlModificationError =>
          TomlModificationError.make({
            diagnostic: TomlDiagnostic.fromRaw(text, {
              code,
              message,
              offset,
              length,
            }),
          })
      );
      if (path.length === 0) {
        return yield* failWith("DottedKeyConflict", "an empty path does not address a value");
      }
      if (path.length > MAX_NESTING_DEPTH) {
        return yield* failWith(
          "NestingDepthExceeded",
          `path depth ${path.length} exceeds the ${MAX_NESTING_DEPTH} cap`
        );
      }
      const doc = yield* TomlDocument.parse(text);
      const diagnostic = doc.diagnostics[0];
      if (diagnostic !== undefined) {
        return yield* TomlModificationError.make({ diagnostic });
      }
      const { root, sections } = buildSemanticIndex(doc.expressions);
      const ctx: ModifyContext = {
        source: text,
        sections,
        nl: options?.newline ?? dominantNewline(text),
      };
      const raw = yield* Effect.try({
        try: () => {
          let cursor: Cursor = { t: "table", table: root };
          for (let i = 0; i < path.length - 1; i++) {
            const segment = path[i];
            if (segment === undefined) {
              throw TomlFormatInvariantError.make({ message: "missing TOML path segment" });
            }
            cursor = step(cursor, segment);
          }
          const segment = path[path.length - 1];
          if (segment === undefined) {
            throw TomlFormatInvariantError.make({ message: "missing TOML path segment" });
          }
          return terminal(cursor, segment, value, ctx);
        },
        catch: (defect) => {
          if (isModifyFailure(defect)) {
            return failWith(defect.code, defect.message, defect.offset, defect.len);
          }
          if (isRawTomlError(defect)) {
            return TomlModificationError.make({ diagnostic: TomlDiagnostic.fromRaw(text, defect.diagnostic) });
          }
          if (isGuardExceeded(defect)) {
            return failWith("NestingDepthExceeded", defect.message, defect.offset);
          }
          throw defect;
        },
      });
      return A.map(raw, (edit) =>
        TomlEdit.make({
          offset: edit.offset,
          length: edit.length,
          content: edit.newText,
        })
      );
    })
  );

  /**
   * Modify `text` and apply the resulting edits in one step
   * (`TomlEdit.applyAll ∘ modify`).
   *
   * **Example** (Delete a key-value line)
   *
   * ```ts
   * import { TomlFormat } from "@beep/toml/TomlFormat";
   * import * as Effect from "effect/Effect";
   *
   * const program = TomlFormat.modifyToString("x = 1\ny = 2\n", ["x"], undefined);
   * console.log(JSON.stringify(Effect.runSync(program))) // "y = 2\n"
   * ```
   *
   * @param text - The TOML source to modify.
   * @param path - The location to set, replace or delete.
   * @param value - The plain JavaScript value to write; `undefined` deletes the
   *   target instead.
   * @param options - Optional {@link TomlFormattingOptions}.
   * @returns An `Effect` that succeeds with the modified text, or fails with
   *   {@link TomlParseError} or {@link TomlModificationError}, as
   *   {@link TomlFormat.modify} does.
   * @category formatting
   * @since 0.0.0
   */
  static readonly modifyToString: {
    (
      text: string,
      path: TomlPath,
      value: unknown,
      options?: TomlFormattingOptions
    ): Effect.Effect<string, TomlParseError | TomlModificationError>;
    (
      path: TomlPath,
      value: unknown,
      options?: TomlFormattingOptions
    ): (text: string) => Effect.Effect<string, TomlParseError | TomlModificationError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("TomlFormat.modifyToString")(function* (
      text: string,
      path: TomlPath,
      value: unknown,
      options?: TomlFormattingOptions
    ) {
      const edits = yield* TomlFormat.modify(text, path, value, options);
      return TomlEdit.applyAll(text, edits);
    })
  );
}
