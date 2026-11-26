/**
 * Canonical YAML output normalisation helpers shared across compliance test
 * suites. The yaml-test-suite's `out.yaml` fixtures follow libyaml's canonical
 * conventions, which differ slightly from a direct `stringifyDocument` result;
 * these helpers bridge the gap without leaking convention knowledge into the
 * library proper.
 */

import { YamlMap, YamlScalar, YamlSeq } from "@beep/yaml/YamlNode";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import type { RawYamlDocument } from "@beep/yaml/internal/raw-document";

const DQ_SHORT_ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  '"': '\\"',
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

const DQ_CONTROL_ESCAPES = R.fromEntries(
  A.makeBy(0x20, (code) => [String.fromCharCode(code), `\\x${Str.padStart(2, "0")(code.toString(16))}`])
);

function escapeDoubleQuotedCodeUnit(ch: string): string {
  const short = DQ_SHORT_ESCAPES[ch];
  if (short !== undefined) return short;
  return DQ_CONTROL_ESCAPES[ch] ?? ch;
}

function renderSingleLineDoubleQuoted(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += escapeDoubleQuotedCodeUnit(s[i] ?? "");
  }
  return `"${out}"`;
}

interface SingleDocContext {
  readonly doc: RawYamlDocument;
  readonly output: string;
  readonly root: RawYamlDocument["contents"];
  readonly source: string;
}

type SingleDocRule = (ctx: SingleDocContext) => string | undefined;

const isYamlScalar = Schema.is(YamlScalar);
const isYamlSeq = Schema.is(YamlSeq);
const isYamlMap = Schema.is(YamlMap);

const isNonEmpty = (value: string | undefined): boolean => value !== undefined && value !== "";

const isBlockScalarStyle = (style: YamlScalar["style"]): boolean =>
  style === "block-literal" || style === "block-folded";

const reservedDirectiveOwnLineStart: SingleDocRule = ({ doc, output, root, source }) =>
  isYamlScalar(root) &&
  !isNonEmpty(root.tag) &&
  !isNonEmpty(root.anchor) &&
  doc.hasDocumentStart &&
  hasReservedDirective(doc) &&
  hadDocStartOnOwnLine(source) &&
  Str.startsWith("--- ")(output)
    ? `---\n${Str.slice(4)(output)}`
    : undefined;

const explicitIndentBlockSeqStart: SingleDocRule = ({ output, root, source }) =>
  isYamlSeq(root) &&
  root.style === "block" &&
  hasExplicitIndentInMapValue(root, source) &&
  !Str.startsWith("---")(output)
    ? `---\n${output}`
    : undefined;

const flowMapIndicatorKeyStart: SingleDocRule = ({ output, root, source }) =>
  isYamlMap(root) && sourceHasFlowAtRoot(source) && !Str.startsWith("---")(output) && /^[?][A-Za-z]/.test(output)
    ? `---\n${output}`
    : undefined;

const isolatedFlowColonStart: SingleDocRule = ({ output, root, source }) =>
  (isYamlMap(root) || isYamlSeq(root)) && sourceHasFlowWithIsolatedColon(source) && !Str.startsWith("---")(output)
    ? `---\n${output}`
    : undefined;

const foldedTrailingBlanksDrop: SingleDocRule = ({ output, root, source }) =>
  isYamlScalar(root) &&
  root.style === "block-folded" &&
  typeof root.value === "string" &&
  !Str.includes("\n")(Str.replace(/\n$/, "")(root.value)) &&
  sourceHasMultipleTrailingBlanks(source) &&
  Str.startsWith("--- >")(output)
    ? Str.slice(4)(output)
    : undefined;

type ScalarRootRule = (root: YamlScalar, output: string, firstAfter: string) => string | undefined;

const tabbedBlockScalarToDoubleQuoted: ScalarRootRule = (root, _output, firstAfter) =>
  (firstAfter === "|" || firstAfter === ">") &&
  typeof root.value === "string" &&
  /\n\t/.test(root.value) &&
  isBlockScalarStyle(root.style)
    ? `${renderSingleLineDoubleQuoted(root.value)}\n`
    : undefined;

const singleQuotedDashesDrop: ScalarRootRule = (root, output, firstAfter) =>
  firstAfter === "'" &&
  typeof root.value === "string" &&
  !Str.includes("\n")(root.value) &&
  Str.startsWith("---")(root.value)
    ? Str.slice(4)(output)
    : undefined;

const plainSafeDoubleQuotedUnquote: ScalarRootRule = (root, output) =>
  root.style === "double-quoted" &&
  root.sourceMultiline === true &&
  typeof root.value === "string" &&
  !Str.includes("\n")(root.value) &&
  isPlainSafe(root.value)
    ? `--- ${root.value}${Str.endsWith("\n")(output) ? "\n" : ""}`
    : undefined;

const multiLineQuotedDrop: ScalarRootRule = (root, output, firstAfter) =>
  typeof root.value === "string" && Str.includes("\n")(root.value) && (firstAfter === "'" || firstAfter === '"')
    ? Str.slice(4)(output)
    : undefined;

// decision: canonical-normalizer-emulates-libyaml
const SCALAR_ROOT_RULES: ReadonlyArray<ScalarRootRule> = [
  tabbedBlockScalarToDoubleQuoted,
  singleQuotedDashesDrop,
  plainSafeDoubleQuotedUnquote,
  multiLineQuotedDrop,
];

const scalarRootCanonical: SingleDocRule = ({ output, root }) => {
  if (!isYamlScalar(root) || !Str.startsWith("--- ")(output)) return undefined;
  const firstAfter = output[4] ?? "";
  for (const rule of SCALAR_ROOT_RULES) {
    const rewritten = rule(root, output, firstAfter);
    if (rewritten !== undefined) return rewritten;
  }
  return undefined;
};

// decision: canonical-normalizer-emulates-libyaml
const SINGLE_DOC_RULES: ReadonlyArray<SingleDocRule> = [
  reservedDirectiveOwnLineStart,
  explicitIndentBlockSeqStart,
  flowMapIndicatorKeyStart,
  isolatedFlowColonStart,
  foldedTrailingBlanksDrop,
  scalarRootCanonical,
];

/**
 * Apply canonical single-doc conventions: libyaml's canonical emitter
 * differs from a direct `stringifyDocument` in several cases. See the decision
 * `canonical-normalizer-emulates-libyaml` for the fixture IDs behind each rule.
 */
export function applySingleDocCanonical(output: string, doc: RawYamlDocument, source: string): string;
export function applySingleDocCanonical(doc: RawYamlDocument, source: string): (output: string) => string;
export function applySingleDocCanonical(
  ...args: [output: string, doc: RawYamlDocument, source: string] | [doc: RawYamlDocument, source: string]
): string | ((output: string) => string) {
  return dual<
    (
      ...args: [output: string, doc: RawYamlDocument, source: string] | [doc: RawYamlDocument, source: string]
    ) => string | ((output: string) => string),
    (output: string, doc: RawYamlDocument, source: string) => string
  >(3, function applySingleDocCanonical(output: string, doc: RawYamlDocument, source: string): string {
    const ctx: SingleDocContext = { doc, output, root: doc.contents, source };
    for (const rule of SINGLE_DOC_RULES) {
      const rewritten = rule(ctx);
      if (rewritten !== undefined) return rewritten;
    }
    return output;
  })(...args);
}

/**
 * Apply canonical multi-doc conventions on top of the joined per-doc output.
 */
export function applyMultiDocCanonical(output: string, docs: ReadonlyArray<RawYamlDocument>): string;
export function applyMultiDocCanonical(docs: ReadonlyArray<RawYamlDocument>): (output: string) => string;
export function applyMultiDocCanonical(
  ...args: [output: string, docs: ReadonlyArray<RawYamlDocument>] | [docs: ReadonlyArray<RawYamlDocument>]
): string | ((output: string) => string) {
  return dual<
    (
      ...args: [output: string, docs: ReadonlyArray<RawYamlDocument>] | [docs: ReadonlyArray<RawYamlDocument>]
    ) => string | ((output: string) => string),
    (output: string, docs: ReadonlyArray<RawYamlDocument>) => string
  >(2, function applyMultiDocCanonical(output: string, docs: ReadonlyArray<RawYamlDocument>): string {
    let result = output;

    // decision: canonical-normalizer-emulates-libyaml
    if (
      docs.length >= 2 &&
      A.every(docs, (d) => d.hasDocumentStart) &&
      A.some(docs, (d) => A.some(d.directives, (dir) => dir.name === "TAG" && dir.parameters[0] === "!"))
    ) {
      const segments = splitMultiDocOutput(result, docs);
      if (segments !== null) {
        result = A.join(
          A.map(segments, (segment, idx) => {
            const doc = docs[idx];
            if (doc === undefined || doc.contents === null) return segment;
            return splitDocStartFromTaggedScalar(segment);
          }),
          ""
        );
      }
    }

    if (docs.length >= 2) {
      const last = docs[docs.length - 1];
      if (
        last !== undefined &&
        last.contents === null &&
        last.hasDocumentStart &&
        !last.hasDocumentEnd &&
        A.some(docs.slice(0, -1), (d) => d.contents !== null) &&
        Str.endsWith("---\n")(result)
      ) {
        result = `${result}...\n`;
      }
    }

    return result;
  })(...args);
}

function splitMultiDocOutput(output: string, docs: ReadonlyArray<RawYamlDocument>): string[] | null {
  const segments: string[] = [];
  let pos = 0;
  const documentStart = /---/g;
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (doc === undefined) return null;
    const isLast = i === docs.length - 1;
    if (isLast) {
      segments.push(Str.slice(pos)(output));
      break;
    }
    documentStart.lastIndex = pos + 3;
    const next = documentStart.exec(output);
    if (next === null) return null;
    segments.push(Str.slice(pos, next.index)(output));
    pos = next.index;
  }
  return segments;
}

function splitDocStartFromTaggedScalar(segment: string): string {
  const verbatimMatch = O.getOrNull(Str.match(/^(---) (!<[^>]+>) (.*)$/m)(segment));
  if (verbatimMatch !== null) {
    const [whole, dashes, tag, rest] = verbatimMatch;
    return Str.replace(whole, `${dashes} ${tag}\n${rest}`)(segment);
  }
  const shorthandMatch = O.getOrNull(Str.match(/^(---) (![^ \n]+) (.*)$/m)(segment));
  if (shorthandMatch !== null) {
    const [whole, dashes, tag, rest] = shorthandMatch;
    return Str.replace(whole, `${dashes}\n${tag} ${rest}`)(segment);
  }
  return segment;
}

function hasReservedDirective(doc: RawYamlDocument): boolean {
  return A.some(doc.directives, (d) => d.name !== "YAML" && d.name !== "TAG");
}

function hadDocStartOnOwnLine(source: string): boolean {
  const lines = Str.split("\n")(source);
  for (const line of lines) {
    if (line === "---") return true;
    if (Str.startsWith("--- ")(line) && line.length > 4) return false;
  }
  return false;
}

function hasExplicitIndentInMapValue(seq: YamlSeq, source: string): boolean {
  return A.some(
    seq.items,
    (item) => isYamlMap(item) && A.some(item.items, (pair) => isExplicitIndentBlockScalar(pair.value, source))
  );
}

function isExplicitIndentBlockScalar(value: unknown, source: string): boolean {
  if (!isYamlScalar(value) || !isBlockScalarStyle(value.style)) return false;
  const region = Str.slice(value.offset, value.offset + Math.min(value.length, 6))(source);
  return /^[|>][1-9]/.test(region);
}

function sourceHasFlowAtRoot(source: string): boolean {
  const lines = Str.split("\n")(source);
  for (const line of lines) {
    const trimmed = Str.replace(/^\s+/, "")(line);
    if (trimmed === "" || Str.startsWith("#")(trimmed) || trimmed === "---" || Str.startsWith("%")(trimmed)) {
      continue;
    }
    return Str.startsWith("{")(trimmed) || Str.startsWith("[")(trimmed);
  }
  return false;
}

function sourceHasFlowWithIsolatedColon(source: string): boolean {
  const flowOpen = O.getOrElse(constant(-1))(Str.search(/[{[]/)(source));
  if (flowOpen < 0) return false;
  const scan: FlowColonScan = { depth: 0, escapeNext: false, inFlow: false, inString: false, stringCh: "", text: "" };
  for (let i = flowOpen; i < source.length; i++) {
    if (stepFlowColonScan(scan, source[i] ?? "")) return true;
  }
  return false;
}

interface FlowColonScan {
  depth: number;
  escapeNext: boolean;
  inFlow: boolean;
  inString: boolean;
  stringCh: string;
  text: string;
}

function stepFlowColonScan(scan: FlowColonScan, ch: string): boolean {
  if (scan.inString) {
    stepQuotedFlowChar(scan, ch);
    appendFlowText(scan, ch);
    return false;
  }
  if (ch === '"' || ch === "'") {
    scan.inString = true;
    scan.stringCh = ch;
    appendFlowText(scan, ch);
    return false;
  }
  if (ch === "{" || ch === "[") {
    scan.depth++;
    scan.inFlow = true;
  }
  appendFlowText(scan, ch);
  return (ch === "}" || ch === "]") && closeFlowCollection(scan);
}

function stepQuotedFlowChar(scan: FlowColonScan, ch: string): void {
  if (scan.escapeNext) {
    scan.escapeNext = false;
  } else if (ch === "\\" && scan.stringCh === '"') {
    scan.escapeNext = true;
  } else if (ch === scan.stringCh) {
    scan.inString = false;
  }
}

function appendFlowText(scan: FlowColonScan, ch: string): void {
  if (scan.inFlow) scan.text += ch;
}

function closeFlowCollection(scan: FlowColonScan): boolean {
  scan.depth--;
  if (scan.depth !== 0) return false;
  if (/\n[ \t]*:[ \t]*\n/.test(scan.text)) return true;
  scan.inFlow = false;
  scan.text = "";
  return false;
}

function sourceHasMultipleTrailingBlanks(source: string): boolean {
  const m = O.getOrNull(Str.match(/\n+$/)(source));
  return m !== null && m[0].length >= 3;
}

const PLAIN_UNSAFE_FIRST_CHARS = "?:-{}[],#&*!|>'\"%@`";

function isPlainSafe(s: string): boolean {
  if (s.length === 0) return false;
  if (/^[ \t]|[ \t]$/.test(s)) return false;
  if (Str.includes(s[0] ?? "")(PLAIN_UNSAFE_FIRST_CHARS)) return false;
  const parsesAsKeyOrComment = /:(?: |$)/.test(s) || Str.includes(" #")(s);
  return !parsesAsKeyOrComment;
}
