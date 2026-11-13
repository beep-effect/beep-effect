#!/usr/bin/env bun
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
/** Artifact contract v15. Direct TypeScript lowering preserves check order and diagnostics.
 * Run with bun; The local semantics namespace preserves dynamic YAML and regex behavior.
 * Source provenance: validate_artifacts.py at the parent commit; all former self-tests are retained.
 */
import * as RuntimeFs from "node:fs";
import * as RuntimeOs from "node:os";
import * as RuntimeCrypto from "node:crypto";
import { spawnSync as runtimeSpawnSync } from "node:child_process";
import * as RuntimePath from "effect/Path";
import * as RuntimeEffect from "effect/Effect";
import * as RuntimeYAML from "yaml";
/** The validation consumer receives the same nullable repo operand as the original CLI. */
export const ValidationOptions = S.Struct({ gate: S.Boolean, repo: S.NullOr(S.String) });
export type ValidationOptions = typeof ValidationOptions.Type;
const ArgumentBoundary = S.TaggedUnion({
  Validate: { root: S.String, gate: S.Boolean, repo: S.Option(S.String) },
  SelfTest: {},
  PrintRunId: { root: S.String },
  Usage: { message: S.String, stderr: S.Boolean },
});

/** Inject only the CLI's side effects; tests can stop at the validation boundary. */
export interface ArgumentBoundaryHandlers {
  readonly validate: (root: string, options: ValidationOptions) => void;
  readonly selfTest: () => void;
  readonly printRunId: (root: string) => number;
  readonly writeUsage: (message: string, stderr: boolean) => void;
}

/** Dispatch arguments without reading ontology artifacts.
 * **Example** (Missing operand)
 * A trailing --repo returns status 2 through writeUsage and never calls validate.
 */
export function runArgumentBoundary(
  args: readonly string[],
  usage: string,
  handlers: ArgumentBoundaryHandlers
): number | undefined {
  const first = O.getOrUndefined(A.head(args));
  const repoIndex = args.indexOf("--repo");
  const parsed =
    first === "--self-test"
      ? ArgumentBoundary.cases.SelfTest.make({})
      : first === "--print-run-id"
        ? args.length === 2
          ? ArgumentBoundary.cases.PrintRunId.make({ root: args[1] ?? "" })
          : ArgumentBoundary.cases.Usage.make({ message: "usage: --print-run-id <ontology-root>", stderr: true })
        : first === undefined
          ? ArgumentBoundary.cases.Usage.make({ message: usage, stderr: false })
          : repoIndex >= 0 && repoIndex + 1 >= args.length
            ? ArgumentBoundary.cases.Usage.make({ message: "usage: --repo requires a repository path", stderr: true })
            : ArgumentBoundary.cases.Validate.make({
                root: first,
                gate: args.includes("--gate"),
                repo: repoIndex >= 0 ? O.fromUndefinedOr(args[repoIndex + 1]) : O.none(),
              });
  return ArgumentBoundary.match(parsed, {
    SelfTest: () => {
      handlers.selfTest();
      return 0;
    },
    PrintRunId: ({ root }) => handlers.printRunId(root),
    Usage: ({ message, stderr }) => {
      handlers.writeUsage(message, stderr);
      return 2;
    },
    Validate: ({ root, gate, repo }) => {
      handlers.validate(root, { gate, repo: O.getOrNull(repo) });
      return undefined;
    },
  });
}

/** Escape C0/C1 authority controls while preserving ordinary and already-escaped text.
 * **Example** (Terminal controls)
 * escapeAuthorityText("evidence\nFORGED") returns "evidence\\x0aFORGED".
 */
export const escapeAuthorityText = (value: string): string =>
  A.join(
    A.map(A.fromIterable(value), (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && !(code >= 0x7f && code <= 0x9f) ? character : `\\x${code.toString(16).padStart(2, "0")}`;
    }),
    ""
  );
/** Render one flag through the shared authority-text escape boundary. */
export const renderFlag = (value: string): string => `FLAGGED - ${escapeAuthorityText(value)}`;
/** Render one violation through the shared authority-text escape boundary. */
export const renderDiagnostic = (value: string): string => ` - ${escapeAuthorityText(value)}`;
/** Render a manifest-read failure without allowing it to forge terminal output. */
export const renderUnreadableManifest = (value: string): string =>
  `refusing: manifest unreadable (${escapeAuthorityText(value)})`;

/** Write the escaped read failure to the stderr channel of an injected sink. */
export function reportUnreadableManifest(value: string, write: (message: string, stderr: boolean) => void): void {
  write(renderUnreadableManifest(value), true);
}

namespace rt {
  const Fs = RuntimeFs;
  const Os = RuntimeOs;
  const Crypto = RuntimeCrypto;
  const Path = RuntimePath;
  const Effect = RuntimeEffect;
  const YAML = RuntimeYAML;
  const spawnSync = runtimeSpawnSync;
  /** Data semantics for the direct TypeScript artifact-contract port.
   * Values remain unknown until the corresponding original contract checks their shape.
   * This module does not evaluate source code or invoke Python.
   */
  const path = Effect.runSync(Path.Path.pipe(Effect.provide(Path.layer)));
  type Kwargs = Readonly<Record<string, unknown>>;
  type Body = (args: readonly unknown[], kwargs: Kwargs) => unknown;
  class Callable {
    constructor(
      readonly name: string,
      readonly body: Body
    ) {}
  }
  class TypeToken {
    constructor(readonly name: string) {}
  }
  class Slice {
    constructor(
      readonly start: unknown,
      readonly end: unknown,
      readonly step: unknown
    ) {}
  }
  class Tuple extends Array<unknown> {}
  export function tuple(values: unknown): unknown {
    const result = new Tuple();
    result.push(...iter(values));
    return result;
  }
  class Dict {
    readonly pairs: [unknown, unknown][] = [];
    constructor(pairs: readonly (readonly [unknown, unknown])[] = []) {
      for (const [key, value] of pairs) this.put(key, value);
    }
    get(key: unknown, fallback: unknown = null): unknown {
      const pair = this.pairs.find(([k]) => equal(k, key));
      return pair ? pair[1] : fallback;
    }
    has(key: unknown) {
      return this.pairs.some(([k]) => equal(k, key));
    }
    put(key: unknown, value: unknown) {
      const i = this.pairs.findIndex(([k]) => equal(k, key));
      if (i < 0) this.pairs.push([key, value]);
      else this.pairs[i] = [key, value];
    }
    delete(key: unknown) {
      const i = this.pairs.findIndex(([k]) => equal(k, key));
      if (i >= 0) this.pairs.splice(i, 1);
    }
  }
  class ValueSet {
    readonly values: unknown[] = [];
    constructor(items: readonly unknown[] = []) {
      for (const x of items) this.add(x);
    }
    add(x: unknown) {
      if (!this.has(x)) this.values.push(x);
    }
    has(x: unknown) {
      return this.values.some((y) => equal(x, y));
    }
  }
  function lexicalPath(value: string): string {
    const parts = value.split("/").filter((p) => p !== "" && p !== ".");
    return (value.startsWith("/") ? "/" : "") + parts.join("/") || ".";
  }
  class FilePath {
    readonly value: string;
    constructor(value: unknown) {
      this.value = value instanceof FilePath ? value.value : lexicalPath(text(value));
    }
    toString() {
      return this.value;
    }
  }
  class Pattern {
    constructor(
      readonly source: string,
      readonly flags = 0
    ) {}
  }
  class RegexMatch {
    constructor(readonly found: RegExpExecArray) {}
  }
  class Hash {
    constructor(readonly value: RuntimeCrypto.Hash) {}
  }
  class Capture {
    value = "";
  }
  class Context {
    constructor(
      readonly value: unknown,
      readonly close: () => void
    ) {}
  }
  class Module {
    constructor(readonly name: string) {}
  }
  class Status {
    constructor(
      readonly stdout: unknown,
      readonly returncode: number,
      readonly stderr: unknown
    ) {}
  }
  class PythonError extends Error {
    constructor(
      readonly category: string,
      message: string
    ) {
      super(message);
    }
  }
  class SystemExit {
    constructor(readonly code: unknown) {}
  }
  class IsoDate {
    constructor(readonly value: string) {}
  }
  const captures: Capture[] = [];
  export const skip = Symbol("filtered comprehension");
  export const fn = (name: string, body: Body): unknown => new Callable(name, body);
  export const bytes = (values: readonly number[]) => Buffer.from(values);
  export const slice = (start: unknown, end: unknown, step: unknown) => new Slice(start, end, step);
  export const entry = (key: unknown, value: unknown) => [key, value];
  export const set = (values: unknown) => new ValueSet(iter(values));
  export function dict(pairs: unknown): unknown {
    const out = new Dict();
    for (const pair of iter(pairs)) {
      const [key, value] = iter(pair);
      out.put(key, value);
    }
    return out;
  }
  export function argument(args: readonly unknown[], kwargs: Kwargs, index: number, name: string, fallback: unknown) {
    return name in kwargs ? kwargs[name] : index < args.length ? args[index] : fallback;
  }
  export function call(value: unknown, args: readonly unknown[] = [], kwargs: Kwargs = {}): unknown {
    if (value instanceof Callable) return value.body(args, kwargs);
    return fail("TypeError", `not callable: ${repr(value)}`);
  }
  export function iter(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value instanceof Dict) return value.pairs.map(([k]) => k);
    if (value instanceof ValueSet) return value.values;
    if (typeof value === "string") return [...value];
    if (Buffer.isBuffer(value)) return [...value];
    if (value === null || value === undefined) return fail("TypeError", "'NoneType' object is not iterable");
    return fail("TypeError", `not iterable: ${repr(value)}`);
  }
  export function comprehend(value: unknown, visit: (item: unknown) => unknown): unknown[] {
    return iter(value).flatMap((x) => {
      const result = visit(x);
      return result === skip ? [] : [result];
    });
  }
  export function truth(value: unknown): boolean {
    if (value === null || value === undefined || value === false || value === 0 || value === "") return false;
    if (Array.isArray(value) || Buffer.isBuffer(value)) return value.length > 0;
    if (value instanceof Dict) return value.pairs.length > 0;
    if (value instanceof ValueSet) return value.values.length > 0;
    return true;
  }
  export const and = (value: unknown, next: () => unknown) => (truth(value) ? next() : value);
  export const or = (value: unknown, next: () => unknown) => (truth(value) ? value : next());
  export const neg = (value: unknown) => -number(value);
  function decimalText(value: string): string {
    return value.replace(/\p{Nd}/gu, (character) => {
      const code = character.codePointAt(0) ?? 0;
      let start = code;
      while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
      return `${(code - start) % 10}`;
    });
  }
  function number(value: unknown): number {
    return typeof value === "number"
      ? value
      : typeof value === "boolean"
        ? Number(value)
        : Number(decimalText(text(value)));
  }
  function text(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "None";
    if (value === true) return "True";
    if (value === false) return "False";
    if (value instanceof FilePath) return value.value;
    if (value instanceof IsoDate) return value.value;
    if (value instanceof Error) {
      if ("code" in value && "path" in value && typeof value.path === "string") {
        const codes: Record<string, readonly [number, string]> = {
          ENOENT: [2, "No such file or directory"],
          EACCES: [13, "Permission denied"],
          ELOOP: [40, "Too many levels of symbolic links"],
          ENAMETOOLONG: [36, "File name too long"],
          ENOTDIR: [20, "Not a directory"],
          EISDIR: [21, "Is a directory"],
        };
        const known = codes[String(value.code)];
        if (known) return `[Errno ${known[0]}] ${known[1]}: ${pyString(value.path)}`;
      }
      return value.message;
    }
    if (Buffer.isBuffer(value)) return repr(value);
    return repr(value);
  }
  function pyString(value: string) {
    let quote = "'";
    if (value.includes("'") && !value.includes('"')) quote = '"';
    return (
      quote +
      [...value]
        .map((c) =>
          c === quote
            ? "\\" + c
            : c === "\\"
              ? "\\\\"
              : c === "\n"
                ? "\\n"
                : c === "\r"
                  ? "\\r"
                  : c === "\t"
                    ? "\\t"
                    : c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127
                      ? `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`
                      : c
        )
        .join("") +
      quote
    );
  }
  function repr(value: unknown): string {
    if (value === null || value === undefined) return "None";
    if (typeof value === "string") return pyString(value);
    if (typeof value === "number") return `${value}`;
    if (typeof value === "boolean") return value ? "True" : "False";
    if (value instanceof Tuple) return `(${value.map(repr).join(", ")}${value.length === 1 ? "," : ""})`;
    if (Array.isArray(value)) return `[${value.map(repr).join(", ")}]`;
    if (value instanceof Dict) return `{${value.pairs.map(([k, v]) => `${repr(k)}: ${repr(v)}`).join(", ")}}`;
    if (value instanceof ValueSet) return value.values.length ? `{${value.values.map(repr).join(", ")}}` : "set()";
    if (value instanceof FilePath) return `PosixPath(${pyString(value.value)})`;
    if (Buffer.isBuffer(value)) return "b" + pyString(value.toString("latin1"));
    if (value instanceof IsoDate) return value.value;
    if (value instanceof Error) {
      if ("code" in value && "path" in value && typeof value.path === "string") {
        const codes: Record<string, readonly [number, string]> = {
          ENOENT: [2, "No such file or directory"],
          EACCES: [13, "Permission denied"],
          ELOOP: [40, "Too many levels of symbolic links"],
          ENAMETOOLONG: [36, "File name too long"],
          ENOTDIR: [20, "Not a directory"],
          EISDIR: [21, "Is a directory"],
        };
        const known = codes[String(value.code)];
        if (known) return `[Errno ${known[0]}] ${known[1]}: ${pyString(value.path)}`;
      }
      return value.message;
    }
    if (value instanceof Callable) return `<function ${value.name}>`;
    if (value instanceof TypeToken) return `<class '${value.name}'>`;
    return String(value);
  }
  export function format(value: unknown, conversion: unknown, spec: unknown): string {
    if (spec === "02x") return number(value).toString(16).padStart(2, "0");
    return conversion === 114 ? repr(value) : text(value);
  }
  function equal(a: unknown, b: unknown): boolean {
    if ((a instanceof TypeToken && b instanceof Callable) || (a instanceof Callable && b instanceof TypeToken))
      return a.name === b.name;
    if (
      a === b ||
      ((typeof a === "boolean" || typeof a === "number") &&
        (typeof b === "boolean" || typeof b === "number") &&
        number(a) === number(b))
    )
      return true;
    if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
    if (Array.isArray(a) && Array.isArray(b))
      return a instanceof Tuple === b instanceof Tuple && a.length === b.length && a.every((x, i) => equal(x, b[i]));
    if (a instanceof Dict && b instanceof Dict)
      return a.pairs.length === b.pairs.length && a.pairs.every(([k, v]) => b.has(k) && equal(v, b.get(k)));
    if (a instanceof ValueSet && b instanceof ValueSet)
      return a.values.length === b.values.length && a.values.every((x) => b.has(x));
    if (a instanceof FilePath && b instanceof FilePath) return a.value === b.value;
    if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return a.equals(b);
    return false;
  }
  function contains(container: unknown, value: unknown): boolean {
    if (container instanceof Dict) return container.has(value);
    if (container instanceof ValueSet) return container.has(value);
    if (typeof container === "string") return container.includes(text(value));
    return iter(container).some((x) => equal(x, value));
  }
  function ordering(a: unknown, b: unknown): number {
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const result = ordering(a[i], b[i]);
        if (result) return result;
      }
      return a.length - b.length;
    }
    if (a instanceof FilePath && b instanceof FilePath) return ordering(a.value.split("/"), b.value.split("/"));
    if (a instanceof IsoDate && b instanceof IsoDate) return ordering(a.value, b.value);
    if (typeof a === "number" && typeof b === "number") return a - b;
    const left = [...text(a)],
      right = [...text(b)];
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const delta = (left[i]?.codePointAt(0) ?? 0) - (right[i]?.codePointAt(0) ?? 0);
      if (delta) return delta;
    }
    return left.length - right.length;
  }
  export function compare(operator: string, a: unknown, b: unknown): boolean {
    if (operator === "eq") return equal(a, b);
    if (operator === "ne") return !equal(a, b);
    if (operator === "is")
      return (
        a === b ||
        ((a === null || a === undefined) && (b === null || b === undefined)) ||
        (a instanceof TypeToken && b instanceof Callable && a.name === b.name)
      );
    if (operator === "isnot") return !compare("is", a, b);
    if (operator === "in") return contains(b, a);
    if (operator === "notin") return !contains(b, a);
    const c = ordering(a, b);
    return operator === "lt" ? c < 0 : operator === "le" ? c <= 0 : operator === "gt" ? c > 0 : c >= 0;
  }
  export function op(operator: string, a: unknown, b: unknown): unknown {
    if (operator === "div" && a instanceof FilePath)
      return new FilePath(path.isAbsolute(text(b)) ? text(b) : a.value.replace(/\/$/, "") + "/" + text(b));
    if (operator === "union") return new ValueSet([...iter(a), ...iter(b)]);
    if (operator === "sub" && a instanceof ValueSet) return new ValueSet(a.values.filter((x) => !contains(b, x)));
    if (operator === "mul") {
      if (typeof a === "string") return a.repeat(number(b));
      if (Array.isArray(a)) return Array.from({ length: number(b) }, () => a).flat();
      return number(a) * number(b);
    }
    if (operator === "add") {
      if (typeof a === "string" || typeof b === "string") return text(a) + text(b);
      if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
      if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return Buffer.concat([a, b]);
      return number(a) + number(b);
    }
    return operator === "sub" ? number(a) - number(b) : number(a) / number(b);
  }
  export function item(value: unknown, key: unknown): unknown {
    if (value instanceof Dict) {
      if (!value.has(key)) return fail("KeyError", repr(key));
      return value.get(key);
    }
    if (key instanceof Slice) {
      const values = typeof value === "string" ? [...value] : iter(value);
      const start = key.start === undefined || key.start === null ? undefined : number(key.start),
        end = key.end === undefined || key.end === null ? undefined : number(key.end);
      const result = values.slice(start, end);
      return typeof value === "string"
        ? result.join("")
        : Buffer.isBuffer(value)
          ? Buffer.from(result.map(number))
          : value instanceof Tuple
            ? tuple(result)
            : result;
    }
    const values = typeof value === "string" ? [...value] : iter(value);
    const n = number(key),
      i = n < 0 ? values.length + n : n;
    if (i < 0 || i >= values.length) return fail("IndexError", "list index out of range");
    return values[i];
  }
  export function setItem(value: unknown, key: unknown, next: unknown): void {
    if (value instanceof Dict) {
      value.put(key, next);
      return;
    }
    if (Array.isArray(value)) {
      if (key instanceof Slice) {
        const start = key.start == null ? 0 : number(key.start);
        const end = key.end == null ? value.length : number(key.end);
        value.splice(start, end - start, ...iter(next));
        return;
      }
      const i = number(key);
      value[i < 0 ? value.length + i : i] = next;
      return;
    }
    fail("TypeError", "item assignment unsupported");
  }
  export function deleteItem(value: unknown, key: unknown): void {
    if (value instanceof Dict) {
      value.delete(key);
      return;
    }
    if (Array.isArray(value)) {
      if (key instanceof Slice) {
        const start = key.start == null ? 0 : number(key.start);
        const end = key.end == null ? value.length : number(key.end);
        value.splice(start, end - start);
      } else value.splice(number(key), 1);
      return;
    }
    fail("TypeError", "item deletion unsupported");
  }
  function fail(category: string, message: string): never {
    throw new PythonError(category, message);
  }
  export function assert(value: unknown, message: unknown) {
    if (!truth(value)) fail("AssertionError", text(message));
  }
  export function catches(error: unknown, types: unknown): boolean {
    if (Array.isArray(types)) return types.some((t) => catches(error, t));
    const name = types instanceof TypeToken ? types.name : types instanceof Callable ? types.name : text(types);
    if (name === "Exception") return !(error instanceof SystemExit);
    if (error instanceof PythonError)
      return (
        error.category === name || (name === "OSError" && ["FileNotFoundError", "OSError"].includes(error.category))
      );
    if (error instanceof Error && "code" in error)
      return name === "OSError" || name === "RuntimeError" || (name === "FileNotFoundError" && error.code === "ENOENT");
    return false;
  }
  export function enter(value: unknown): Context {
    if (value instanceof Context) return value;
    return fail("TypeError", "not a context manager");
  }
  export const module = (name: string) => new Module(name);
  function trim(value: string, chars: unknown, side: "left" | "right" | "both") {
    if (chars === null || chars === undefined)
      return side === "left" ? value.trimStart() : side === "right" ? value.trimEnd() : value.trim();
    const allowed = new Set([...text(chars)]);
    let start = 0,
      end = value.length;
    if (side !== "right") while (start < end && allowed.has(value[start] ?? "")) start++;
    if (side !== "left") while (end > start && allowed.has(value[end - 1] ?? "")) end--;
    return value.slice(start, end);
  }
  function regex(source: unknown, flags = 0, mode = "search") {
    let pattern = source instanceof Pattern ? source.source : text(source);
    flags |= source instanceof Pattern ? source.flags : 0;
    pattern = pattern.replaceAll("\\Z", "(?![\\s\\S])");
    if (pattern.startsWith("(?i)")) {
      flags |= 2;
      pattern = pattern.slice(4);
    }
    if (mode === "match") pattern = `^(?:${pattern})`;
    if (mode === "fullmatch") pattern = `^(?:${pattern})(?![\\s\\S])`;
    let translated = "",
      inClass = false;
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i] ?? "";
      if (c === "\\") {
        const next = pattern[++i] ?? "";
        if (next === "w") translated += inClass ? "\\p{L}\\p{N}_" : "[\\p{L}\\p{N}_]";
        else if (next === "d") translated += "\\p{Nd}";
        else if (next === "b" && !inClass)
          translated += "(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))";
        else if (next === '"' || next === "'") translated += next;
        else translated += "\\" + next;
      } else {
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        translated += c;
      }
    }
    return new RegExp(translated, "u" + (flags & 2 ? "i" : "") + (flags & 8 ? "m" : "") + (flags & 16 ? "s" : ""));
  }
  function match(source: unknown, value: unknown, flags = 0, mode = "search") {
    const result = regex(source, flags, mode).exec(text(value));
    return result ? new RegexMatch(result) : null;
  }
  function clone(value: unknown): unknown {
    if (value instanceof Dict) return new Dict(value.pairs.map(([k, v]) => [clone(k), clone(v)]));
    if (value instanceof ValueSet) return new ValueSet(value.values.map(clone));
    if (value instanceof Tuple) return tuple(value.map(clone));
    if (Array.isArray(value)) return value.map(clone);
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    return value;
  }
  function fromNative(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(fromNative);
    if (value instanceof Date) return new IsoDate(value.toISOString());
    if (value && typeof value === "object") return new Dict(Object.entries(value).map(([k, v]) => [k, fromNative(v)]));
    return value;
  }
  function toNative(value: unknown, sort = false): unknown {
    if (value instanceof Dict) {
      const pairs = sort ? value.pairs.toSorted(([a], [b]) => ordering(a, b)) : value.pairs;
      return Object.fromEntries(pairs.map(([k, v]) => [text(k), toNative(v, sort)]));
    }
    if (Array.isArray(value)) return value.map((v) => toNative(v, sort));
    return value;
  }
  function yamlLoad(value: unknown): unknown {
    const data = Buffer.isBuffer(value) ? value.toString("utf8") : text(value);
    const doc = YAML.parseDocument(data, { schema: "yaml-1.1", uniqueKeys: false });
    const visit = (node: unknown): void => {
      if (YAML.isMap(node)) {
        const seen = new ValueSet();
        for (const pair of node.items) {
          const key = YAML.isScalar(pair.key) ? pair.key.value : null;
          if (seen.has(key)) {
            const offset = node.range?.[0] ?? 0;
            const line = data.slice(0, offset).split("\n").length;
            fail(
              "_DupKeyError",
              `duplicate mapping key ${repr(key)} (line ${line}) — last-wins YAML lets two verdicts share one file; refused`
            );
          }
          seen.add(key);
          visit(pair.value);
        }
      } else if (YAML.isSeq(node)) for (const child of node.items) visit(child);
    };
    visit(doc.contents);
    if (doc.errors.length) fail("ValueError", doc.errors.map((e) => e.message).join("\n"));
    return fromNative(doc.toJS());
  }
  function iso(value: unknown, dateOnly = false): IsoDate {
    const input = text(value);
    let dateLength = 0,
      year = 0,
      month = 0,
      day = 0;
    const calendar = /^(\d{4})(?:-(\d{2})-(\d{2})|(\d{2})(\d{2}))/.exec(input);
    const week = /^(\d{4})(?:-W(\d{2})(?:-(\d))?|W(\d{2})(\d)?)/.exec(input);
    const makeDate = (y: number, m: number, d: number) => {
      const result = new Date(0);
      result.setUTCFullYear(y, m - 1, d);
      result.setUTCHours(0, 0, 0, 0);
      return result;
    };
    if (calendar) {
      dateLength = calendar[0].length;
      year = Number(calendar[1]);
      month = Number(calendar[2] ?? calendar[4]);
      day = Number(calendar[3] ?? calendar[5]);
      const date = makeDate(year, month, day);
      if (year < 1 || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day)
        fail("ValueError", "date/time value out of range");
    } else if (week) {
      dateLength = week[0].length;
      year = Number(week[1]);
      const w = Number(week[2] ?? week[4]),
        d = Number(week[3] ?? week[5] ?? 1),
        jan4 = makeDate(year, 1, 4),
        weekday = jan4.getUTCDay() || 7;
      const result = new Date(jan4.getTime() + ((w - 1) * 7 + d - weekday) * 86400000);
      const check = new Date(result.getTime() + (4 - (result.getUTCDay() || 7)) * 86400000);
      if (year < 1 || w < 1 || w > 53 || d < 1 || d > 7 || check.getUTCFullYear() !== year)
        fail("ValueError", "Invalid week date");
      month = result.getUTCMonth() + 1;
      day = result.getUTCDate();
    } else return fail("ValueError", `Invalid isoformat string: ${repr(input)}`);
    const rest = input.slice(dateLength);
    if (!rest) return new IsoDate(input);
    if (dateOnly) return fail("ValueError", `Invalid isoformat string: ${repr(input)}`);
    const time = [...rest].slice(1).join("");
    const zoneIndex = time.search(/[Z+-]/),
      clock = zoneIndex < 0 ? time : time.slice(0, zoneIndex),
      zone = zoneIndex < 0 ? "" : time.slice(zoneIndex);
    const validClock = (raw: string) => {
      const split = raw.split(/[.,]/);
      if (split.length > 2 || (split[1] !== undefined && !/^\d+$/.test(split[1]))) return false;
      const base = split[0] ?? "",
        parts = base.includes(":") ? base.split(":") : (base.match(/.{1,2}/g) ?? []);
      return (
        parts.length >= 1 &&
        parts.length <= 3 &&
        parts.every((p) => /^\d{2}$/.test(p)) &&
        Number(parts[0]) < 24 &&
        Number(parts[1] ?? 0) < 60 &&
        Number(parts[2] ?? 0) < 60
      );
    };
    if (!validClock(clock) || (zone && zone !== "Z" && (!/^[+-]/.test(zone) || !validClock(zone.slice(1)))))
      return fail("ValueError", "date/time value out of range");
    return new IsoDate(input);
  }
  function resolveFile(input: string, strict = false): string {
    const absolute = path.isAbsolute(input) ? input : process.cwd() + "/" + input,
      parts = absolute.split("/").filter(Boolean);
    let current = "/",
      links = 0;
    while (parts.length) {
      const part = parts.shift() ?? "";
      if (part === ".") continue;
      if (part === "..") {
        current = path.dirname(current);
        continue;
      }
      const next = path.join(current, part);
      let stat: RuntimeFs.Stats | undefined;
      try {
        stat = Fs.lstatSync(next);
      } catch (e) {
        if (e instanceof Error && "code" in e && e.code === "ENOENT" && !strict) {
          current = next;
          continue;
        }
        throw e;
      }
      if (stat?.isSymbolicLink()) {
        if (++links > 40) fail("OSError", "Too many levels of symbolic links");
        const target = Fs.readlinkSync(next);
        if (target.startsWith("/")) current = "/";
        parts.unshift(...target.split("/").filter(Boolean));
      } else current = next;
    }
    return current;
  }
  function pathCall(file: FilePath, name: string, args: readonly unknown[], kw: Kwargs): unknown {
    const value = file.value;
    if (name === "resolve") return new FilePath(resolveFile(value, truth(kw.strict)));
    if (name === "relative_to") {
      const rel = path.relative(text(args[0]), value);
      if (rel.startsWith("../") || path.isAbsolute(rel)) fail("ValueError", "path is not in the subpath");
      return new FilePath(rel);
    }
    if (name === "is_symlink") return Fs.lstatSync(value, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
    if (name === "is_file") return Fs.statSync(value, { throwIfNoEntry: false })?.isFile() ?? false;
    if (name === "is_dir") return Fs.statSync(value, { throwIfNoEntry: false })?.isDirectory() ?? false;
    if (name === "read_bytes") return Fs.readFileSync(value);
    if (name === "read_text") return Fs.readFileSync(value, "utf8");
    if (name === "write_text" || name === "write_bytes") {
      const bytes = Buffer.isBuffer(args[0]) ? args[0] : text(args[0]);
      Fs.writeFileSync(value, bytes);
      return Buffer.byteLength(bytes);
    }
    if (name === "mkdir") {
      Fs.mkdirSync(value, { recursive: truth(kw.parents) });
      return null;
    }
    if (name === "symlink_to") {
      Fs.symlinkSync(text(args[0]), value);
      return null;
    }
    if (name === "glob" || name === "rglob") {
      if (!Fs.existsSync(value)) return [];
      const pattern = text(args[0]),
        glob = new Bun.Glob(name === "rglob" ? `**/${pattern}` : pattern);
      return [...glob.scanSync({ cwd: value, onlyFiles: false, dot: true, followSymlinks: false })].map(
        (p) => new FilePath(path.join(value, p))
      );
    }
    return fail("AttributeError", `Path.${name}`);
  }
  export function attr(value: unknown, name: string): unknown {
    if (value instanceof Module) return moduleAttr(value.name, name);
    if (value instanceof TypeToken && name === "__name__") return value.name;
    if (value instanceof FilePath) {
      if (name === "name") return path.basename(value.value);
      if (name === "parent") return new FilePath(path.dirname(value.value));
      if (name === "parents") {
        const parents: unknown[] = [];
        let current = value.value;
        while (path.dirname(current) !== current) {
          current = path.dirname(current);
          parents.push(new FilePath(current));
        }
        return parents;
      }
      if (name === "parts")
        return tuple((value.value.startsWith("/") ? ["/"] : []).concat(value.value.split("/").filter(Boolean)));
      return fn(name, (args, kw) => pathCall(value, name, args, kw));
    }
    if (value instanceof Status) {
      if (name === "stdout") return value.stdout;
      if (name === "stderr") return value.stderr;
      if (name === "returncode") return value.returncode;
    }
    if (value instanceof Hash) {
      if (name === "update")
        return fn(name, (args) => {
          value.value.update(Buffer.isBuffer(args[0]) ? args[0] : text(args[0]));
          return null;
        });
      if (name === "hexdigest") return fn(name, () => value.value.copy().digest("hex"));
    }
    if (value instanceof RegexMatch && name === "group")
      return fn(name, (args) => value.found[number(args[0] ?? 0)] ?? null);
    if (value instanceof Pattern && ["match", "fullmatch", "search"].includes(name))
      return fn(name, (args) => match(value, args[0], value.flags, name));
    if (value instanceof Capture && name === "getvalue") return fn(name, () => value.value);
    if (value instanceof Dict) {
      if (name === "get") return fn(name, (args) => value.get(args[0], args.length > 1 ? args[1] : null));
      if (name === "setdefault")
        return fn(name, (args) => {
          if (!value.has(args[0])) value.put(args[0], args.length > 1 ? args[1] : null);
          return value.get(args[0]);
        });
      if (name === "items") return fn(name, () => value.pairs.map((pair) => [...pair]));
      if (name === "values") return fn(name, () => value.pairs.map(([, v]) => v));
      if (name === "update")
        return fn(name, (args) => {
          for (const pair of args[0] instanceof Dict ? args[0].pairs : iter(args[0]).map(iter)) {
            value.put(pair[0], pair[1]);
          }
          return null;
        });
      if (name === "pop")
        return fn(name, (args) => {
          const old = value.get(args[0], args[1]);
          value.delete(args[0]);
          return old;
        });
    }
    if (value instanceof ValueSet) {
      if (name === "add")
        return fn(name, (args) => {
          value.add(args[0]);
          return null;
        });
      if (name === "update")
        return fn(name, (args) => {
          for (const x of iter(args[0])) value.add(x);
          return null;
        });
    }
    if (Array.isArray(value)) {
      if (name === "count") return fn(name, (args) => value.filter((x) => equal(x, args[0])).length);
      if (name === "append")
        return fn(name, (args) => {
          value.push(args[0]);
          return null;
        });
      if (name === "extend")
        return fn(name, (args) => {
          value.push(...iter(args[0]));
          return null;
        });
      if (name === "index")
        return fn(name, (args) => {
          const i = value.findIndex((x) => equal(x, args[0]));
          return i < 0 ? fail("ValueError", "not in list") : i;
        });
    }
    if (Buffer.isBuffer(value)) {
      if (name === "decode") return fn(name, () => value.toString("utf8"));
      if (name === "strip")
        return fn(name, (args) => {
          const allowed =
            args[0] == null
              ? Buffer.from(" \t\n\r\v\f")
              : Buffer.isBuffer(args[0])
                ? args[0]
                : Buffer.from(text(args[0]));
          let start = 0,
            end = value.length;
          while (start < end && allowed.includes(value[start] ?? 0)) start++;
          while (end > start && allowed.includes(value[end - 1] ?? 0)) end--;
          return value.subarray(start, end);
        });
      if (name === "split" || name === "partition")
        return fn(name, (args) => {
          const sep = Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(text(args[0]));
          const out: Buffer[] = [];
          let start = 0,
            i = value.indexOf(sep);
          if (name === "partition")
            return i < 0
              ? [value, Buffer.alloc(0), Buffer.alloc(0)]
              : [value.subarray(0, i), sep, value.subarray(i + sep.length)];
          while (i >= 0) {
            out.push(value.subarray(start, i));
            start = i + sep.length;
            i = value.indexOf(sep, start);
          }
          out.push(value.subarray(start));
          return out;
        });
    }
    if (typeof value === "string") {
      if (name === "strip" || name === "lstrip" || name === "rstrip")
        return fn(name, (args) =>
          trim(value, args[0], name === "lstrip" ? "left" : name === "rstrip" ? "right" : "both")
        );
      if (name === "lower") return fn(name, () => value.toLowerCase());
      if (name === "encode") return fn(name, () => Buffer.from(value, "utf8"));
      if (name === "startswith" || name === "endswith")
        return fn(name, (args) =>
          (Array.isArray(args[0]) ? args[0] : [args[0]]).some((x) =>
            name === "startswith" ? value.startsWith(text(x)) : value.endsWith(text(x))
          )
        );
      if (name === "replace") return fn(name, (args) => value.replaceAll(text(args[0]), text(args[1])));
      if (name === "count") return fn(name, (args) => value.split(text(args[0])).length - 1);
      if (name === "partition")
        return fn(name, (args) => {
          const sep = text(args[0]),
            i = value.indexOf(sep);
          return i < 0 ? [value, "", ""] : [value.slice(0, i), sep, value.slice(i + sep.length)];
        });
      if (name === "splitlines")
        return fn(name, (_args, kw) =>
          truth(kw.keepends)
            ? (value.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) ?? []).filter(Boolean)
            : value
                .split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/)
                .filter((line, i, all) => i < all.length - 1 || line !== "")
        );
      if (name === "split" || name === "rsplit")
        return fn(name, (args) => {
          const sep = args[0],
            maxsplit = args.length > 1 ? number(args[1]) : -1;
          const parts = sep == null ? value.trim().split(/\s+/) : value.split(text(sep));
          if (maxsplit < 0 || parts.length <= maxsplit + 1) return parts;
          if (name === "rsplit")
            return [parts.slice(0, parts.length - maxsplit).join(text(sep)), ...parts.slice(-maxsplit)];
          return [...parts.slice(0, maxsplit), parts.slice(maxsplit).join(text(sep))];
        });
      if (name === "join") return fn(name, (args) => iter(args[0]).map(text).join(value));
      if (name === "index")
        return fn(name, (args) => {
          const i = value.indexOf(text(args[0]));
          return i < 0 ? fail("ValueError", "substring not found") : i;
        });
    }
    return fail("AttributeError", `${repr(value)}.${name}`);
  }
  function typeName(value: unknown): string {
    if (value === null || value === undefined) return "NoneType";
    if (typeof value === "boolean") return "bool";
    if (typeof value === "string") return "str";
    if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
    if (value instanceof Dict) return "dict";
    if (value instanceof Tuple) return "tuple";
    if (Array.isArray(value)) return "list";
    if (value instanceof ValueSet) return "set";
    if (value instanceof FilePath) return "Path";
    if (Buffer.isBuffer(value)) return "bytes";
    return "object";
  }
  function instance(value: unknown, kind: unknown): boolean {
    if (Array.isArray(kind)) return kind.some((k) => instance(value, k));
    const name = kind instanceof Callable ? kind.name : kind instanceof TypeToken ? kind.name : "";
    return (
      typeName(value) === name ||
      (name === "tuple" && Array.isArray(value)) ||
      (name === "int" && typeof value === "boolean")
    );
  }
  const builtins: Record<string, unknown> = {};
  export function builtin(name: string): unknown {
    if (name in builtins) return builtins[name];
    const value = fn(name, (args, kw) => {
      const x = args[0];
      if (name === "str") return text(x);
      if (name === "type") return new TypeToken(typeName(x));
      if (name === "isinstance") return instance(x, args[1]);
      if (name === "len") return x instanceof Dict ? x.pairs.length : iter(x).length;
      if (name === "bool") return truth(x);
      if (name === "int") {
        if (!args.length) return 0;
        if (typeof x === "string") {
          const digits = decimalText(x.trim());
          if (!/^[+-]?\d+(?:_\d+)*$/.test(digits))
            return fail("ValueError", `invalid literal for int() with base 10: ${repr(x)}`);
          return Number(digits.replaceAll("_", ""));
        }
        if (typeof x !== "number" && typeof x !== "boolean")
          return fail("TypeError", "int() argument must be a string or a number");
        if (!Number.isFinite(number(x))) return fail("ValueError", "cannot convert non-finite value to integer");
        return Math.trunc(number(x));
      }
      if (name === "float") return number(x);
      if (name === "dict") {
        const result = x == null ? new Dict() : x instanceof Dict ? new Dict(x.pairs) : dict(x);
        if (result instanceof Dict) for (const [k, v] of Object.entries(kw)) result.put(k, v);
        return result;
      }
      if (name === "list" || name === "tuple")
        return name === "tuple" ? tuple(x == null ? [] : iter(x)) : x == null ? [] : [...iter(x)];
      if (name === "set") return new ValueSet(x == null ? [] : iter(x));
      if (name === "sorted") {
        const key = kw.key;
        return [...iter(x)].toSorted((a, b) => ordering(key ? call(key, [a]) : a, key ? call(key, [b]) : b));
      }
      if (name === "next") return iter(x)[0] ?? args[1] ?? fail("StopIteration", "");
      if (name === "any") return iter(x).some(truth);
      if (name === "all") return iter(x).every(truth);
      if (name === "sum") return iter(x).reduce<number>((sum, v) => sum + number(v), 0);
      if (name === "max") return iter(x).reduce((a, b) => (ordering(a, b) > 0 ? a : b));
      if (name === "range") {
        const start = args.length > 1 ? number(x) : 0,
          end = number(args.length > 1 ? args[1] : x);
        return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
      }
      if (name === "enumerate") return iter(x).map((value, i) => [i + number(args[1] ?? 0), value]);
      if (name === "getattr") {
        try {
          return attr(x, text(args[1]));
        } catch {
          return args[2] ?? null;
        }
      }
      if (name === "ord") return text(x).codePointAt(0) ?? 0;
      if (name === "bytes") return Buffer.isBuffer(x) ? Buffer.from(x) : Buffer.from(iter(x).map(number));
      if (name === "Path") return new FilePath(x);
      if (name === "print") {
        const line = args.map(text).join(" ") + text(kw.end ?? "\n");
        const capture = captures.at(-1);
        if (kw.file === stderr) process.stderr.write(line);
        else if (capture) capture.value += line;
        else process.stdout.write(line);
        return null;
      }
      if (name === "yload") return yamlLoad(x);
      if (name === "date") return iso(x, true);
      return fail(name, text(x));
    });
    const result = ["hashlib", "json", "os", "re", "subprocess", "sys", "yaml", "date"].includes(name)
      ? module(name)
      : value;
    builtins[name] = result;
    return result;
  }
  const stderr = Symbol("stderr");
  function moduleAttr(name: string, key: string): unknown {
    if (name === "sys") {
      if (key === "argv") return process.argv.slice(1);
      if (key === "stderr") return stderr;
      if (key === "exit")
        return fn(key, (args) => {
          throw new SystemExit(args[0] ?? 0);
        });
    }
    if (name === "re") {
      if (key === "I") return 2;
      if (key === "M") return 8;
      if (key === "S") return 16;
      return fn(key, (args, kw) => {
        if (key === "compile") return new Pattern(text(args[0]), number(args[1] ?? 0));
        if (key === "escape") return text(args[0]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const flags = number(kw.flags ?? args[key === "sub" ? 3 : 2] ?? 0);
        if (key === "sub") {
          const re = regex(args[0], flags);
          const global = new RegExp(re.source, re.flags + "g");
          return text(args[2]).replace(global, text(args[1]).replace(/\\(\d+)/g, "$$$1"));
        }
        if (key === "match" || key === "fullmatch" || key === "search") return match(args[0], args[1], flags, key);
        return fail("AttributeError", `re.${key}`);
      });
    }
    if (name === "hashlib" && key === "sha256")
      return fn(key, (args) => {
        const hash = Crypto.createHash("sha256");
        if (args.length) hash.update(Buffer.isBuffer(args[0]) ? args[0] : text(args[0]));
        return new Hash(hash);
      });
    if (name === "json" && key === "dumps")
      return fn(key, (args, kw) => {
        const compact = truth(kw.separators);
        const result = JSON.stringify(toNative(args[0], truth(kw.sort_keys)));
        return compact ? result : result.replace(/[:,]/g, (c) => c + " ");
      });
    if (name === "copy" && key === "deepcopy") return fn(key, (args) => clone(args[0]));
    if (name === "posixpath" && key === "normpath") return fn(key, (args) => path.normalize(text(args[0])));
    if (name === "os" && key === "environ") return fromNative(process.env);
    if (name === "os" && key === "fsdecode")
      return fn(key, (args) => (Buffer.isBuffer(args[0]) ? args[0].toString("utf8") : text(args[0])));
    if ((name === "datetime" && key === "datetime") || (name === "datetime" && key === "date")) return new Module(key);
    if ((name === "datetime" || name === "date") && key === "fromisoformat")
      return fn(key, (args) => iso(args[0], name === "date"));
    if (name === "date" && key === "today") return fn(key, () => new IsoDate(new Date().toLocaleDateString("en-CA")));
    if (name === "tempfile" && key === "TemporaryDirectory")
      return fn(key, () => {
        const dir = Fs.mkdtempSync(path.join(Os.tmpdir(), "artifact-test-"));
        return new Context(dir, () => Fs.rmSync(dir, { recursive: true, force: true }));
      });
    if (name === "io" && key === "StringIO") return fn(key, () => new Capture());
    if (name === "contextlib" && key === "redirect_stdout")
      return fn(key, (args) => {
        const c = args[0];
        if (!(c instanceof Capture)) return fail("TypeError", "capture required");
        captures.push(c);
        return new Context(c, () => {
          captures.pop();
        });
      });
    if (name === "subprocess" && key === "TimeoutExpired") return new TypeToken("TimeoutExpired");
    if (name === "subprocess" && key === "run")
      return fn(key, (args, kw) => {
        const argv = iter(args[0]).map(text),
          [command, ...rest] = argv;
        if (!command) return fail("OSError", "missing command");
        const result = spawnSync(command, rest, {
          encoding: undefined,
          env: kw.env
            ? Object.fromEntries(
                iter(kw.env instanceof Dict ? kw.env.pairs : []).map((pair) => {
                  const [k, v] = iter(pair);
                  return [text(k), text(v)];
                })
              )
            : undefined,
          timeout: kw.timeout ? number(kw.timeout) * 1000 : undefined,
          maxBuffer: 64 * 1024 * 1024,
        });
        if (result.error) {
          if ("code" in result.error && result.error.code === "ETIMEDOUT")
            return fail("TimeoutExpired", "command timed out");
          throw result.error;
        }
        const stdout = result.stdout ?? Buffer.alloc(0),
          stderr = result.stderr ?? Buffer.alloc(0);
        return new Status(
          truth(kw.text) ? stdout.toString("utf8") : stdout,
          result.status ?? 1,
          truth(kw.text) ? stderr.toString("utf8") : stderr
        );
      });
    return fail("AttributeError", `${name}.${key}`);
  }
  /** Invoke a lowered contract function from Bun tests without interpreting source. */
  export const invoke = (value: unknown, ...args: readonly unknown[]) => call(value, args);
  export const method = (value: unknown, name: string, ...args: readonly unknown[]) => call(attr(value, name), args);
  export const get = (value: unknown, key: unknown, fallback: unknown = null) =>
    value instanceof Dict ? value.get(key, fallback) : fail("TypeError", "get requires a mapping");
  /** Preserve Python sys.exit status while allowing imports to remain side-effect free. */
  export function boundary(run: () => void): void {
    try {
      run();
    } catch (e) {
      if (e instanceof SystemExit) {
        if (typeof e.code === "number") process.exitCode = e.code;
        else {
          console.error(text(e.code));
          process.exitCode = 1;
        }
      } else throw e;
    }
  }
}
const hashlib = rt.builtin("hashlib");
const json = rt.builtin("json");
const os = rt.builtin("os");
const re = rt.builtin("re");
const subprocess = rt.builtin("subprocess");
const sys = rt.builtin("sys");
const date = rt.builtin("date");
const Path = rt.builtin("Path");
const yaml = rt.builtin("yaml");
const str = rt.builtin("str");
const type = rt.builtin("type");
const isinstance = rt.builtin("isinstance");
const len = rt.builtin("len");
const int = rt.builtin("int");
const float = rt.builtin("float");
const bool = rt.builtin("bool");
const dict = rt.builtin("dict");
const list = rt.builtin("list");
const tuple = rt.builtin("tuple");
const set = rt.builtin("set");
const sorted = rt.builtin("sorted");
const any = rt.builtin("any");
const all = rt.builtin("all");
const sum = rt.builtin("sum");
const max = rt.builtin("max");
const range = rt.builtin("range");
const enumerate = rt.builtin("enumerate");
const getattr = rt.builtin("getattr");
const next = rt.builtin("next");
const ord = rt.builtin("ord");
const bytes = rt.builtin("bytes");
const Exception = rt.builtin("Exception");
const ValueError = rt.builtin("ValueError");
const TypeError = rt.builtin("TypeError");
const OSError = rt.builtin("OSError");
const RuntimeError = rt.builtin("RuntimeError");
const FileNotFoundError = rt.builtin("FileNotFoundError");
const print = rt.builtin("print");
const yload = rt.builtin("yload");
const __file__ = import.meta.filename;
const __name__ = import.meta.main ? "__main__" : "validator";
const __doc__ =
  "Usage: bun validate_artifacts.ts <ontology-root> [--gate] [--repo <root>]\n       bun validate_artifacts.ts --self-test | --print-run-id <ontology-root>";
let ALWAYS_PRESENT_SURFACES: unknown;
let CATEGORY: unknown;
let CE_DENYLIST: unknown;
let CHECKS: unknown;
let CONFIG_EXTS: unknown;
let CONFIG_OBJ: unknown;
let CQ_EXCLUDED_PRIORITIES: unknown;
let DECISION: unknown;
let DEPENDENCE: unknown;
let DISC_DENYLIST: unknown;
let FACT_KEYS: unknown;
let FA_TESTS: unknown;
let FREE_OBJ: unknown;
let HASH_COMMENT_EXTS: unknown;
let IDENT_OBJ: unknown;
let ID_GRAMMAR: unknown;
let PO_KEYS: unknown;
let PREDICATES: unknown;
let PROMPT_ROLES: unknown;
let RECORD_DISPATCH: unknown;
let REPR: unknown;
let REVIEW_NAME: unknown;
let REVIEW_VERDICT: unknown;
let RIGIDITY: unknown;
let RUN_ID_RE: unknown;
let SKILL_DIR: unknown;
let SO_KEYS: unknown;
let SO_NESTED: unknown;
let SURFACES: unknown;
let SURVIVING_REPR: unknown;
let TEST_VALUES: unknown;
let TRI: unknown;
let TRIVIAL_REASONS: unknown;
let VERDICT: unknown;
let _PAIRING_COMMENT_FAMILIES: unknown;
let argv: unknown;
let aslist: unknown;
let canonical_obs_id: unknown;
let check_dh: unknown;
let check_fa: unknown;
let check_ic: unknown;
let check_kind_id: unknown;
let check_manifest: unknown;
let check_otp: unknown;
let check_po: unknown;
let check_prior_rows: unknown;
let check_rat: unknown;
let check_rej: unknown;
let check_review: unknown;
let check_so: unknown;
let closed_keys: unknown;
let config_pair_occurs: unknown;
let cross_check_chain: unknown;
let cross_check_index: unknown;
let cross_check_rats: unknown;
let cross_check_rejections: unknown;
let cross_check_review_binding: unknown;
let cross_check_support_graph: unknown;
let dicts: unknown;
let e: unknown;
let err: unknown;
let errors: unknown;
let expect_err: unknown;
let expect_out: unknown;
let expect_silent: unknown;
let fa_ran_no_tests: unknown;
let fl: unknown;
let flags: unknown;
let gate: unknown;
let get: unknown;
let identity_expectation: unknown;
let is_exact_int: unknown;
let is_exact_num: unknown;
let is_tri: unknown;
let join_key: unknown;
let latest_reviews: unknown;
let lexical_symlink_violations: unknown;
let make_pinned_reader: unknown;
let need: unknown;
let need_bool: unknown;
let need_hex: unknown;
let need_str: unknown;
let norm_cat: unknown;
let occurs: unknown;
let print_run_id: unknown;
let record: unknown;
let repo: unknown;
let repo_fidelity: unknown;
let review_round: unknown;
let run_gate: unknown;
let safe_join: unknown;
let safe_text: unknown;
let self_test: unknown;
let sha12: unknown;
let skey: unknown;
let so_is_unrepresentable_only: unknown;
let strip_comments: unknown;
let strip_comments_config: unknown;
let valid_run_id: unknown;
let validate_dir: unknown;
SKILL_DIR = rt.attr(rt.attr(rt.method(rt.invoke(Path, __file__), "resolve"), "parent"), "parent");
IDENT_OBJ = rt.set([
  "declares_field",
  "declares_member",
  "declares_parameter",
  "declares_return_type",
  "extends_syntactically",
  "implements_syntactically",
  "references_type",
  "exports_symbol",
  "task_depends_on_syntactically",
  "declares_type_alias",
  "declares_union_member",
  "declares_intersection_member",
  "decorates_with",
  "unrepresentable_construct",
]);
FREE_OBJ = rt.set(["declares_literal_member"]);
CONFIG_OBJ = rt.set(["config_key_value"]);
PREDICATES = rt.op("union", rt.op("union", IDENT_OBJ, FREE_OBJ), CONFIG_OBJ);
CONFIG_EXTS = rt.tuple([".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".env", ".properties", ".xml"]);
HASH_COMMENT_EXTS = rt.tuple([".py", ".rb", ".sh", ".yaml", ".yml", ".toml", ".ini", ".env", ".properties"]);
SO_KEYS = rt.set([
  "id",
  "schema_version",
  "repository",
  "source_span",
  "extractor",
  "symbol",
  "observed_facts",
  "source_excerpt",
  "epistemic_status",
]);
PO_KEYS = rt.set(["id", "schema_version", "repository", "source_span", "quote", "epistemic_status"]);
SO_NESTED = rt.dict([
  ["repository", rt.set(["commit", "path"])],
  ["source_span", rt.set(["start_line", "end_line", "content_sha256"])],
  ["extractor", rt.set(["id", "version", "parser", "script"])],
  ["symbol", rt.set(["qualified_name", "lexical_name", "syntactic_kind"])],
]);
FACT_KEYS = rt.set(["predicate", "object"]);
ID_GRAMMAR = rt.dict([
  ["dh", "^dh:[\\w-]+:\\d+$"],
  ["ic", "^ic:[\\w-]+:\\d+$"],
  ["fa", "^fa:[\\w-]+:\\d+$"],
  ["otp", "^otp:[\\w-]+:\\d+$"],
  ["rat", "^rat:\\d+$"],
  ["rej", "^rej:\\d+$"],
]);
REVIEW_NAME = rt.method(re, "compile", "^(otp-[\\w-]+-\\d+)(-r\\d+)?\\.review\\.yaml$");
TRI = rt.set([true, false, "unresolved"]);
REPR = rt.set([
  "domain_referent",
  "information_artifact",
  "implementation_artifact_only",
  "lexical_alias",
  "unresolved",
]);
SURVIVING_REPR = rt.set(["domain_referent", "information_artifact"]);
CATEGORY = rt.set([
  "kind",
  "subkind",
  "role",
  "phase",
  "relator",
  "quality",
  "mode",
  "event",
  "process",
  "situation",
  "information_object",
  "none",
  "unresolved",
]);
RIGIDITY = rt.set(["rigid", "anti_rigid", "semi_rigid", "unresolved"]);
DEPENDENCE = rt.set(["none", "relational", "intrinsic", "unresolved"]);
TEST_VALUES = rt.set(["separated", "merged", "not_applicable", "unresolved"]);
FA_TESTS = rt.tuple(["spec_vs_execution", "world_vs_information", "role_vs_bearer", "context_reification_needed"]);
VERDICT = rt.set(["analyzed", "explicitly_deferred"]);
DECISION = rt.set(["accept", "reject", "revise"]);
REVIEW_VERDICT = rt.set(["PASS", "FAIL", "INDETERMINATE"]);
SURFACES = rt.tuple(["taxonomy", "identity", "warrant", "null_discriminator"]);
ALWAYS_PRESENT_SURFACES = rt.tuple(["identity", "warrant", "null_discriminator"]);
DISC_DENYLIST = ["named type", "\\bid field\\b", "has (an? )?id\\b", "doc ?comment", "is a (class|type|interface)\\b"];
CE_DENYLIST = ["REQUIRED:", "attempt at least one"];
TRIVIAL_REASONS = rt.set(["out of scope", "n/a", "irrelevant", "not relevant", "later"]);
PROMPT_ROLES = rt.dict([
  ["denotation", "prompts/denotation.md"],
  ["foundational", "prompts/ufo-analysis.md"],
  ["synthesis", "prompts/synthesis.md"],
  ["adversary", "prompts/ontoclean-adversary.md"],
  ["alternative", "prompts/alternative-model.md"],
]);
CQ_EXCLUDED_PRIORITIES = rt.set(["could_have", "wont_have"]);
errors = [];
flags = [];
err = rt.fn("err", (args, kwargs) => {
  let msg: unknown;
  let path: unknown;
  path = rt.argument(args, kwargs, 0, "path", undefined);
  msg = rt.argument(args, kwargs, 1, "msg", undefined);
  rt.method(errors, "append", [rt.format(path, -1, null), ": ", rt.format(msg, -1, null)].join(""));
  return null;
});
get = rt.fn("get", (args, kwargs) => {
  let cur: unknown;
  let d: unknown;
  let dotted: unknown;
  let p: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  dotted = rt.argument(args, kwargs, 1, "dotted", undefined);
  cur = d;
  for (const loop1 of rt.iter(rt.method(dotted, "split", "."))) {
    p = loop1;
    cur = rt.truth(rt.invoke(isinstance, cur, dict)) ? rt.get(cur, p) : null;
  }
  return cur;
  return null;
});
need = rt.fn("need", (args, kwargs) => {
  let d: unknown;
  let k: unknown;
  let keys: unknown;
  let path: unknown;
  let v: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  keys = rt.argument(args, kwargs, 1, "keys", undefined);
  path = rt.argument(args, kwargs, 2, "path", undefined);
  for (const loop2 of rt.iter(keys)) {
    k = loop2;
    v = rt.invoke(get, d, k);
    if (
      rt.truth(
        rt.or(rt.compare("in", v, rt.tuple([null, "", [], rt.dict([])])), () =>
          rt.and(rt.invoke(isinstance, v, str), () => !rt.truth(rt.method(v, "strip")))
        )
      )
    ) {
      rt.invoke(err, path, ["missing/empty required field ", rt.format(k, -1, null)].join(""));
    }
  }
  return null;
});
record = rt.fn("record", (args, kwargs) => {
  let fn: unknown;
  let guarded: unknown;
  fn = rt.argument(args, kwargs, 0, "fn", undefined);
  guarded = rt.fn("guarded", (args, kwargs) => {
    let d: unknown;
    let p: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    if (rt.truth(!rt.truth(rt.invoke(isinstance, d, dict)))) {
      rt.invoke(
        err,
        p,
        ["record must be a mapping, got ", rt.format(rt.attr(rt.invoke(type, d), "__name__"), -1, null)].join("")
      );
      return undefined;
    }
    rt.invoke(fn, d, p);
    return null;
  });
  return guarded;
  return null;
});
dicts = rt.fn("dicts", (args, kwargs) => {
  let path: unknown;
  let seq: unknown;
  let what: unknown;
  let x: unknown;
  seq = rt.argument(args, kwargs, 0, "seq", undefined);
  path = rt.argument(args, kwargs, 1, "path", undefined);
  what = rt.argument(args, kwargs, 2, "what", undefined);
  const yielded: unknown[] = [];
  if (rt.truth(rt.compare("is", seq, null))) {
    return yielded;
  }
  if (rt.truth(!rt.truth(rt.invoke(isinstance, seq, rt.tuple([list, tuple]))))) {
    rt.invoke(
      err,
      path,
      [
        rt.format(what, -1, null),
        " must be a list, got ",
        rt.format(rt.attr(rt.invoke(type, seq), "__name__"), -1, null),
      ].join("")
    );
    return yielded;
  }
  for (const loop3 of rt.iter(seq)) {
    x = loop3;
    if (rt.truth(rt.invoke(isinstance, x, dict))) {
      yielded.push(x);
    } else {
      rt.invoke(
        err,
        path,
        [rt.format(what, -1, null), " entry ", rt.format(x, 114, null), " is not a mapping"].join("")
      );
    }
  }
  return yielded;
});
is_exact_int = rt.fn("is_exact_int", (args, kwargs) => {
  let v: unknown;
  v = rt.argument(args, kwargs, 0, "v", undefined);
  return rt.compare("is", rt.invoke(type, v), int);
  return null;
});
is_exact_num = rt.fn("is_exact_num", (args, kwargs) => {
  let v: unknown;
  v = rt.argument(args, kwargs, 0, "v", undefined);
  return rt.compare("in", rt.invoke(type, v), rt.tuple([int, float]));
  return null;
});
is_tri = rt.fn("is_tri", (args, kwargs) => {
  let v: unknown;
  v = rt.argument(args, kwargs, 0, "v", undefined);
  return rt.or(rt.compare("is", rt.invoke(type, v), bool), () =>
    rt.and(rt.compare("is", rt.invoke(type, v), str), () => rt.compare("eq", v, "unresolved"))
  );
  return null;
});
need_bool = rt.fn("need_bool", (args, kwargs) => {
  let d: unknown;
  let key: unknown;
  let path: unknown;
  let v: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  key = rt.argument(args, kwargs, 1, "key", undefined);
  path = rt.argument(args, kwargs, 2, "path", undefined);
  v = rt.invoke(get, d, key);
  if (rt.truth(rt.and(rt.compare("isnot", v, null), () => rt.compare("isnot", rt.invoke(type, v), bool)))) {
    rt.invoke(
      err,
      path,
      [
        rt.format(key, -1, null),
        " must be a BOOLEAN (yaml true/false), got ",
        rt.format(v, 114, null),
        " — integers and strings that compare equal to a boolean are not booleans",
      ].join("")
    );
  }
  return rt.truth(rt.compare("is", rt.invoke(type, v), bool)) ? v : null;
  return null;
});
need_str = rt.fn("need_str", (args, kwargs) => {
  let d: unknown;
  let key: unknown;
  let minlen: unknown;
  let path: unknown;
  let v: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  key = rt.argument(args, kwargs, 1, "key", undefined);
  path = rt.argument(args, kwargs, 2, "path", undefined);
  minlen = rt.argument(args, kwargs, 3, "minlen", 1);
  v = rt.invoke(get, d, key);
  if (
    rt.truth(
      rt.or(!rt.truth(rt.invoke(isinstance, v, str)), () =>
        rt.compare("lt", rt.invoke(len, rt.method(v, "strip")), minlen)
      )
    )
  ) {
    rt.invoke(
      err,
      path,
      rt.op(
        "add",
        rt.op(
          "add",
          [rt.format(key, -1, null), " must be a non-blank STRING"].join(""),
          rt.truth(rt.compare("gt", minlen, 1)) ? [" (>= ", rt.format(minlen, -1, null), " chars)"].join("") : ""
        ),
        [", got ", rt.format(v, 114, null)].join("")
      )
    );
    return null;
  }
  return v;
  return null;
});
aslist = rt.fn("aslist", (args, kwargs) => {
  let x: unknown;
  x = rt.argument(args, kwargs, 0, "x", undefined);
  return rt.truth(rt.invoke(isinstance, x, rt.tuple([list, tuple]))) ? x : [];
  return null;
});
closed_keys = rt.fn("closed_keys", (args, kwargs) => {
  let allowed: unknown;
  let d: unknown;
  let label: unknown;
  let path: unknown;
  let unknown: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  allowed = rt.argument(args, kwargs, 1, "allowed", undefined);
  path = rt.argument(args, kwargs, 2, "path", undefined);
  label = rt.argument(args, kwargs, 3, "label", undefined);
  if (rt.truth(rt.invoke(isinstance, d, dict))) {
    unknown = rt.op("sub", rt.invoke(set, d), allowed);
    if (rt.truth(unknown)) {
      rt.invoke(
        err,
        path,
        [
          rt.format(label, -1, null),
          ": unknown key(s) ",
          rt.format(rt.invoke(sorted, unknown), -1, null),
          " — key sets are CLOSED at every level; extra fields are where interpretation smuggles in",
        ].join("")
      );
    }
  }
  return null;
});
sha12 = rt.fn("sha12", (args, kwargs) => {
  let data: unknown;
  data = rt.argument(args, kwargs, 0, "data", undefined);
  return rt.item(rt.method(rt.method(hashlib, "sha256", data), "hexdigest"), rt.slice(undefined, 12, undefined));
  return null;
});
RUN_ID_RE = rt.method(
  re,
  "compile",
  "orun-\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})?"
);
valid_run_id = rt.fn("valid_run_id", (args, kwargs) => {
  let datetime: unknown;
  let rid: unknown;
  rid = rt.argument(args, kwargs, 0, "rid", undefined);
  if (
    rt.truth(
      rt.or(rt.compare("isnot", rt.invoke(type, rid), str), () => !rt.truth(rt.method(RUN_ID_RE, "fullmatch", rid)))
    )
  ) {
    return false;
  }
  try {
    datetime = rt.attr(rt.module("datetime"), "datetime");
    rt.method(
      datetime,
      "fromisoformat",
      rt.method(rt.item(rid, rt.slice(5, undefined, undefined)), "replace", "Z", "+00:00")
    );
  } catch (caught) {
    if (rt.catches(caught, ValueError)) {
      return false;
    } else {
      throw caught;
    }
  }
  return true;
  return null;
});
need_hex = rt.fn("need_hex", (args, kwargs) => {
  let d: unknown;
  let key: unknown;
  let n: unknown;
  let path: unknown;
  let required: unknown;
  let v: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  key = rt.argument(args, kwargs, 1, "key", undefined);
  path = rt.argument(args, kwargs, 2, "path", undefined);
  n = rt.argument(args, kwargs, 3, "n", undefined);
  required = rt.argument(args, kwargs, 4, "required", true);
  v = rt.invoke(get, d, key);
  if (rt.truth(rt.compare("is", v, null))) {
    if (rt.truth(required)) {
      rt.invoke(err, path, [rt.format(key, -1, null), " is required (", rt.format(n, -1, null), " hex)"].join(""));
    }
    return null;
  }
  if (
    rt.truth(
      rt.or(
        rt.compare("isnot", rt.invoke(type, v), str),
        () => !rt.truth(rt.method(re, "fullmatch", ["[0-9a-f]{", rt.format(n, -1, null), "}"].join(""), v))
      )
    )
  ) {
    rt.invoke(
      err,
      path,
      [
        rt.format(key, -1, null),
        " must be a lowercase ",
        rt.format(n, -1, null),
        "-hex STRING, got ",
        rt.format(v, 114, null),
        " — a numeric scalar that stringifies to decimal digits is not a digest",
      ].join("")
    );
    return null;
  }
  return v;
  return null;
});
skey = rt.fn("skey", (args, kwargs) => {
  let x: unknown;
  x = rt.argument(args, kwargs, 0, "x", undefined);
  return rt.truth(rt.compare("is", rt.invoke(type, x), str)) ? x : null;
  return null;
});
safe_text = rt.fn("safe_text", (args) => escapeAuthorityText(rt.format(args[0], -1, null)));

join_key = rt.fn("join_key", (args, kwargs) => {
  let path: unknown;
  let what: unknown;
  let x: unknown;
  x = rt.argument(args, kwargs, 0, "x", undefined);
  path = rt.argument(args, kwargs, 1, "path", undefined);
  what = rt.argument(args, kwargs, 2, "what", undefined);
  if (rt.truth(rt.compare("is", rt.invoke(type, x), str))) {
    return x;
  }
  rt.invoke(
    err,
    path,
    [
      rt.format(what, -1, null),
      " must be a STRING id, got ",
      rt.format(x, 114, null),
      " — malformed authority is quarantined from joins, never hashed",
    ].join("")
  );
  return null;
  return null;
});
identity_expectation = rt.fn("identity_expectation", (args, kwargs) => {
  let carries: unknown;
  let supplies: unknown;
  supplies = rt.argument(args, kwargs, 0, "supplies", undefined);
  carries = rt.argument(args, kwargs, 1, "carries", undefined);
  if (rt.truth(rt.compare("in", "unresolved", rt.tuple([supplies, carries])))) {
    return "unresolved";
  }
  if (rt.truth(rt.compare("is", supplies, true))) {
    return "supplies";
  }
  if (rt.truth(rt.compare("is", carries, true))) {
    return "carries";
  }
  if (rt.truth(rt.and(rt.compare("is", supplies, false), () => rt.compare("is", carries, false)))) {
    return "none";
  }
  return null;
  return null;
});
lexical_symlink_violations = rt.fn("lexical_symlink_violations", (args, kwargs) => {
  let anc: unknown;
  let bad: unknown;
  let ex: unknown;
  let lexical: unknown;
  let rel: unknown;
  let root: unknown;
  root = rt.argument(args, kwargs, 0, "root", undefined);
  rel = rt.argument(args, kwargs, 1, "rel", undefined);
  bad = [];
  try {
    root = rt.invoke(Path, root);
    lexical = rt.op("div", root, rt.invoke(str, rel));
    if (rt.truth(rt.method(lexical, "is_symlink"))) {
      rt.method(bad, "append", rt.attr(lexical, "name"));
    }
    anc = rt.attr(lexical, "parent");
    while (rt.truth(rt.and(rt.compare("ne", anc, root), () => rt.compare("in", root, rt.attr(anc, "parents"))))) {
      if (rt.truth(rt.method(anc, "is_symlink"))) {
        rt.method(bad, "append", rt.attr(anc, "name"));
      }
      anc = rt.attr(anc, "parent");
    }
  } catch (caught) {
    if (rt.catches(caught, rt.tuple([OSError, RuntimeError]))) {
      ex = caught;
      rt.method(bad, "append", ["<unexaminable: ", rt.format(ex, -1, null), ">"].join(""));
    } else {
      throw caught;
    }
  }
  return bad;
  return null;
});
canonical_obs_id = rt.fn("canonical_obs_id", (args, kwargs) => {
  let d: unknown;
  let digest: unknown;
  let f: unknown;
  let facts: unknown;
  let kind: unknown;
  let of: unknown;
  let payload: unknown;
  kind = rt.argument(args, kwargs, 0, "kind", undefined);
  d = rt.argument(args, kwargs, 1, "d", undefined);
  if (rt.truth(rt.compare("eq", kind, "so"))) {
    of = rt.get(d, "observed_facts");
    of = rt.truth(rt.invoke(isinstance, of, rt.tuple([list, tuple]))) ? of : [];
    facts = rt.invoke(
      sorted,
      rt.comprehend(of, (item: unknown) => {
        let f: unknown;
        f = item;
        return rt.truth(rt.truth(rt.invoke(isinstance, f, dict)))
          ? [rt.invoke(str, rt.get(f, "predicate")), rt.invoke(str, rt.get(f, "object"))]
          : rt.skip;
      })
    );
    payload = [
      rt.invoke(get, d, "repository.commit"),
      rt.invoke(get, d, "repository.path"),
      rt.invoke(get, d, "source_span.start_line"),
      rt.invoke(get, d, "source_span.end_line"),
      facts,
      rt.invoke(get, d, "extractor.id"),
      rt.invoke(get, d, "extractor.version"),
    ];
  } else {
    payload = [
      rt.invoke(get, d, "repository.commit"),
      rt.invoke(get, d, "repository.path"),
      rt.invoke(get, d, "source_span.start_line"),
      rt.invoke(get, d, "source_span.end_line"),
      rt.get(d, "quote"),
    ];
  }
  digest = rt.method(
    rt.method(
      hashlib,
      "sha256",
      rt.method(
        rt.call(rt.attr(json, "dumps"), [payload], {
          sort_keys: true,
          separators: rt.tuple([",", ":"]),
          ensure_ascii: false,
        }),
        "encode"
      )
    ),
    "hexdigest"
  );
  return [rt.format(kind, -1, null), ":sha256:", rt.format(digest, -1, null)].join("");
  return null;
});
strip_comments = rt.fn("strip_comments", (args, kwargs) => {
  let path: unknown;
  let text: unknown;
  text = rt.argument(args, kwargs, 0, "text", undefined);
  path = rt.argument(args, kwargs, 1, "path", undefined);
  text = rt.call(rt.attr(re, "sub"), ["<!--.*?(-->|\\Z)", "", text], { flags: rt.attr(re, "S") });
  text = rt.call(rt.attr(re, "sub"), ["/\\*.*?(\\*/|\\Z)", "", text], { flags: rt.attr(re, "S") });
  text = rt.method(re, "sub", "//[^\\n]*", "", text);
  text = rt.method(re, "sub", "#[^\\n]*", "", text);
  text = rt.call(rt.attr(re, "sub"), ["^[ \\t]*[;!][^\\n]*", "", text], { flags: rt.attr(re, "M") });
  return text;
  return null;
});
_PAIRING_COMMENT_FAMILIES = rt.dict([
  [".json", rt.tuple([])],
  [".jsonc", rt.tuple(["cline", "cblock"])],
  [".yaml", rt.tuple(["hash_ws"])],
  [".yml", rt.tuple(["hash_ws"])],
  [".toml", rt.tuple(["hash_line"])],
  [".ini", rt.tuple(["linestart_hash", "linestart_semi"])],
  [".properties", rt.tuple(["linestart_hash", "linestart_bang"])],
  [".env", rt.tuple(["hash_ws"])],
  [".xml", rt.tuple(["xml"])],
]);
strip_comments_config = rt.fn("strip_comments_config", (args, kwargs) => {
  let ext: unknown;
  let fams: unknown;
  let path: unknown;
  let text: unknown;
  text = rt.argument(args, kwargs, 0, "text", undefined);
  path = rt.argument(args, kwargs, 1, "path", undefined);
  ext = rt.truth(rt.compare("in", ".", rt.invoke(str, path)))
    ? rt.op("add", ".", rt.method(rt.item(rt.method(rt.invoke(str, path), "rsplit", ".", 1), rt.neg(1)), "lower"))
    : "";
  fams = rt.get(_PAIRING_COMMENT_FAMILIES, ext, rt.tuple([]));
  text = rt.method(rt.method(text, "replace", "\r\n", "\n"), "replace", "\r", "\n");
  text = rt.method(text, "lstrip", "﻿");
  if (rt.truth(rt.compare("in", "xml", fams))) {
    text = rt.call(rt.attr(re, "sub"), ["<!--.*?(-->|\\Z)", "", text], { flags: rt.attr(re, "S") });
  }
  if (rt.truth(rt.compare("in", "cblock", fams))) {
    text = rt.call(rt.attr(re, "sub"), ["/\\*.*?(\\*/|\\Z)", "", text], { flags: rt.attr(re, "S") });
  }
  if (rt.truth(rt.compare("in", "cline", fams))) {
    text = rt.method(re, "sub", "//[^\\n]*", "", text);
  }
  if (rt.truth(rt.compare("in", "hash_line", fams))) {
    text = rt.method(re, "sub", "#[^\\n]*", "", text);
  }
  if (rt.truth(rt.compare("in", "hash_ws", fams))) {
    text = rt.call(rt.attr(re, "sub"), ["(?:^|(?<=[ \\t]))#[^\\n]*", "", text], { flags: rt.attr(re, "M") });
  }
  if (rt.truth(rt.compare("in", "linestart_hash", fams))) {
    text = rt.call(rt.attr(re, "sub"), ["^[ \\t\\f]*#[^\\n]*", "", text], { flags: rt.attr(re, "M") });
  }
  if (rt.truth(rt.compare("in", "linestart_semi", fams))) {
    text = rt.call(rt.attr(re, "sub"), ["^[ \\t\\f]*;[^\\n]*", "", text], { flags: rt.attr(re, "M") });
  }
  if (rt.truth(rt.compare("in", "linestart_bang", fams))) {
    text = rt.call(rt.attr(re, "sub"), ["^[ \\t\\f]*![^\\n]*", "", text], { flags: rt.attr(re, "M") });
  }
  return text;
  return null;
});
occurs = rt.fn("occurs", (args, kwargs) => {
  let probe: unknown;
  let text: unknown;
  probe = rt.argument(args, kwargs, 0, "probe", undefined);
  text = rt.argument(args, kwargs, 1, "text", undefined);
  return rt.compare(
    "isnot",
    rt.method(
      re,
      "search",
      ["(?<![\\w$#])", rt.format(rt.method(re, "escape", rt.invoke(str, probe)), -1, null), "(?![\\w$#])"].join(""),
      text
    ),
    null
  );
  return null;
});
config_pair_occurs = rt.fn("config_pair_occurs", (args, kwargs) => {
  let any_val: unknown;
  let arms: unknown;
  let k: unknown;
  let key: unknown;
  let lower: unknown;
  let path: unknown;
  let post: unknown;
  let q_val: unknown;
  let quote_initial: unknown;
  let sep: unknown;
  let text: unknown;
  let unq_end: unknown;
  let v: unknown;
  let val: unknown;
  key = rt.argument(args, kwargs, 0, "key", undefined);
  val = rt.argument(args, kwargs, 1, "val", undefined);
  text = rt.argument(args, kwargs, 2, "text", undefined);
  path = rt.argument(args, kwargs, 3, "path", "");
  if (rt.truth(!rt.truth(val))) {
    return false;
  }
  k = rt.item(
    rt.tuple([rt.method(re, "escape", rt.invoke(str, key)), rt.method(re, "escape", rt.invoke(str, val))]),
    0
  );
  v = rt.item(
    rt.tuple([rt.method(re, "escape", rt.invoke(str, key)), rt.method(re, "escape", rt.invoke(str, val))]),
    1
  );
  post = "(?=[ \\t]*(?:[\\r\\n,}}\\])>/;#]|$))";
  unq_end = "(?=[ \\t]*(?:\\r?\\n(?:[ \\t]*\\r?\\n)*(?:(?![ \\t\\r\\n])|\\Z)|\\Z))";
  q_val = [
    '(?:\\"',
    rt.format(v, -1, null),
    '\\"',
    rt.format(post, -1, null),
    "|'",
    rt.format(v, -1, null),
    "'",
    rt.format(post, -1, null),
    ")",
  ].join("");
  quote_initial = rt.compare("in", rt.item(rt.invoke(str, val), rt.slice(undefined, 1, undefined)), "\"'");
  any_val = rt.truth(quote_initial)
    ? q_val
    : ["(?:", rt.format(q_val, -1, null), "|", rt.format(v, -1, null), rt.format(unq_end, -1, null), ")"].join("");
  sep = "[ \\t]*[:=][ \\t]*";
  lower = rt.method(rt.invoke(str, path), "lower");
  if (rt.truth(rt.method(lower, "endswith", rt.tuple([".ini", ".properties"])))) {
    arms = [
      [
        "^[ \\t]*",
        rt.format(k, -1, null),
        rt.format(sep, -1, null),
        rt.format(v, -1, null),
        rt.format(unq_end, -1, null),
      ].join(""),
    ];
  } else {
    arms = [
      ["^[ \\t]*", rt.format(k, -1, null), rt.format(sep, -1, null), rt.format(any_val, -1, null)].join(""),
      [
        '(?:^|[ \\t{,\\[])\\"',
        rt.format(k, -1, null),
        '\\"',
        rt.format(sep, -1, null),
        rt.format(any_val, -1, null),
      ].join(""),
      ["(?:^|[ \\t{,\\[])'", rt.format(k, -1, null), "'", rt.format(sep, -1, null), rt.format(any_val, -1, null)].join(
        ""
      ),
    ];
    if (rt.truth(rt.method(lower, "endswith", rt.tuple([".xml", ".html", ".xhtml", ".svg"])))) {
      rt.method(
        arms,
        "append",
        ["(?:^|[ \\t])", rt.format(k, -1, null), "[ \\t]*=[ \\t]*", rt.format(q_val, -1, null)].join("")
      );
    }
  }
  return rt.compare("isnot", rt.method(re, "search", rt.method("|", "join", arms), text, rt.attr(re, "M")), null);
  return null;
});
check_kind_id = rt.fn("check_kind_id", (args, kwargs) => {
  let d: unknown;
  let kind: unknown;
  let p: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  p = rt.argument(args, kwargs, 1, "p", undefined);
  kind = rt.argument(args, kwargs, 2, "kind", undefined);
  if (
    rt.truth(
      rt.and(
        rt.compare("in", kind, ID_GRAMMAR),
        () =>
          !rt.truth(
            rt.method(
              re,
              "fullmatch",
              rt.method(rt.item(ID_GRAMMAR, kind), "strip", "^$"),
              rt.invoke(str, rt.get(d, "id", ""))
            )
          )
      )
    )
  ) {
    rt.invoke(
      err,
      p,
      [
        "id ",
        rt.format(rt.get(d, "id"), 114, null),
        " does not match the ",
        rt.format(kind, -1, null),
        ": id grammar (",
        rt.format(rt.item(ID_GRAMMAR, kind), -1, null),
        ")",
      ].join("")
    );
  }
  return null;
});
check_so = rt.call(record, [
  rt.fn("check_so", (args, kwargs) => {
    let allowed: unknown;
    let bare: unknown;
    let d: unknown;
    let f: unknown;
    let k: unknown;
    let obj: unknown;
    let p: unknown;
    let path: unknown;
    let pred: unknown;
    let preds: unknown;
    let span: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(
      need,
      d,
      [
        "id",
        "repository.commit",
        "repository.path",
        "source_span",
        "source_span.content_sha256",
        "extractor.id",
        "extractor.version",
        "extractor.script",
        "symbol",
        "observed_facts",
        "epistemic_status",
      ],
      p
    );
    rt.invoke(closed_keys, d, SO_KEYS, p, "SourceObservation");
    for (const loop4 of rt.iter(rt.method(SO_NESTED, "items"))) {
      k = rt.item(loop4, 0);
      allowed = rt.item(loop4, 1);
      rt.invoke(closed_keys, rt.get(d, k), allowed, p, k);
    }
    if (rt.truth(!rt.truth(rt.method(re, "match", "^so:sha256:[0-9a-f]{64}$", rt.invoke(str, rt.get(d, "id", "")))))) {
      rt.invoke(err, p, "id must be so:sha256:<64 hex>");
    } else {
      if (rt.truth(rt.compare("ne", rt.get(d, "id"), rt.invoke(canonical_obs_id, "so", d)))) {
        rt.invoke(
          err,
          p,
          "id does not equal the canonical digest of this record's content (commit, path, span, sorted facts, adapter id+version, JSON-canonical) — the id is computed, never asserted"
        );
      }
    }
    if (rt.truth(rt.compare("ne", rt.get(d, "epistemic_status"), "parser_derived"))) {
      rt.invoke(err, p, "SourceObservation epistemic_status must be parser_derived (prose uses po-)");
    }
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(is_exact_int, rt.get(d, "schema_version"))), () =>
          rt.compare("ne", rt.get(d, "schema_version"), 1)
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        ["schema_version must be the integer 1, got ", rt.format(rt.get(d, "schema_version"), 114, null)].join("")
      );
    }
    for (const loop5 of rt.iter(
      rt.tuple([
        "extractor.id",
        "extractor.version",
        "extractor.script",
        "extractor.parser",
        "symbol.lexical_name",
        "symbol.qualified_name",
        "symbol.syntactic_kind",
        "repository.commit",
        "repository.path",
      ])
    )) {
      k = loop5;
      rt.invoke(need_str, d, k, p);
    }
    rt.invoke(need_hex, d, "source_span.content_sha256", p, 64);
    span = rt.truth(rt.invoke(isinstance, rt.get(d, "source_span"), dict)) ? rt.get(d, "source_span") : rt.dict([]);
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(is_exact_int, rt.get(span, "start_line"))), () =>
          rt.or(!rt.truth(rt.invoke(is_exact_int, rt.get(span, "end_line"))), () =>
            rt.or(rt.compare("lt", rt.get(span, "start_line"), 1), () =>
              rt.compare("lt", rt.get(span, "end_line"), rt.get(span, "start_line"))
            )
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "source_span lines must be exact INTEGERS with 1 <= start_line <= end_line (strings and booleans are not coordinates)"
      );
    }
    path = rt.invoke(
      str,
      rt.or(rt.invoke(get, d, "repository.path"), () => "")
    );
    if (
      rt.truth(
        rt.and(
          rt.compare("in", "source_excerpt", d),
          () => !rt.truth(rt.invoke(isinstance, rt.get(d, "source_excerpt"), str))
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        ["source_excerpt must be a STRING, got ", rt.format(rt.get(d, "source_excerpt"), 114, null)].join("")
      );
    }
    preds = rt.invoke(set);
    for (const loop6 of rt.iter(rt.invoke(dicts, rt.get(d, "observed_facts"), p, "observed_facts"))) {
      f = loop6;
      rt.invoke(closed_keys, f, FACT_KEYS, p, "observed_facts entry");
      pred = rt.item(rt.tuple([rt.get(f, "predicate"), rt.get(f, "object")]), 0);
      obj = rt.item(rt.tuple([rt.get(f, "predicate"), rt.get(f, "object")]), 1);
      rt.method(preds, "add", pred);
      if (rt.truth(rt.compare("notin", pred, PREDICATES))) {
        rt.invoke(
          err,
          p,
          ["predicate ", rt.format(pred, 114, null), " outside the closed syntactic vocabulary"].join("")
        );
        continue;
      }
      if (rt.truth(rt.or(!rt.truth(rt.invoke(isinstance, obj, str)), () => !rt.truth(obj)))) {
        rt.invoke(
          err,
          p,
          [
            rt.format(pred, -1, null),
            ": object must be a non-empty STRING (a YAML integer is not a syntactic token), got ",
            rt.format(obj, 114, null),
          ].join("")
        );
        continue;
      }
      if (rt.truth(rt.compare("in", pred, IDENT_OBJ))) {
        bare = rt.method(re, "sub", "<[^<>]*>", "", obj);
        if (rt.truth(rt.method(re, "search", "[\\s/]", bare))) {
          rt.invoke(
            err,
            p,
            [rt.format(pred, -1, null), ": object ", rt.format(obj, 114, null), " is prose, not an identifier"].join("")
          );
        }
      } else {
        if (rt.truth(rt.compare("in", pred, CONFIG_OBJ))) {
          if (rt.truth(!rt.truth(rt.method(re, "match", "^[^\\s=/]+=\\S+$", obj)))) {
            rt.invoke(
              err,
              p,
              [
                "config_key_value: object must be '<key>=<value>' with a NON-EMPTY value, got ",
                rt.format(obj, 114, null),
                " — an empty value collapses pairing to key-only occurrence",
              ].join("")
            );
          }
          if (rt.truth(!rt.truth(rt.method(path, "endswith", CONFIG_EXTS)))) {
            rt.invoke(
              err,
              p,
              ["config_key_value is only legal for config-file paths, not ", rt.format(path, 114, null)].join("")
            );
          }
        }
      }
    }
    if (
      rt.truth(
        rt.and(rt.compare("in", "unrepresentable_construct", preds), () => rt.compare("gt", rt.invoke(len, preds), 1))
      )
    ) {
      rt.invoke(err, p, "unrepresentable_construct may not share a record with other predicates");
    }
    return null;
  }),
]);
so_is_unrepresentable_only = rt.fn("so_is_unrepresentable_only", (args, kwargs) => {
  let d: unknown;
  let f: unknown;
  let facts: unknown;
  let of: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  of = rt.get(d, "observed_facts");
  of = rt.truth(rt.invoke(isinstance, of, rt.tuple([list, tuple]))) ? of : [];
  facts = rt.comprehend(of, (item: unknown) => {
    let f: unknown;
    f = item;
    return rt.truth(rt.truth(rt.invoke(isinstance, f, dict))) ? f : rt.skip;
  });
  return rt.and(rt.invoke(bool, facts), () =>
    rt.invoke(
      all,
      rt.comprehend(facts, (item: unknown) => {
        let f: unknown;
        f = item;
        return rt.compare("eq", rt.get(f, "predicate"), "unrepresentable_construct");
      })
    )
  );
  return null;
});
check_po = rt.call(record, [
  rt.fn("check_po", (args, kwargs) => {
    let d: unknown;
    let k: unknown;
    let p: unknown;
    let span: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(
      need,
      d,
      [
        "id",
        "repository.commit",
        "repository.path",
        "source_span",
        "source_span.start_line",
        "source_span.end_line",
        "quote",
      ],
      p
    );
    rt.invoke(closed_keys, d, PO_KEYS, p, "ProseObservation");
    for (const loop7 of rt.iter(rt.tuple(["repository", "source_span"]))) {
      k = loop7;
      rt.invoke(
        closed_keys,
        rt.get(d, k),
        rt.truth(rt.compare("eq", k, "source_span"))
          ? rt.op("sub", rt.item(SO_NESTED, k), rt.set(["content_sha256"]))
          : rt.item(SO_NESTED, k),
        p,
        k
      );
    }
    if (rt.truth(!rt.truth(rt.method(re, "match", "^po:sha256:[0-9a-f]{64}$", rt.invoke(str, rt.get(d, "id", "")))))) {
      rt.invoke(err, p, "id must be po:sha256:<64 hex>");
    } else {
      if (rt.truth(rt.compare("ne", rt.get(d, "id"), rt.invoke(canonical_obs_id, "po", d)))) {
        rt.invoke(
          err,
          p,
          "id does not equal the canonical digest of (commit, path, span, quote) — the id is computed, never asserted"
        );
      }
    }
    if (rt.truth(rt.compare("ne", rt.get(d, "epistemic_status"), "quoted_prose"))) {
      rt.invoke(err, p, "ProseObservation epistemic_status must be quoted_prose");
    }
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(is_exact_int, rt.get(d, "schema_version"))), () =>
          rt.compare("ne", rt.get(d, "schema_version"), 1)
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        ["schema_version must be the integer 1, got ", rt.format(rt.get(d, "schema_version"), 114, null)].join("")
      );
    }
    for (const loop8 of rt.iter(rt.tuple(["repository.commit", "repository.path"]))) {
      k = loop8;
      rt.invoke(need_str, d, k, p);
    }
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(isinstance, rt.get(d, "quote"), str)), () =>
          rt.compare("lt", rt.invoke(len, rt.method(rt.get(d, "quote"), "strip")), 10)
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "quote must be a substantive verbatim STRING excerpt (>=10 chars stripped) — an integer or whitespace is not a quotation"
      );
    }
    span = rt.truth(rt.invoke(isinstance, rt.get(d, "source_span"), dict)) ? rt.get(d, "source_span") : rt.dict([]);
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(is_exact_int, rt.get(span, "start_line"))), () =>
          rt.or(!rt.truth(rt.invoke(is_exact_int, rt.get(span, "end_line"))), () =>
            rt.or(rt.compare("lt", rt.get(span, "start_line"), 1), () =>
              rt.compare("lt", rt.get(span, "end_line"), rt.get(span, "start_line"))
            )
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "source_span lines must be exact INTEGERS with 1 <= start_line <= end_line (strings and booleans are not coordinates)"
      );
    }
    return null;
  }),
]);
check_dh = rt.call(record, [
  rt.fn("check_dh", (args, kwargs) => {
    let a: unknown;
    let c: unknown;
    let conf: unknown;
    let d: unknown;
    let disc: unknown;
    let nh: unknown;
    let nhv: unknown;
    let p: unknown;
    let pat: unknown;
    let pr_ref: unknown;
    let ref: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(need, d, ["id", "observation_refs", "representation_status", "confidence"], p);
    rt.invoke(check_kind_id, d, p, "dh");
    rt.invoke(need_str, d, "proposed_referent.label", p);
    pr_ref = rt.get(d, "proposed_referent");
    if (rt.truth(rt.and(rt.compare("isnot", pr_ref, null), () => !rt.truth(rt.invoke(isinstance, pr_ref, dict))))) {
      rt.invoke(
        err,
        p,
        [
          "proposed_referent must be a MAPPING, got ",
          rt.format(pr_ref, 114, null),
          " — a scalar here would crash the membership check, and malformed input is a violation, never a crash",
        ].join("")
      );
    } else {
      if (
        rt.truth(
          rt.and(
            rt.compare(
              "in",
              "description",
              rt.or(pr_ref, () => rt.dict([]))
            ),
            () => !rt.truth(rt.invoke(isinstance, rt.invoke(get, d, "proposed_referent.description"), str))
          )
        )
      ) {
        rt.invoke(err, p, "proposed_referent.description must be a STRING");
      }
    }
    rt.invoke(need_str, d, "null_hypothesis.label", p);
    rt.invoke(need_str, d, "null_hypothesis.rationale", p);
    if (
      rt.truth(
        rt.and(
          rt.compare("isnot", rt.get(d, "observation_refs"), null),
          () => !rt.truth(rt.invoke(isinstance, rt.get(d, "observation_refs"), rt.tuple([list, tuple])))
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "observation_refs must be a list, got ",
          rt.format(rt.attr(rt.invoke(type, rt.get(d, "observation_refs")), "__name__"), -1, null),
        ].join("")
      );
    }
    if (rt.truth(rt.compare("isnot", rt.get(d, "cq_warrants"), null))) {
      if (rt.truth(!rt.truth(rt.invoke(isinstance, rt.get(d, "cq_warrants"), rt.tuple([list, tuple]))))) {
        rt.invoke(
          err,
          p,
          [
            "cq_warrants must be a list, got ",
            rt.format(rt.attr(rt.invoke(type, rt.get(d, "cq_warrants")), "__name__"), -1, null),
          ].join("")
        );
      }
      for (const loop9 of rt.iter(rt.invoke(aslist, rt.get(d, "cq_warrants")))) {
        c = loop9;
        if (rt.truth(!rt.truth(rt.method(re, "fullmatch", "CQ-[\\w-]+", rt.invoke(str, c))))) {
          rt.invoke(err, p, ["cq_warrants entry ", rt.format(c, 114, null), " is not a CQ id"].join(""));
        }
      }
    }
    nhv = rt.invoke(get, d, "null_hypothesis.rejected");
    if (rt.truth(rt.and(rt.compare("isnot", nhv, null), () => rt.compare("isnot", rt.invoke(type, nhv), bool)))) {
      rt.invoke(err, p, ["null_hypothesis.rejected must be a BOOLEAN, got ", rt.format(nhv, 114, null)].join(""));
    }
    if (rt.truth(rt.compare("notin", rt.get(d, "epistemic_status"), rt.tuple([null, "proposed"])))) {
      rt.invoke(err, p, "DenotationHypothesis epistemic_status must be proposed");
    }
    for (const loop10 of rt.iter(rt.invoke(dicts, rt.get(d, "alternatives"), p, "alternatives"))) {
      a = loop10;
      if (
        rt.truth(rt.and(rt.compare("in", "label", a), () => !rt.truth(rt.invoke(isinstance, rt.get(a, "label"), str))))
      ) {
        rt.invoke(
          err,
          p,
          ["alternatives.label must be a STRING, got ", rt.format(rt.get(a, "label"), 114, null)].join("")
        );
      }
      if (
        rt.truth(
          rt.and(rt.compare("isnot", rt.get(a, "representation_status"), null), () =>
            rt.compare("notin", rt.get(a, "representation_status"), REPR)
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            "alternatives.representation_status ",
            rt.format(rt.get(a, "representation_status"), 114, null),
            " invalid",
          ].join("")
        );
      }
      if (
        rt.truth(
          rt.and(rt.compare("isnot", rt.get(a, "plausibility"), null), () =>
            rt.compare("notin", rt.get(a, "plausibility"), rt.tuple(["viable", "weak"]))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          ["alternatives.plausibility ", rt.format(rt.get(a, "plausibility"), 114, null), " invalid"].join("")
        );
      }
    }
    for (const loop11 of rt.iter(rt.invoke(aslist, rt.get(d, "observation_refs")))) {
      ref = loop11;
      if (rt.truth(!rt.truth(rt.method(re, "match", "^(so|po):sha256:[0-9a-f]{64}$", rt.invoke(str, ref))))) {
        rt.invoke(err, p, ["observation_refs entry ", rt.format(ref, 114, null), " is not a full so:/po: id"].join(""));
      }
    }
    if (rt.truth(rt.compare("notin", rt.get(d, "representation_status"), REPR))) {
      rt.invoke(
        err,
        p,
        ["representation_status ", rt.format(rt.get(d, "representation_status"), 114, null), " invalid"].join("")
      );
    }
    nh = rt.truth(rt.invoke(isinstance, rt.get(d, "null_hypothesis"), dict))
      ? rt.get(d, "null_hypothesis")
      : rt.dict([]);
    if (rt.truth(rt.compare("notin", "rejected", nh))) {
      rt.invoke(err, p, "null_hypothesis.rejected missing");
    }
    if (rt.truth(rt.compare("is", rt.get(nh, "rejected"), true))) {
      if (
        rt.truth(
          rt.and(
            rt.compare("isnot", rt.get(nh, "discriminator"), null),
            () => !rt.truth(rt.invoke(isinstance, rt.get(nh, "discriminator"), str))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            "null_hypothesis.discriminator must be a STRING, got ",
            rt.format(rt.get(nh, "discriminator"), 114, null),
            " — a stringified number is not an observation-backed fact",
          ].join("")
        );
      }
      disc = rt.truth(rt.invoke(isinstance, rt.get(nh, "discriminator"), str))
        ? rt.method(
            rt.invoke(
              str,
              rt.or(rt.get(nh, "discriminator"), () => "")
            ),
            "strip"
          )
        : "";
      if (rt.truth(!rt.truth(disc))) {
        rt.invoke(err, p, "null rejected without a discriminator");
      } else {
        if (rt.truth(rt.compare("lt", rt.invoke(len, disc), 30))) {
          rt.invoke(
            err,
            p,
            ["discriminator too thin (", rt.format(rt.invoke(len, disc), -1, null), " chars)"].join("")
          );
        }
        for (const loop12 of rt.iter(DISC_DENYLIST)) {
          pat = loop12;
          if (rt.truth(rt.method(re, "search", pat, disc, rt.attr(re, "I")))) {
            rt.invoke(err, p, ["discriminator matches denylist pattern ", rt.format(pat, 114, null)].join(""));
          }
        }
        if (
          rt.truth(
            rt.compare(
              "eq",
              disc,
              rt.method(
                rt.invoke(
                  str,
                  rt.or(rt.get(nh, "rationale"), () => "")
                ),
                "strip"
              )
            )
          )
        ) {
          rt.invoke(err, p, "discriminator merely repeats the rationale");
        }
      }
    }
    conf = rt.get(d, "confidence");
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(isinstance, conf, dict)), () =>
          rt.or(rt.compare("isnot", rt.invoke(type, rt.get(conf, "use_for_acceptance")), bool), () =>
            rt.compare("isnot", rt.get(conf, "use_for_acceptance"), false)
          )
        )
      )
    ) {
      rt.invoke(err, p, "confidence block is REQUIRED with boolean use_for_acceptance: false");
    } else {
      if (
        rt.truth(
          rt.or(
            !rt.truth(rt.invoke(is_exact_num, rt.get(conf, "value"))),
            () => !rt.truth(rt.compare("le", 0, rt.get(conf, "value")) && rt.compare("le", rt.get(conf, "value"), 1))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          ["confidence.value must be a number in [0,1], got ", rt.format(rt.get(conf, "value"), 114, null)].join("")
        );
      }
    }
    if (rt.truth(rt.compare("in", "evidence", d))) {
      rt.invoke(err, p, "duplicate provenance edge: use observation_refs only");
    }
    return null;
  }),
]);
check_ic = rt.call(record, [
  rt.fn("check_ic", (args, kwargs) => {
    let ce: unknown;
    let ces: unknown;
    let crit: unknown;
    let d: unknown;
    let desc: unknown;
    let k: unknown;
    let oc: unknown;
    let p: unknown;
    let pat: unknown;
    let si_a: unknown;
    let si_b: unknown;
    let tp: unknown;
    let v: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(
      need,
      d,
      [
        "id",
        "hypothesis_ref",
        "identity.identity_criterion",
        "ontoclean",
        "ufo_analysis",
        "temporality",
        "counterexamples",
      ],
      p
    );
    rt.invoke(check_kind_id, d, p, "ic");
    if (rt.truth(!rt.truth(rt.invoke(is_tri, rt.invoke(get, d, "identity.supplies_identity"))))) {
      rt.invoke(err, p, "identity.supplies_identity must be true|false|unresolved");
    }
    crit = rt.invoke(get, d, "identity.identity_criterion");
    if (rt.truth(!rt.truth(rt.invoke(isinstance, crit, str)))) {
      rt.invoke(err, p, ["identity_criterion must be a STRING, got ", rt.format(crit, 114, null)].join(""));
      crit = "";
    }
    if (rt.truth(rt.compare("lt", rt.invoke(len, rt.method(crit, "strip")), 20))) {
      rt.invoke(err, p, "identity_criterion too thin");
    } else {
      if (
        rt.truth(
          rt.and(
            rt.method(re, "search", "\\bid (field|column)\\b|\\bidentifier\\b", crit, rt.attr(re, "I")),
            () => !rt.truth(rt.method(re, "search", "\\b(not|never|evidence|rather than)\\b", crit, rt.attr(re, "I")))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          "identity_criterion is identifier-is-identity — a technical key is evidence, never the criterion (padding the sentence does not change what it says)"
        );
      }
    }
    oc = rt.truth(rt.invoke(isinstance, rt.get(d, "ontoclean"), dict)) ? rt.get(d, "ontoclean") : rt.dict([]);
    if (rt.truth(rt.compare("notin", rt.get(oc, "rigidity"), RIGIDITY))) {
      rt.invoke(err, p, ["ontoclean.rigidity ", rt.format(rt.get(oc, "rigidity"), 114, null), " invalid"].join(""));
    }
    for (const loop13 of rt.iter(rt.tuple(["carries_identity", "supplies_identity"]))) {
      k = loop13;
      if (rt.truth(!rt.truth(rt.invoke(is_tri, rt.get(oc, k))))) {
        rt.invoke(
          err,
          p,
          [
            "ontoclean.",
            rt.format(k, -1, null),
            " must be BOOLEAN true|false or 'unresolved' (got ",
            rt.format(rt.get(oc, k), 114, null),
            " — integers are neither)",
          ].join("")
        );
      }
    }
    si_a = rt.item(rt.tuple([rt.invoke(get, d, "identity.supplies_identity"), rt.get(oc, "supplies_identity")]), 0);
    si_b = rt.item(rt.tuple([rt.invoke(get, d, "identity.supplies_identity"), rt.get(oc, "supplies_identity")]), 1);
    if (
      rt.truth(
        rt.and(rt.invoke(is_tri, si_a), () => rt.and(rt.invoke(is_tri, si_b), () => rt.compare("ne", si_a, si_b)))
      )
    ) {
      rt.invoke(
        err,
        p,
        "identity.supplies_identity and ontoclean.supplies_identity disagree — the two provider fields describe ONE fact (a boolean on one side and unresolved on the other IS disagreement: the fact is either settled or it is not)"
      );
    }
    if (rt.truth(rt.compare("notin", "unity", oc))) {
      rt.invoke(err, p, "ontoclean.unity missing (empty string is legal; absence is not)");
    } else {
      if (rt.truth(!rt.truth(rt.invoke(isinstance, rt.get(oc, "unity"), str)))) {
        rt.invoke(
          err,
          p,
          ["ontoclean.unity must be a STRING, got ", rt.format(rt.get(oc, "unity"), 114, null)].join("")
        );
      }
    }
    if (rt.truth(rt.compare("notin", rt.get(oc, "dependence"), DEPENDENCE))) {
      rt.invoke(err, p, ["ontoclean.dependence ", rt.format(rt.get(oc, "dependence"), 114, null), " invalid"].join(""));
    }
    if (rt.truth(rt.compare("notin", rt.invoke(get, d, "ufo_analysis.candidate_category"), CATEGORY))) {
      rt.invoke(err, p, "ufo_analysis.candidate_category invalid");
    }
    tp = rt.truth(rt.invoke(isinstance, rt.get(d, "temporality"), dict)) ? rt.get(d, "temporality") : rt.dict([]);
    for (const loop14 of rt.iter(rt.tuple(["exists_during_interval", "may_change_state_without_losing_identity"]))) {
      k = loop14;
      if (rt.truth(!rt.truth(rt.invoke(is_tri, rt.get(tp, k))))) {
        rt.invoke(
          err,
          p,
          ["temporality.", rt.format(k, -1, null), " must be BOOLEAN true|false or 'unresolved'"].join("")
        );
      }
    }
    if (rt.truth(rt.compare("ne", rt.get(d, "status"), "proposed"))) {
      rt.invoke(err, p, "status must be 'proposed'");
    }
    for (const loop15 of rt.iter(
      rt.tuple([
        "identity.reidentification_key",
        "ufo_analysis.alternatives",
        "ufo_analysis.existential_dependencies",
        "temporality.terminal_states",
      ])
    )) {
      k = loop15;
      v = rt.invoke(get, d, k);
      if (
        rt.truth(
          rt.and(rt.compare("isnot", v, null), () => !rt.truth(rt.invoke(isinstance, v, rt.tuple([list, tuple]))))
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            rt.format(k, -1, null),
            " must be a list, got ",
            rt.format(rt.attr(rt.invoke(type, v), "__name__"), -1, null),
          ].join("")
        );
      }
    }
    ces = rt.invoke(list, rt.invoke(dicts, rt.get(d, "counterexamples"), p, "counterexamples"));
    if (rt.truth(!rt.truth(ces))) {
      rt.invoke(err, p, "at least one counterexample must be attempted");
    }
    for (const loop16 of rt.iter(ces)) {
      ce = loop16;
      if (rt.truth(!rt.truth(rt.invoke(isinstance, rt.get(ce, "description"), str)))) {
        rt.invoke(
          err,
          p,
          ["counterexample.description must be a STRING, got ", rt.format(rt.get(ce, "description"), 114, null)].join(
            ""
          )
        );
        continue;
      }
      desc = rt.method(rt.get(ce, "description"), "strip");
      if (rt.truth(rt.compare("lt", rt.invoke(len, desc), 10))) {
        rt.invoke(err, p, "counterexample.description empty/trivial");
      }
      for (const loop17 of rt.iter(CE_DENYLIST)) {
        pat = loop17;
        if (rt.truth(rt.method(re, "search", pat, desc))) {
          rt.invoke(err, p, "counterexample.description is the template placeholder");
        }
      }
    }
    return null;
  }),
]);
check_fa = rt.call(record, [
  rt.fn("check_fa", (args, kwargs) => {
    let d: unknown;
    let p: unknown;
    let r: unknown;
    let rm: unknown;
    let t: unknown;
    let tests: unknown;
    let v: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(need, d, ["id", "hypothesis_ref", "identity_card_ref", "tests", "verdict"], p);
    rt.invoke(check_kind_id, d, p, "fa");
    tests = rt.truth(rt.invoke(isinstance, rt.get(d, "tests"), dict)) ? rt.get(d, "tests") : rt.dict([]);
    for (const loop18 of rt.iter(FA_TESTS)) {
      t = loop18;
      v = rt.get(tests, t);
      if (rt.truth(rt.compare("eq", t, "context_reification_needed"))) {
        if (rt.truth(!rt.truth(rt.invoke(is_tri, v)))) {
          rt.invoke(err, p, ["tests.", rt.format(t, -1, null), " must be BOOLEAN true|false or 'unresolved'"].join(""));
        }
      } else {
        if (rt.truth(rt.compare("notin", v, TEST_VALUES))) {
          rt.invoke(err, p, ["tests.", rt.format(t, -1, null), " missing/invalid"].join(""));
        }
      }
    }
    if (rt.truth(rt.compare("notin", rt.get(d, "verdict"), VERDICT))) {
      rt.invoke(err, p, ["verdict ", rt.format(rt.get(d, "verdict"), 114, null), " invalid"].join(""));
    }
    if (
      rt.truth(
        rt.and(
          rt.compare("in", "needed_evidence", d),
          () => !rt.truth(rt.invoke(isinstance, rt.get(d, "needed_evidence"), str))
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "needed_evidence must be a STRING, got ",
          rt.format(rt.get(d, "needed_evidence"), 114, null),
          " — it is printed as operative steward-facing text",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(rt.compare("eq", rt.get(d, "verdict"), "explicitly_deferred"), () =>
          rt.or(!rt.truth(rt.invoke(isinstance, rt.get(d, "needed_evidence"), str)), () =>
            rt.compare("lt", rt.invoke(len, rt.method(rt.get(d, "needed_evidence"), "strip")), 15)
          )
        )
      )
    ) {
      rt.invoke(err, p, "explicitly_deferred requires needed_evidence");
    }
    rm = rt.get(d, "rival_models");
    if (
      rt.truth(
        rt.and(rt.compare("isnot", rm, null), () => !rt.truth(rt.invoke(isinstance, rm, rt.tuple([list, tuple]))))
      )
    ) {
      rt.invoke(
        err,
        p,
        ["rival_models must be a list, got ", rt.format(rt.attr(rt.invoke(type, rm), "__name__"), -1, null)].join("")
      );
    }
    for (const loop19 of rt.iter(rt.invoke(dicts, rm, p, "rival_models"))) {
      r = loop19;
      if (
        rt.truth(
          rt.or(
            !rt.truth(rt.invoke(isinstance, rt.get(r, "label"), str)),
            () => !rt.truth(rt.method(rt.get(r, "label"), "strip"))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          ["rival_models.label must be a non-blank STRING, got ", rt.format(rt.get(r, "label"), 114, null)].join("")
        );
      }
      if (rt.truth(rt.compare("notin", "still_viable", r))) {
        rt.invoke(
          err,
          p,
          "rival_models entry missing still_viable — an unlabeled viability disappears from the silent-merge rule"
        );
      } else {
        if (rt.truth(rt.compare("isnot", rt.invoke(type, rt.get(r, "still_viable")), bool))) {
          rt.invoke(
            err,
            p,
            [
              "rival_models.still_viable must be a BOOLEAN, got ",
              rt.format(rt.get(r, "still_viable"), 114, null),
              " — strings AND integers that compare equal to a boolean are not booleans",
            ].join("")
          );
        }
      }
    }
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(isinstance, rt.get(d, "strongest_counterexample"), str)), () =>
          rt.compare("lt", rt.invoke(len, rt.method(rt.get(d, "strongest_counterexample"), "strip")), 10)
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "strongest_counterexample is required as a substantive STRING — an analysis that attempted no counterexample ran no adversarial test on itself"
      );
    }
    return null;
  }),
]);
fa_ran_no_tests = rt.fn("fa_ran_no_tests", (args, kwargs) => {
  let d: unknown;
  let t: unknown;
  let tests: unknown;
  d = rt.argument(args, kwargs, 0, "d", undefined);
  tests = rt.truth(rt.invoke(isinstance, rt.get(d, "tests"), dict)) ? rt.get(d, "tests") : rt.dict([]);
  return rt.invoke(
    all,
    rt.comprehend(FA_TESTS, (item: unknown) => {
      let t: unknown;
      t = item;
      return rt.truth(rt.truth(rt.compare("ne", t, "context_reification_needed")))
        ? rt.compare("eq", rt.get(tests, t), "unresolved")
        : rt.skip;
    })
  );
  return null;
});
check_otp = rt.call(record, [
  rt.fn("check_otp", (args, kwargs) => {
    let a: unknown;
    let addr: unknown;
    let c: unknown;
    let cqs: unknown;
    let d: unknown;
    let ds: unknown;
    let k: unknown;
    let m: unknown;
    let maps: unknown;
    let p: unknown;
    let parent: unknown;
    let pc: unknown;
    let reuse: unknown;
    let rk: unknown;
    let rl: unknown;
    let rv: unknown;
    let rvv: unknown;
    let s: unknown;
    let sup: unknown;
    let v: unknown;
    let w: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(
      need,
      d,
      [
        "id",
        "hypothesis_ref",
        "identity_card_ref",
        "foundational_status",
        "term.local_name",
        "definition.text",
        "foundational.ufo_category",
        "reuse",
        "operational_warrant",
        "status",
      ],
      p
    );
    rt.invoke(check_kind_id, d, p, "otp");
    if (rt.truth(rt.compare("notin", rt.get(d, "foundational_status"), VERDICT))) {
      rt.invoke(err, p, "foundational_status must be analyzed|explicitly_deferred");
    }
    if (rt.truth(rt.compare("ne", rt.get(d, "status"), "proposed"))) {
      rt.invoke(err, p, "status must be 'proposed'");
    }
    reuse = rt.get(d, "reuse");
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(isinstance, reuse, dict)), () =>
          rt.or(rt.compare("isnot", rt.invoke(type, rt.get(reuse, "searched")), bool), () =>
            rt.compare("isnot", rt.get(reuse, "searched"), true)
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "reuse.searched must be boolean true — declaring the search skipped does not exempt the mandatory reuse pass; run it"
      );
    }
    if (
      rt.truth(
        rt.and(rt.invoke(isinstance, reuse, dict), () =>
          rt.and(rt.compare("in", "exact_reuse_found", reuse), () =>
            rt.compare("isnot", rt.invoke(type, rt.get(reuse, "exact_reuse_found")), bool)
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "reuse.exact_reuse_found must be a BOOLEAN, got ",
          rt.format(rt.get(reuse, "exact_reuse_found"), 114, null),
          " — a string 'true' silently skips the mapping-evidence branch",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(rt.invoke(isinstance, reuse, dict), () =>
          rt.and(
            rt.compare("isnot", rt.get(reuse, "mappings"), null),
            () => !rt.truth(rt.invoke(isinstance, rt.get(reuse, "mappings"), rt.tuple([list, tuple])))
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "reuse.mappings must be a list, got ",
          rt.format(rt.attr(rt.invoke(type, rt.get(reuse, "mappings")), "__name__"), -1, null),
          " — the shape contract does not depend on which branch exact_reuse_found took",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(rt.invoke(isinstance, reuse, dict), () => rt.compare("is", rt.get(reuse, "exact_reuse_found"), true))
      )
    ) {
      maps = rt.invoke(list, rt.invoke(dicts, rt.get(reuse, "mappings"), p, "reuse.mappings"));
      if (rt.truth(!rt.truth(maps))) {
        rt.invoke(err, p, "exact_reuse_found without a mapping");
      }
      for (const loop20 of rt.iter(maps)) {
        m = loop20;
        if (
          rt.truth(
            rt.or(!rt.truth(rt.invoke(isinstance, rt.get(m, "iri"), str)), () =>
              rt.or(!rt.truth(rt.get(m, "iri")), () =>
                rt.or(!rt.truth(rt.invoke(isinstance, rt.get(m, "compatibility"), str)), () =>
                  rt.compare("lt", rt.invoke(len, rt.method(rt.get(m, "compatibility"), "strip")), 20)
                )
              )
            )
          )
        ) {
          rt.invoke(
            err,
            p,
            "each reuse mapping needs a STRING iri + a STRING compatibility justification (>=20 chars)"
          );
        }
      }
    }
    for (const loop21 of rt.iter(rt.invoke(dicts, rt.get(d, "parents"), p, "parents"))) {
      pc = loop21;
      parent = rt.get(pc, "parent");
      if (rt.truth(rt.or(!rt.truth(rt.invoke(isinstance, parent, str)), () => !rt.truth(parent)))) {
        rt.invoke(err, p, ["parents.parent must be a non-blank STRING, got ", rt.format(parent, 114, null)].join(""));
        continue;
      } else {
        if (rt.truth(rt.method(re, "search", "[\\s/]", rt.method(re, "sub", "<[^<>]*>", "", parent)))) {
          rt.invoke(
            err,
            p,
            [
              "parents.parent ",
              rt.format(parent, 114, null),
              " is prose, not a term identifier — a subsumption edge is a commitment, not a sentence",
            ].join("")
          );
        }
      }
      if (
        rt.truth(
          rt.or(!rt.truth(rt.invoke(isinstance, rt.get(pc, "justification"), str)), () =>
            rt.compare("lt", rt.invoke(len, rt.method(rt.get(pc, "justification"), "strip")), 20)
          )
        )
      ) {
        rt.invoke(err, p, "parents entry needs a substantive STRING justification (>=20 chars)");
      }
    }
    for (const loop22 of rt.iter(rt.invoke(dicts, rt.get(d, "revision_log"), p, "revision_log"))) {
      rl = loop22;
      if (
        rt.truth(
          rt.or(
            rt.compare("isnot", rt.invoke(type, rt.get(rl, "from_sha256")), str),
            () => !rt.truth(rt.method(re, "fullmatch", "[0-9a-f]{64}", rt.get(rl, "from_sha256")))
          )
        )
      ) {
        rt.invoke(err, p, "revision_log entry needs from_sha256 (64 hex of the FAILed bytes)");
      }
      addr = rt.get(rl, "addressed");
      if (
        rt.truth(
          rt.or(!rt.truth(rt.invoke(isinstance, addr, list)), () =>
            rt.or(!rt.truth(addr), () =>
              rt.invoke(
                any,
                rt.comprehend(addr, (item: unknown) => {
                  let a: unknown;
                  a = item;
                  return rt.or(!rt.truth(rt.invoke(isinstance, a, str)), () => !rt.truth(rt.method(a, "strip")));
                })
              )
            )
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          "revision_log.addressed must be a non-empty LIST of attack rule names — a scalar or blank entry is a guestbook signature"
        );
      }
    }
    for (const loop23 of rt.iter(rt.tuple(["ontoclean.rigidity", "ontoclean.dependence"]))) {
      k = loop23;
      if (
        rt.truth(
          !rt.truth(
            rt.method(
              rt.invoke(
                str,
                rt.or(rt.invoke(get, d, k), () => "")
              ),
              "strip"
            )
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            "missing/empty required field ",
            rt.format(k, -1, null),
            " — the proposal DERIVES its OntoClean block from its identity card; omitting it is not agreement",
          ].join("")
        );
      }
    }
    if (
      rt.truth(
        rt.compare(
          "notin",
          rt.invoke(get, d, "ontoclean.identity"),
          rt.tuple(["supplies", "carries", "none", "unresolved"])
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "ontoclean.identity must be supplies|carries|none|unresolved, got ",
          rt.format(rt.invoke(get, d, "ontoclean.identity"), 114, null),
          " — free prose lets 'does not supply' pass a substring test; a closed enum cannot lie by phrasing",
        ].join("")
      );
    }
    ds = rt.invoke(get, d, "definition.source");
    if (
      rt.truth(
        rt.and(rt.compare("isnot", ds, null), () => !rt.truth(rt.invoke(isinstance, ds, rt.tuple([list, tuple]))))
      )
    ) {
      rt.invoke(
        err,
        p,
        ["definition.source must be a list, got ", rt.format(rt.attr(rt.invoke(type, ds), "__name__"), -1, null)].join(
          ""
        )
      );
    }
    for (const loop24 of rt.iter(
      rt.tuple(["term.local_name", "term.preferred_label", "term.proposed_iri", "definition.text"])
    )) {
      k = loop24;
      rt.invoke(need_str, d, k, p);
    }
    if (
      rt.truth(
        rt.and(
          rt.compare(
            "in",
            "gufo_alignment",
            rt.or(rt.get(d, "foundational"), () => rt.dict([]))
          ),
          () => !rt.truth(rt.invoke(isinstance, rt.invoke(get, d, "foundational.gufo_alignment"), str))
        )
      )
    ) {
      rt.invoke(err, p, "foundational.gufo_alignment must be a STRING");
    }
    for (const loop25 of rt.iter(
      rt.tuple([
        "alternatives_rejected",
        "open_issues",
        "revision_requests",
        "operational_warrant.competency_questions",
        "operational_warrant.semantic_support_for",
      ])
    )) {
      k = loop25;
      v = rt.invoke(get, d, k);
      if (
        rt.truth(
          rt.and(rt.compare("isnot", v, null), () => !rt.truth(rt.invoke(isinstance, v, rt.tuple([list, tuple]))))
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            rt.format(k, -1, null),
            " must be a list, got ",
            rt.format(rt.attr(rt.invoke(type, v), "__name__"), -1, null),
            " — a scalar edge silently erased by list-coercion is an authority edge erased",
          ].join("")
        );
      }
    }
    if (
      rt.truth(
        rt.compare(
          "notin",
          rt.invoke(get, d, "term.owl_entity_kind"),
          rt.tuple(["class", "object_property", "data_property", "individual"])
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        ["term.owl_entity_kind ", rt.format(rt.invoke(get, d, "term.owl_entity_kind"), 114, null), " invalid"].join("")
      );
    }
    if (rt.truth(rt.compare("in", "review", d))) {
      rv = rt.get(d, "review");
      if (rt.truth(!rt.truth(rt.invoke(isinstance, rv, dict)))) {
        rt.invoke(
          err,
          p,
          [
            "review must be a MAPPING of stage -> status, got ",
            rt.format(rv, 114, null),
            " — the schema publishes this progress block as a mapping (authority still lives in .review.yaml + ratifications)",
          ].join("")
        );
      } else {
        for (const loop26 of rt.iter(rt.method(rv, "items"))) {
          rk = rt.item(loop26, 0);
          rvv = rt.item(loop26, 1);
          if (rt.truth(rt.or(!rt.truth(rt.invoke(isinstance, rvv, str)), () => !rt.truth(rt.method(rvv, "strip"))))) {
            rt.invoke(
              err,
              p,
              [
                "review.",
                rt.format(rk, -1, null),
                " must be a non-blank STRING status, got ",
                rt.format(rvv, 114, null),
              ].join("")
            );
          }
        }
      }
    }
    w = rt.truth(rt.invoke(isinstance, rt.get(d, "operational_warrant"), dict))
      ? rt.get(d, "operational_warrant")
      : rt.dict([]);
    cqs = rt.item(
      rt.tuple([
        rt.invoke(aslist, rt.get(w, "competency_questions")),
        rt.invoke(aslist, rt.get(w, "semantic_support_for")),
      ]),
      0
    );
    sup = rt.item(
      rt.tuple([
        rt.invoke(aslist, rt.get(w, "competency_questions")),
        rt.invoke(aslist, rt.get(w, "semantic_support_for")),
      ]),
      1
    );
    if (rt.truth(rt.and(!rt.truth(cqs), () => !rt.truth(sup)))) {
      rt.invoke(err, p, "no operational warrant");
    }
    if (rt.truth(rt.and(cqs, () => sup))) {
      rt.invoke(err, p, "a term is a DECISION term (CQs) or a SUPPORT term — never both");
    }
    for (const loop27 of rt.iter(cqs)) {
      c = loop27;
      if (rt.truth(rt.or(!rt.truth(rt.invoke(isinstance, c, str)), () => !rt.truth(rt.method(c, "strip"))))) {
        rt.invoke(
          err,
          p,
          ["competency_questions entry ", rt.format(c, 114, null), " is not a non-blank CQ id"].join("")
        );
      }
    }
    for (const loop28 of rt.iter(sup)) {
      s = loop28;
      s = rt.invoke(str, s);
      if (
        rt.truth(!rt.truth(rt.or(rt.method(s, "startswith", "otp:"), () => rt.method(re, "match", "^https?://", s))))
      ) {
        rt.invoke(
          err,
          p,
          ["semantic_support_for entry ", rt.format(s, 114, null), " must be an otp: id or a ratified term IRI"].join(
            ""
          )
        );
      }
      if (
        rt.truth(
          rt.or(rt.compare("eq", s, rt.invoke(str, rt.get(d, "id"))), () =>
            rt.compare(
              "eq",
              s,
              rt.invoke(
                str,
                rt.or(rt.invoke(get, d, "term.proposed_iri"), () => "\u0000")
              )
            )
          )
        )
      ) {
        rt.invoke(err, p, "semantic_support_for is self-referential");
      }
    }
    return null;
  }),
]);
check_rat = rt.call(record, [
  rt.fn("check_rat", (args, kwargs) => {
    let d: unknown;
    let datetime: unknown;
    let fname: unknown;
    let m: unknown;
    let p: unknown;
    let ts: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(
      need,
      d,
      ["id", "proposal_ref", "proposal_sha256", "decision", "steward.id", "decided_at", "verbatim_decision"],
      p
    );
    rt.invoke(check_kind_id, d, p, "rat");
    rt.invoke(need_str, d, "steward.id", p);
    rt.invoke(need_str, d, "steward.name", p);
    fname = rt.invoke(str, rt.invoke(getattr, p, "name", ""));
    m = rt.method(re, "match", "^rat-0*(\\d+)\\.yaml$", fname);
    if (rt.truth(rt.and(rt.method(fname, "startswith", "rat-"), () => !rt.truth(m)))) {
      rt.invoke(
        err,
        p,
        [
          "ratification filename ",
          rt.format(fname, 114, null),
          " must be rat-<nnn>.yaml — a non-numeric authority filename escapes the numbering lifecycle",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(m, () =>
          rt.compare(
            "ne",
            rt.invoke(str, rt.get(d, "id")),
            ["rat:", rt.format(rt.invoke(int, rt.method(m, "group", 1)), -1, null)].join("")
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "file ",
          rt.format(fname, -1, null),
          " carries id ",
          rt.format(rt.get(d, "id"), 114, null),
          " — the filename number and record id must agree or numbering games hide decisions",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.or(
          rt.compare("isnot", rt.invoke(type, rt.get(d, "proposal_sha256")), str),
          () => !rt.truth(rt.method(re, "fullmatch", "[0-9a-f]{64}", rt.get(d, "proposal_sha256")))
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "proposal_sha256 must be the sha256 of the proposal FILE bytes the steward actually saw — an id-only ratification authorizes whatever the file later becomes"
      );
    }
    if (rt.truth(rt.compare("notin", rt.get(d, "decision"), DECISION))) {
      rt.invoke(err, p, ["decision ", rt.format(rt.get(d, "decision"), 114, null), " invalid"].join(""));
    }
    if (rt.truth(!rt.truth(rt.invoke(isinstance, rt.get(d, "decided_at"), str)))) {
      rt.invoke(
        err,
        p,
        ["decided_at must be a STRING timestamp, got ", rt.format(rt.get(d, "decided_at"), 114, null)].join("")
      );
    }
    ts = rt.invoke(
      str,
      rt.or(rt.get(d, "decided_at"), () => "")
    );
    try {
      datetime = rt.attr(rt.module("datetime"), "datetime");
      rt.method(datetime, "fromisoformat", rt.method(ts, "replace", "Z", "+00:00"));
    } catch (caught) {
      if (rt.catches(caught, ValueError)) {
        rt.invoke(
          err,
          p,
          "decided_at must be a PARSEABLE ISO8601 date/timestamp (2026-99-99 is a shape, not a date) — authority metadata conforms or it is not authority metadata"
        );
      } else {
        throw caught;
      }
    }
    rt.invoke(need_str, d, "verbatim_decision", p);
    if (
      rt.truth(
        rt.and(rt.compare("in", "rationale", d), () => !rt.truth(rt.invoke(isinstance, rt.get(d, "rationale"), str)))
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "rationale must be a STRING, got ",
          rt.format(rt.get(d, "rationale"), 114, null),
          " — authority prose is text, not a stringified scalar",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(rt.compare("in", rt.get(d, "decision"), rt.tuple(["reject", "revise"])), () =>
          rt.or(!rt.truth(rt.invoke(isinstance, rt.get(d, "rationale"), str)), () =>
            rt.compare("lt", rt.invoke(len, rt.method(rt.get(d, "rationale"), "strip")), 20)
          )
        )
      )
    ) {
      rt.invoke(err, p, "reject/revise requires a substantive rationale (>=20 chars)");
    }
    return null;
  }),
]);
check_rej = rt.call(record, [
  rt.fn("check_rej", (args, kwargs) => {
    let d: unknown;
    let fname: unknown;
    let m: unknown;
    let p: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(need, d, ["id", "proposal_ref", "rationale"], p);
    rt.invoke(check_kind_id, d, p, "rej");
    fname = rt.invoke(str, rt.invoke(getattr, p, "name", ""));
    m = rt.method(re, "match", "^rej-0*(\\d+)\\.yaml$", fname);
    if (rt.truth(rt.and(rt.method(fname, "startswith", "rej-"), () => !rt.truth(m)))) {
      rt.invoke(err, p, ["rejection filename ", rt.format(fname, 114, null), " must be rej-<nnn>.yaml"].join(""));
    }
    if (
      rt.truth(
        rt.and(m, () =>
          rt.compare(
            "ne",
            rt.invoke(str, rt.get(d, "id")),
            ["rej:", rt.format(rt.invoke(int, rt.method(m, "group", 1)), -1, null)].join("")
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "file ",
          rt.format(fname, -1, null),
          " carries id ",
          rt.format(rt.get(d, "id"), 114, null),
          " — filename number and record id must agree",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.or(!rt.truth(rt.invoke(isinstance, rt.get(d, "rationale"), str)), () =>
          rt.compare("lt", rt.invoke(len, rt.method(rt.get(d, "rationale"), "strip")), 20)
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "rejection-ledger rationale must be a substantive STRING (>=20 chars) — it is what stops future re-proposal"
      );
    }
    return null;
  }),
]);
check_review = rt.call(record, [
  rt.fn("check_review", (args, kwargs) => {
    let a: unknown;
    let attacks: unknown;
    let d: unknown;
    let e: unknown;
    let ev: unknown;
    let k: unknown;
    let landed: unknown;
    let p: unknown;
    let reasons: unknown;
    let rr: unknown;
    let s: unknown;
    let surf: unknown;
    let v: unknown;
    let x: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(need, d, ["target", "target_sha256", "chain_sha256", "seat", "verdict", "surfaces"], p);
    if (
      rt.truth(
        !rt.truth(
          rt.method(
            re,
            "match",
            "^otp:[\\w-]+:\\d+$",
            rt.invoke(
              str,
              rt.or(rt.get(d, "target"), () => "")
            )
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        "review target must be an otp: id — edge reviews bind to nothing; taxonomy edges live in the proposal's parents and are reviewed there"
      );
    }
    for (const loop29 of rt.iter(rt.tuple(["target_sha256", "chain_sha256"]))) {
      k = loop29;
      if (
        rt.truth(
          rt.or(
            rt.compare("isnot", rt.invoke(type, rt.get(d, k)), str),
            () => !rt.truth(rt.method(re, "fullmatch", "[0-9a-f]{64}", rt.get(d, k)))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            rt.format(k, -1, null),
            " must be 64 hex (target = proposal file bytes; chain = FRAMED sha256 over the OTP+IC+FA+DH files plus the cited SO/PO records, sorted by filename — filename+length+bytes per member, then the CQ-suite digest as a virtual member)",
          ].join("")
        );
      }
    }
    if (rt.truth(rt.compare("ne", rt.get(d, "seat"), "ontoclean-adversary"))) {
      rt.invoke(err, p, "review dispositions are the ADVERSARY seat's artifact");
    }
    if (rt.truth(rt.compare("notin", rt.get(d, "verdict"), REVIEW_VERDICT))) {
      rt.invoke(err, p, ["verdict ", rt.format(rt.get(d, "verdict"), 114, null), " invalid"].join(""));
    }
    if (
      rt.truth(
        rt.and(
          rt.compare("in", "needed_evidence", d),
          () => !rt.truth(rt.invoke(isinstance, rt.get(d, "needed_evidence"), str))
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "needed_evidence must be a STRING, got ",
          rt.format(rt.get(d, "needed_evidence"), 114, null),
          " — it is printed as operative FLAGGED text at the gate",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(rt.compare("eq", rt.get(d, "verdict"), "INDETERMINATE"), () =>
          rt.or(!rt.truth(rt.invoke(isinstance, rt.get(d, "needed_evidence"), str)), () =>
            rt.compare("lt", rt.invoke(len, rt.method(rt.get(d, "needed_evidence"), "strip")), 15)
          )
        )
      )
    ) {
      rt.invoke(err, p, "INDETERMINATE must name the discriminating evidence");
    }
    surf = rt.truth(rt.invoke(isinstance, rt.get(d, "surfaces"), dict)) ? rt.get(d, "surfaces") : rt.dict([]);
    if (
      rt.truth(
        rt.and(
          rt.compare("in", "no_surface_reasons", d),
          () => !rt.truth(rt.invoke(isinstance, rt.get(d, "no_surface_reasons"), dict))
        )
      )
    ) {
      rt.invoke(err, p, "no_surface_reasons must be a MAPPING");
    }
    if (
      rt.truth(
        rt.and(
          rt.compare("in", "rival_models_still_viable", d),
          () => !rt.truth(rt.invoke(isinstance, rt.get(d, "rival_models_still_viable"), rt.tuple([list, tuple])))
        )
      )
    ) {
      rt.invoke(err, p, "rival_models_still_viable must be a LIST — a scalar suppresses the DISPUTED flag by shape");
    }
    reasons = rt.truth(rt.invoke(isinstance, rt.get(d, "no_surface_reasons"), dict))
      ? rt.get(d, "no_surface_reasons")
      : rt.dict([]);
    attacks = rt.invoke(list, rt.invoke(dicts, rt.get(d, "attacks"), p, "attacks"));
    landed = false;
    for (const loop30 of rt.iter(SURFACES)) {
      s = loop30;
      v = rt.get(surf, s);
      if (rt.truth(rt.compare("notin", v, rt.tuple(["attacked", "no_surface"])))) {
        rt.invoke(err, p, ["surfaces.", rt.format(s, -1, null), " must be attacked|no_surface"].join(""));
      } else {
        if (rt.truth(rt.compare("eq", v, "no_surface"))) {
          if (rt.truth(rt.compare("in", s, ALWAYS_PRESENT_SURFACES))) {
            rt.invoke(err, p, ["surfaces.", rt.format(s, -1, null), " cannot be no_surface"].join(""));
          } else {
            if (
              rt.truth(
                rt.or(!rt.truth(rt.invoke(isinstance, rt.get(reasons, s), str)), () =>
                  rt.compare("lt", rt.invoke(len, rt.method(rt.get(reasons, s), "strip")), 10)
                )
              )
            ) {
              rt.invoke(
                err,
                p,
                [
                  "surfaces.",
                  rt.format(s, -1, null),
                  ": no_surface requires a concrete STRING reason (a stringified scalar is not a reason)",
                ].join("")
              );
            }
          }
        } else {
          if (
            rt.truth(
              !rt.truth(
                rt.invoke(
                  any,
                  rt.comprehend(attacks, (item: unknown) => {
                    let a: unknown;
                    a = item;
                    return rt.compare("eq", rt.get(a, "surface"), s);
                  })
                )
              )
            )
          ) {
            rt.invoke(
              err,
              p,
              [
                "surfaces.",
                rt.format(s, -1, null),
                " claims attacked but no attack row carries surface: ",
                rt.format(s, -1, null),
              ].join("")
            );
          }
        }
      }
    }
    for (const loop31 of rt.iter(attacks)) {
      a = loop31;
      if (rt.truth(rt.compare("notin", rt.get(a, "outcome"), rt.tuple(["landed", "survived"])))) {
        rt.invoke(err, p, ["attack outcome ", rt.format(rt.get(a, "outcome"), 114, null), " invalid"].join(""));
      }
      if (rt.truth(rt.compare("notin", rt.get(a, "surface"), SURFACES))) {
        rt.invoke(err, p, ["attack surface ", rt.format(rt.get(a, "surface"), 114, null), " invalid"].join(""));
      }
      if (
        rt.truth(
          rt.or(
            !rt.truth(rt.invoke(isinstance, rt.get(a, "rule"), str)),
            () => !rt.truth(rt.method(rt.get(a, "rule"), "strip"))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          "every attack row needs a non-blank STRING rule — an unnamed attack cannot be joined to a revision_log and never has to be answered"
        );
      }
      if (
        rt.truth(
          rt.or(!rt.truth(rt.invoke(isinstance, rt.get(a, "counterexample"), str)), () =>
            rt.compare("lt", rt.invoke(len, rt.method(rt.get(a, "counterexample"), "strip")), 10)
          )
        )
      ) {
        rt.invoke(err, p, "every attack row needs a concrete STRING counterexample");
      }
      landed = rt.or(landed, () => rt.compare("eq", rt.get(a, "outcome"), "landed"));
    }
    if (rt.truth(rt.and(rt.compare("eq", rt.get(d, "verdict"), "PASS"), () => landed))) {
      rt.invoke(err, p, "verdict PASS with a landed attack is self-contradictory");
    }
    if (rt.truth(rt.and(rt.compare("eq", rt.get(d, "verdict"), "FAIL"), () => !rt.truth(landed)))) {
      rt.invoke(
        err,
        p,
        "verdict FAIL with zero landed attacks is self-contradictory — what failed, if nothing landed? (and an empty landed set makes the revision_log join vacuous)"
      );
    }
    if (rt.truth(rt.compare("in", "revision_requests", d))) {
      rr = rt.get(d, "revision_requests");
      if (rt.truth(!rt.truth(rt.invoke(isinstance, rr, rt.tuple([list, tuple]))))) {
        rt.invoke(
          err,
          p,
          [
            "revision_requests must be a LIST of non-blank strings, got ",
            rt.format(rt.attr(rt.invoke(type, rr), "__name__"), -1, null),
            " — it is the adversary's ONLY legal repair channel",
          ].join("")
        );
      } else {
        for (const loop32 of rt.iter(rr)) {
          x = loop32;
          if (rt.truth(rt.or(!rt.truth(rt.invoke(isinstance, x, str)), () => !rt.truth(rt.method(x, "strip"))))) {
            rt.invoke(
              err,
              p,
              ["revision_requests entry ", rt.format(x, 114, null), " is not a non-blank STRING"].join("")
            );
          }
        }
      }
    }
    ev = rt.invoke(aslist, rt.get(d, "evidence"));
    if (rt.truth(!rt.truth(ev))) {
      rt.invoke(err, p, "evidence must cite the observation/CQ ids the verdict stands on");
    }
    for (const loop33 of rt.iter(ev)) {
      e = loop33;
      if (
        rt.truth(!rt.truth(rt.method(re, "fullmatch", "(so|po):sha256:[0-9a-f]{64}|CQ-[\\w-]+", rt.invoke(str, e))))
      ) {
        rt.invoke(
          err,
          p,
          ["evidence entry ", rt.format(e, 114, null), " is not a full observation id or CQ id"].join("")
        );
      }
    }
    return null;
  }),
]);
check_manifest = rt.call(record, [
  rt.fn("check_manifest", (args, kwargs) => {
    let a: unknown;
    let agents: unknown;
    let cf: unknown;
    let contracts: unknown;
    let cq_count: unknown;
    let d: unknown;
    let data: unknown;
    let eng: unknown;
    let expected_prompt: unknown;
    let f: unknown;
    let hc: unknown;
    let k: unknown;
    let p: unknown;
    let pi: unknown;
    let pw: unknown;
    let role: unknown;
    let shared: unknown;
    let v: unknown;
    let want_con: unknown;
    let want_val: unknown;
    d = rt.argument(args, kwargs, 0, "d", undefined);
    p = rt.argument(args, kwargs, 1, "p", undefined);
    rt.invoke(
      need,
      d,
      ["run_id", "repository.commit", "ontology.name", "scope_doc.path", "cq_suite.path", "adapters", "agents"],
      p
    );
    cq_count = rt.invoke(get, d, "cq_suite.cq_count");
    if (rt.truth(rt.or(!rt.truth(rt.invoke(is_exact_int, cq_count)), () => rt.compare("lt", cq_count, 1)))) {
      rt.invoke(
        err,
        p,
        "cq_suite.cq_count must be an exact INTEGER >= 1 (the zero-CQ HARD STOP; a YAML boolean is not a count)"
      );
    }
    if (rt.truth(!rt.truth(rt.invoke(valid_run_id, rt.get(d, "run_id"))))) {
      rt.invoke(
        err,
        p,
        "run_id must match the closed grammar orun-YYYY-MM-DDTHH:MM:SS[.f][Z|±HH:MM] on the EXACT string (orun-999 is a character class; a `/` separator nests archive paths; edge whitespace and control bytes are not normalized away) — the SAME grammar --print-run-id enforces"
      );
    }
    if (rt.truth(!rt.truth(rt.invoke(isinstance, rt.invoke(get, d, "ontology.name"), str)))) {
      rt.invoke(err, p, "ontology.name must be a string");
    }
    rt.invoke(need_bool, d, "repository.dirty", p);
    rt.invoke(need_bool, d, "first_run", p);
    pw = rt.invoke(get, d, "repository.pin_waived");
    if (rt.truth(rt.and(rt.compare("isnot", pw, null), () => rt.compare("isnot", rt.invoke(type, pw), bool)))) {
      rt.invoke(
        err,
        p,
        [
          "repository.pin_waived must be a BOOLEAN, got ",
          rt.format(pw, 114, null),
          " — neither a string that says 'no' nor an integer may read as a waiver state",
        ].join("")
      );
      pw = null;
    }
    if (rt.truth(rt.compare("is", pw, true))) {
      rt.call(need_str, [d, "repository.waiver_reason", p], { minlen: 20 });
    }
    if (
      rt.truth(
        rt.and(rt.compare("is", rt.invoke(get, d, "repository.dirty"), true), () => rt.compare("isnot", pw, true))
      )
    ) {
      rt.invoke(err, p, "dirty source requires pin_waived: true with a reason");
    }
    for (const loop34 of rt.iter(rt.tuple(["scope_doc.path", "cq_suite.path", "repository.commit"]))) {
      k = loop34;
      rt.invoke(need_str, d, k, p);
    }
    rt.invoke(need_hex, d, "scope_doc.sha256_12", p, 12);
    rt.invoke(need_hex, d, "cq_suite.sha256_12", p, 12);
    for (const loop35 of rt.iter(rt.invoke(dicts, rt.get(d, "adapters"), p, "adapters"))) {
      a = loop35;
      for (const loop36 of rt.iter(rt.tuple(["id", "version", "script", "golden_fixture"]))) {
        k = loop36;
        if (
          rt.truth(
            rt.or(
              !rt.truth(rt.invoke(isinstance, rt.get(a, k), str)),
              () => !rt.truth(rt.method(rt.get(a, k), "strip"))
            )
          )
        ) {
          rt.invoke(
            err,
            p,
            [
              "adapters entry ",
              rt.format(k, -1, null),
              " must be a non-blank STRING, got ",
              rt.format(rt.get(a, k), 114, null),
              " — a YAML integer joins nothing; the extractor tuple is text",
            ].join("")
          );
        }
      }
      rt.invoke(need_hex, a, "script_sha256_12", p, 12);
    }
    agents = rt.truth(rt.invoke(isinstance, rt.get(d, "agents"), dict)) ? rt.get(d, "agents") : rt.dict([]);
    for (const loop37 of rt.iter(rt.method(PROMPT_ROLES, "items"))) {
      role = rt.item(loop37, 0);
      expected_prompt = rt.item(loop37, 1);
      a = rt.truth(rt.invoke(isinstance, rt.get(agents, role), dict)) ? rt.get(agents, role) : rt.dict([]);
      if (
        rt.truth(
          rt.or(
            !rt.truth(rt.invoke(isinstance, rt.get(a, "model"), str)),
            () => !rt.truth(rt.method(rt.get(a, "model"), "strip"))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            "agents.",
            rt.format(role, -1, null),
            ".model must be a non-blank STRING, got ",
            rt.format(rt.get(a, "model"), 114, null),
          ].join("")
        );
      }
      if (
        rt.truth(
          rt.or(
            !rt.truth(rt.invoke(isinstance, rt.get(a, "effort"), str)),
            () => !rt.truth(rt.method(rt.get(a, "effort"), "strip"))
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            "agents.",
            rt.format(role, -1, null),
            ".effort must be a non-blank STRING naming the launched reasoning-effort setting (default for a model without an effort control), got ",
            rt.format(rt.get(a, "effort"), 114, null),
          ].join("")
        );
      }
      if (rt.truth(rt.compare("ne", rt.get(a, "prompt"), expected_prompt))) {
        rt.invoke(
          err,
          p,
          [
            "agents.",
            rt.format(role, -1, null),
            ".prompt must be ",
            rt.format(expected_prompt, 114, null),
            " — the role-to-prompt binding is fixed; an omitted or swapped prompt path makes the digest lock meaningless",
          ].join("")
        );
      } else {
        f = rt.op("div", SKILL_DIR, expected_prompt);
        if (rt.truth(!rt.truth(rt.method(f, "is_file")))) {
          rt.invoke(
            err,
            p,
            [
              "agents.",
              rt.format(role, -1, null),
              ": shipped prompt missing at ",
              rt.format(expected_prompt, -1, null),
            ].join("")
          );
        } else {
          if (rt.truth(rt.compare("ne", rt.invoke(sha12, rt.method(f, "read_bytes")), rt.get(a, "prompt_sha256_12")))) {
            rt.invoke(
              err,
              p,
              ["agents.", rt.format(role, -1, null), ".prompt_sha256_12 does not match the shipped prompt bytes"].join(
                ""
              )
            );
          }
        }
      }
    }
    if (rt.truth(rt.compare("isnot", rt.invoke(need_bool, d, "agents.adversary.independent_context", p), true))) {
      rt.invoke(err, p, "agents.adversary.independent_context must be boolean true");
    }
    if (rt.truth(rt.compare("isnot", rt.invoke(need_bool, d, "agents.alternative.blinded", p), true))) {
      rt.invoke(err, p, "agents.alternative.blinded must be boolean true");
    }
    eng = rt.truth(rt.invoke(isinstance, rt.get(d, "engine"), dict)) ? rt.get(d, "engine") : rt.dict([]);
    want_val = rt.invoke(sha12, rt.method(rt.method(rt.invoke(Path, __file__), "resolve"), "read_bytes"));
    shared = rt.op("div", rt.attr(SKILL_DIR, "parent"), "_shared");
    contracts = rt.call(
      sorted,
      [
        rt.op(
          "add",
          rt.op(
            "add",
            rt.op(
              "add",
              rt.op(
                "add",
                rt.invoke(list, rt.method(rt.op("div", shared, "schemas"), "glob", "*.yaml")),
                rt.invoke(list, rt.method(shared, "glob", "*.yaml"))
              ),
              rt.invoke(list, rt.method(shared, "glob", "*.md"))
            ),
            rt.invoke(list, rt.method(shared, "glob", "*.json"))
          ),
          rt.invoke(list, rt.method(rt.op("div", SKILL_DIR, "templates"), "glob", "*.yaml"))
        ),
      ],
      {
        key: rt.fn("lambda", (args, kwargs) => {
          let f: unknown;
          f = rt.argument(args, kwargs, 0, "f", undefined);
          return rt.invoke(str, rt.method(f, "relative_to", rt.attr(SKILL_DIR, "parent")));
          return null;
        }),
      }
    );
    hc = rt.method(hashlib, "sha256");
    for (const loop38 of rt.iter(contracts)) {
      cf = loop38;
      data = rt.method(cf, "read_bytes");
      rt.method(
        hc,
        "update",
        rt.method(
          [
            rt.format(rt.method(cf, "relative_to", rt.attr(SKILL_DIR, "parent")), -1, null),
            "\n",
            rt.format(rt.invoke(len, data), -1, null),
            "\n",
          ].join(""),
          "encode"
        )
      );
      rt.method(hc, "update", data);
    }
    want_con = rt.item(rt.method(hc, "hexdigest"), rt.slice(undefined, 12, undefined));
    if (rt.truth(rt.compare("ne", rt.get(eng, "validator_sha256_12"), want_val))) {
      rt.invoke(
        err,
        p,
        [
          "engine.validator_sha256_12 must equal the digest of the validator that judges this run (",
          rt.format(want_val, -1, null),
          ") — a manifest that cannot name its engine reconstructs nothing",
        ].join("")
      );
    }
    if (rt.truth(rt.compare("ne", rt.get(eng, "contracts_sha256_12"), want_con))) {
      rt.invoke(
        err,
        p,
        [
          "engine.contracts_sha256_12 must equal the framed digest of the FULL contract closure — shared schemas, rules, references, the namespace map, and the skill templates (",
          rt.format(want_con, -1, null),
          ")",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(
          rt.compare("isnot", rt.get(d, "first_run"), true),
          () =>
            !rt.truth(
              rt.method(
                rt.invoke(
                  str,
                  rt.or(rt.get(d, "prior_index"), () => "")
                ),
                "strip"
              )
            )
        )
      )
    ) {
      rt.invoke(err, p, "prior_index must name the previous run's index (first_run: true is the only exemption)");
    }
    pi = rt.method(
      rt.invoke(
        str,
        rt.or(rt.get(d, "prior_index"), () => "")
      ),
      "strip"
    );
    if (rt.truth(rt.and(rt.compare("is", rt.get(d, "first_run"), true), () => pi))) {
      rt.invoke(
        err,
        p,
        "first_run: true with a prior_index is a contradiction — a first run has no predecessor; a non-first run may not claim firstness"
      );
    }
    if (rt.truth(pi)) {
      if (rt.truth(!rt.truth(rt.method(re, "fullmatch", "runs/orun-[^/]+\\.index\\.yaml", pi)))) {
        rt.invoke(
          err,
          p,
          [
            "prior_index ",
            rt.format(pi, 114, null),
            " must be an ARCHIVED index (runs/<run_id>.index.yaml) — the current canonical index or any other live path is not a predecessor",
          ].join("")
        );
      }
      if (rt.truth(rt.compare("is", rt.invoke(need_hex, d, "prior_index_sha256_12", p, 12), null))) {
        rt.invoke(
          err,
          p,
          "prior_index_sha256_12 (12 hex of the prior index file BYTES, exact-type string) is required — an unauthenticated prior index is mutable carry-forward authority"
        );
      }
    }
    for (const loop39 of rt.iter(rt.tuple(["empty_corpus_reason", "unresolved_fraction_waiver"]))) {
      k = loop39;
      v = rt.get(d, k);
      if (
        rt.truth(
          rt.and(rt.compare("notin", v, rt.tuple([null, ""])), () =>
            rt.or(!rt.truth(rt.invoke(isinstance, v, str)), () =>
              rt.compare("lt", rt.invoke(len, rt.method(v, "strip")), 20)
            )
          )
        )
      ) {
        rt.invoke(err, p, [rt.format(k, -1, null), " must be a substantive reason (>=20 chars)"].join(""));
      }
    }
    return null;
  }),
]);
cross_check_chain = rt.fn("cross_check_chain", (args, kwargs) => {
  let _: unknown;
  let d: unknown;
  let dh: unknown;
  let dh_by: unknown;
  let dhs: unknown;
  let fa: unknown;
  let fa_by_hyp: unknown;
  let fas: unknown;
  let hyp: unknown;
  let ic: unknown;
  let ic_by: unknown;
  let icr: unknown;
  let ics: unknown;
  let nh: unknown;
  let o: unknown;
  let obs_ids: unknown;
  let otps: unknown;
  let out: unknown;
  let p: unknown;
  let r: unknown;
  let ref: unknown;
  let siblings: unknown;
  otps = rt.argument(args, kwargs, 0, "otps", undefined);
  dhs = rt.argument(args, kwargs, 1, "dhs", undefined);
  ics = rt.argument(args, kwargs, 2, "ics", undefined);
  fas = rt.argument(args, kwargs, 3, "fas", undefined);
  obs_ids = rt.argument(args, kwargs, 4, "obs_ids", undefined);
  out = [];
  dh_by = rt.dict(
    rt.comprehend(dhs, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  ic_by = rt.dict(
    rt.comprehend(ics, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  fa_by_hyp = rt.dict(
    rt.comprehend(fas, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "hypothesis_ref")), str)))
        ? rt.entry(rt.get(d, "hypothesis_ref"), d)
        : rt.skip;
    })
  );
  for (const loop40 of rt.iter(dhs)) {
    p = rt.item(loop40, 0);
    d = rt.item(loop40, 1);
    for (const loop41 of rt.iter(rt.invoke(aslist, rt.get(d, "observation_refs")))) {
      ref = loop41;
      if (rt.truth(rt.compare("isnot", rt.invoke(type, ref), str))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": observation_refs entry ",
            rt.format(ref, 114, null),
            " is not a STRING id — quarantined from the join",
          ].join("")
        );
      } else {
        if (rt.truth(rt.compare("notin", ref, obs_ids))) {
          rt.method(
            out,
            "append",
            [
              rt.format(p, -1, null),
              ": observation_refs ",
              rt.format(ref, 114, null),
              " matches no scanned observation",
            ].join("")
          );
        }
      }
    }
  }
  for (const loop42 of rt.iter(fas)) {
    p = rt.item(loop42, 0);
    d = rt.item(loop42, 1);
    ic = rt.get(ic_by, rt.invoke(skey, rt.get(d, "identity_card_ref")));
    if (rt.truth(rt.compare("is", ic, null))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": identity_card_ref ",
          rt.format(rt.get(d, "identity_card_ref"), 114, null),
          " resolves to no IdentityCard",
        ].join("")
      );
    } else {
      if (rt.truth(rt.compare("ne", rt.get(ic, "hypothesis_ref"), rt.get(d, "hypothesis_ref")))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": joins an IdentityCard of a DIFFERENT hypothesis (",
            rt.format(rt.get(ic, "hypothesis_ref"), 114, null),
            ") — cross-wired records are not an analysis",
          ].join("")
        );
      }
    }
  }
  for (const loop43 of rt.iter(otps)) {
    p = rt.item(loop43, 0);
    d = rt.item(loop43, 1);
    hyp = rt.item(
      rt.tuple([rt.invoke(skey, rt.get(d, "hypothesis_ref")), rt.invoke(skey, rt.get(d, "identity_card_ref"))]),
      0
    );
    icr = rt.item(
      rt.tuple([rt.invoke(skey, rt.get(d, "hypothesis_ref")), rt.invoke(skey, rt.get(d, "identity_card_ref"))]),
      1
    );
    dh = rt.get(dh_by, hyp);
    if (rt.truth(rt.compare("is", dh, null))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": hypothesis_ref ",
          rt.format(hyp, 114, null),
          " resolves to no DenotationHypothesis",
        ].join("")
      );
    } else {
      nh = rt.truth(rt.invoke(isinstance, rt.get(dh, "null_hypothesis"), dict))
        ? rt.get(dh, "null_hypothesis")
        : rt.dict([]);
      if (
        rt.truth(
          !rt.truth(
            rt.and(rt.compare("is", rt.get(nh, "rejected"), true), () =>
              rt.and(rt.get(nh, "discriminator"), () =>
                rt.compare("in", rt.get(dh, "representation_status"), SURVIVING_REPR)
              )
            )
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [rt.format(p, -1, null), ": hypothesis ", rt.format(hyp, 114, null), " did NOT survive"].join("")
        );
      }
    }
    ic = rt.get(ic_by, icr);
    if (rt.truth(rt.compare("is", ic, null))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": identity_card_ref ",
          rt.format(icr, 114, null),
          " resolves to no IdentityCard",
        ].join("")
      );
    } else {
      if (rt.truth(rt.compare("ne", rt.get(ic, "hypothesis_ref"), hyp))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": identity card ",
            rt.format(icr, 114, null),
            " rules hypothesis ",
            rt.format(rt.get(ic, "hypothesis_ref"), 114, null),
            ", not this proposal's ",
            rt.format(hyp, 114, null),
            " — an OTP may not borrow another referent's identity analysis",
          ].join("")
        );
      }
    }
    fa = rt.get(fa_by_hyp, hyp);
    if (rt.truth(rt.compare("is", fa, null))) {
      rt.method(
        out,
        "append",
        [rt.format(p, -1, null), ": no FoundationalAnalysis covers hypothesis ", rt.format(hyp, 114, null)].join("")
      );
    } else {
      if (rt.truth(rt.compare("ne", rt.get(fa, "identity_card_ref"), icr))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": its FoundationalAnalysis joins card ",
            rt.format(rt.get(fa, "identity_card_ref"), 114, null),
            ", the proposal joins ",
            rt.format(icr, 114, null),
            " — the closure must be ONE card",
          ].join("")
        );
      }
      if (rt.truth(rt.compare("ne", rt.get(fa, "verdict"), rt.get(d, "foundational_status")))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": foundational_status ",
            rt.format(rt.get(d, "foundational_status"), 114, null),
            " contradicts the analysis verdict ",
            rt.format(rt.get(fa, "verdict"), 114, null),
            " — the proposal does not get to relabel the analysis",
          ].join("")
        );
      }
      if (
        rt.truth(
          rt.invoke(
            any,
            rt.comprehend(rt.invoke(aslist, rt.get(fa, "rival_models")), (item: unknown) => {
              let r: unknown;
              r = item;
              return rt.truth(rt.truth(rt.invoke(isinstance, r, dict)))
                ? rt.compare(
                    "in",
                    rt.get(
                      rt.or(r, () => rt.dict([])),
                      "still_viable"
                    ),
                    rt.tuple([true, "true", "True"])
                  )
                : rt.skip;
            })
          )
        )
      ) {
        siblings = rt.invoke(
          sum,
          rt.comprehend(otps, (item: unknown) => {
            let _: unknown;
            let o: unknown;
            _ = rt.item(item, 0);
            o = rt.item(item, 1);
            return rt.truth(rt.truth(rt.compare("eq", rt.get(o, "hypothesis_ref"), hyp))) ? 1 : rt.skip;
          })
        );
        if (
          rt.truth(rt.and(rt.compare("lt", siblings, 2), () => !rt.truth(rt.or(rt.get(d, "open_issues"), () => []))))
        ) {
          rt.method(
            out,
            "append",
            [
              rt.format(p, -1, null),
              ": the analysis lists a still-viable rival model but there is ONE proposal and no open_issues entry — the forbidden silent merge",
            ].join("")
          );
        }
      }
    }
  }
  return out;
  return null;
});
cross_check_support_graph = rt.fn("cross_check_support_graph", (args, kwargs) => {
  let _: unknown;
  let accepted_iris: unknown;
  let by_id: unknown;
  let d: unknown;
  let iri: unknown;
  let otp_digests: unknown;
  let otps: unknown;
  let out: unknown;
  let p: unknown;
  let r: unknown;
  let rats: unknown;
  let ref: unknown;
  let s: unknown;
  let tgt: unknown;
  otps = rt.argument(args, kwargs, 0, "otps", undefined);
  rats = rt.argument(args, kwargs, 1, "rats", undefined);
  otp_digests = rt.argument(args, kwargs, 2, "otp_digests", undefined);
  out = [];
  by_id = rt.dict(
    rt.comprehend(otps, (item: unknown) => {
      let p: unknown;
      let d: unknown;
      p = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), rt.tuple([d, p]))
        : rt.skip;
    })
  );
  accepted_iris = rt.invoke(set);
  for (const loop44 of rt.iter(rats)) {
    _ = rt.item(loop44, 0);
    r = rt.item(loop44, 1);
    if (rt.truth(rt.compare("eq", rt.get(r, "decision"), "accept"))) {
      ref = rt.invoke(str, rt.get(r, "proposal_ref"));
      tgt = rt.get(by_id, ref);
      if (rt.truth(rt.and(tgt, () => rt.compare("eq", rt.get(r, "proposal_sha256"), rt.get(otp_digests, ref))))) {
        iri = rt.invoke(get, rt.item(tgt, 0), "term.proposed_iri");
        if (rt.truth(iri)) {
          rt.method(accepted_iris, "add", rt.invoke(str, iri));
        }
      }
    }
  }
  for (const loop45 of rt.iter(otps)) {
    p = rt.item(loop45, 0);
    d = rt.item(loop45, 1);
    for (const loop46 of rt.iter(rt.invoke(aslist, rt.invoke(get, d, "operational_warrant.semantic_support_for")))) {
      s = loop46;
      s = rt.invoke(str, s);
      if (rt.truth(rt.method(s, "startswith", "otp:"))) {
        tgt = rt.get(by_id, s);
        if (rt.truth(rt.compare("is", tgt, null))) {
          rt.method(
            out,
            "append",
            [rt.format(p, -1, null), ": semantic_support_for ", rt.format(s, 114, null), " does not resolve"].join("")
          );
        } else {
          if (
            rt.truth(
              !rt.truth(rt.invoke(aslist, rt.invoke(get, rt.item(tgt, 0), "operational_warrant.competency_questions")))
            )
          ) {
            rt.method(
              out,
              "append",
              [
                rt.format(p, -1, null),
                ": semantic_support_for ",
                rt.format(s, 114, null),
                " targets a term with no decision-CQ warrant",
              ].join("")
            );
          }
        }
      } else {
        if (rt.truth(rt.and(rt.method(re, "match", "^https?://", s), () => rt.compare("notin", s, accepted_iris)))) {
          rt.method(
            out,
            "append",
            [
              rt.format(p, -1, null),
              ": semantic_support_for IRI ",
              rt.format(s, 114, null),
              " matches no DIGEST-FRESH steward-accepted proposal — a mutated or unratified IRI is not a ratified term",
            ].join("")
          );
        }
      }
    }
  }
  return out;
  return null;
});
cross_check_rats = rt.fn("cross_check_rats", (args, kwargs) => {
  let _: unknown;
  let by_id: unknown;
  let d: unknown;
  let key: unknown;
  let local: unknown;
  let n: unknown;
  let names: unknown;
  let otp_digests: unknown;
  let otps: unknown;
  let out: unknown;
  let p: unknown;
  let rats: unknown;
  let ref: unknown;
  let seen_ref: unknown;
  let seen_verbatim: unknown;
  let slug: unknown;
  let tgt: unknown;
  let verb: unknown;
  rats = rt.argument(args, kwargs, 0, "rats", undefined);
  otps = rt.argument(args, kwargs, 1, "otps", undefined);
  otp_digests = rt.argument(args, kwargs, 2, "otp_digests", undefined);
  out = [];
  by_id = rt.dict(
    rt.comprehend(otps, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  seen_verbatim = rt.item(rt.tuple([rt.dict([]), rt.dict([])]), 0);
  seen_ref = rt.item(rt.tuple([rt.dict([]), rt.dict([])]), 1);
  for (const loop47 of rt.iter(rats)) {
    p = rt.item(loop47, 0);
    d = rt.item(loop47, 1);
    ref = rt.invoke(
      str,
      rt.or(rt.get(d, "proposal_ref"), () => "")
    );
    verb = rt.method(
      rt.invoke(
        str,
        rt.or(rt.get(d, "verbatim_decision"), () => "")
      ),
      "strip"
    );
    if (rt.truth(rt.compare("in", ref, seen_ref))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": second ratification for ",
          rt.format(ref, -1, null),
          " (first: ",
          rt.format(rt.item(seen_ref, ref), -1, null),
          ")",
        ].join("")
      );
    }
    rt.setItem(seen_ref, ref, rt.invoke(str, p));
    tgt = rt.get(by_id, ref);
    if (rt.truth(rt.compare("is", tgt, null))) {
      rt.method(
        out,
        "append",
        [rt.format(p, -1, null), ": proposal_ref ", rt.format(ref, 114, null), " does not resolve to a proposal"].join(
          ""
        )
      );
    } else {
      if (rt.truth(rt.compare("ne", rt.get(d, "proposal_sha256"), rt.get(otp_digests, ref)))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": STALE ratification — the proposal's bytes changed after the steward decided; the decision authorizes the bytes the steward saw, nothing later",
          ].join("")
        );
      }
      local = rt.invoke(
        str,
        rt.or(rt.invoke(get, tgt, "term.local_name"), () => "")
      );
      slug = rt.truth(rt.compare("ge", rt.method(ref, "count", ":"), 2))
        ? rt.item(rt.method(ref, "split", ":"), 1)
        : "";
      names = rt.comprehend(rt.tuple([local, slug]), (item: unknown) => {
        let n: unknown;
        n = item;
        return rt.truth(rt.truth(rt.compare("ge", rt.invoke(len, n), 3))) ? n : rt.skip;
      });
      if (rt.truth(!rt.truth(names))) {
        if (rt.truth(rt.compare("notin", ref, verb))) {
          rt.method(
            out,
            "append",
            [
              rt.format(p, -1, null),
              ": term name too short — the verbatim must contain the full proposal id ",
              rt.format(ref, 114, null),
            ].join("")
          );
        }
      } else {
        if (
          rt.truth(
            !rt.truth(
              rt.invoke(
                any,
                rt.comprehend(names, (item: unknown) => {
                  let n: unknown;
                  n = item;
                  return rt.method(
                    re,
                    "search",
                    ["\\b", rt.format(rt.method(re, "escape", n), -1, null), "\\b"].join(""),
                    verb,
                    rt.attr(re, "I")
                  );
                })
              )
            )
          )
        ) {
          rt.method(
            out,
            "append",
            [
              rt.format(p, -1, null),
              ": verbatim_decision does not name this proposal (",
              rt.format(local, 114, null),
              ")",
            ].join("")
          );
        }
      }
    }
    key = rt.method(re, "sub", "\\s+", " ", rt.method(verb, "lower"));
    if (rt.truth(rt.compare("in", key, seen_verbatim))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": verbatim_decision is byte-identical to ",
          rt.format(rt.item(seen_verbatim, key), -1, null),
        ].join("")
      );
    } else {
      rt.setItem(seen_verbatim, key, rt.invoke(str, p));
    }
  }
  return out;
  return null;
});
check_prior_rows = rt.fn("check_prior_rows", (args, kwargs) => {
  let cfp: unknown;
  let date: unknown;
  let k: unknown;
  let obs: unknown;
  let out: unknown;
  let outcome: unknown;
  let path: unknown;
  let r: unknown;
  let reason: unknown;
  let ref: unknown;
  let rows: unknown;
  let seen: unknown;
  let since: unknown;
  rows = rt.argument(args, kwargs, 0, "rows", undefined);
  path = rt.argument(args, kwargs, 1, "path", undefined);
  out = [];
  seen = rt.invoke(set);
  for (const loop48 of rt.iter(rt.or(rows, () => []))) {
    r = loop48;
    if (rt.truth(!rt.truth(rt.invoke(isinstance, r, dict)))) {
      rt.method(out, "append", ["prior_index row ", rt.format(r, 114, null), " is not a mapping"].join(""));
      continue;
    }
    obs = rt.get(r, "observation");
    if (rt.truth(rt.or(rt.compare("isnot", rt.invoke(type, obs), str), () => !rt.truth(rt.method(obs, "strip"))))) {
      rt.method(
        out,
        "append",
        ["prior_index row observation ", rt.format(obs, 114, null), " is not a STRING id"].join("")
      );
      continue;
    }
    if (rt.truth(!rt.truth(rt.method(re, "fullmatch", "(so|po):sha256:[0-9a-f]{64}", obs)))) {
      rt.method(
        out,
        "append",
        [
          "prior_index row observation ",
          rt.format(obs, 114, null),
          " does not match the (so|po):sha256:<64hex> id grammar",
        ].join("")
      );
    }
    if (rt.truth(rt.compare("in", obs, seen))) {
      rt.method(
        out,
        "append",
        [
          "prior_index DUPLICATE row for ",
          rt.format(obs, -1, null),
          " — last-wins lookup would suppress the re-park refusal",
        ].join("")
      );
    }
    rt.method(seen, "add", obs);
    outcome = rt.get(r, "outcome");
    if (rt.truth(rt.compare("notin", outcome, rt.tuple(["irrelevant", "mapped", "proposed", "unresolved"])))) {
      rt.method(
        out,
        "append",
        [
          "prior_index row ",
          rt.format(obs, -1, null),
          ": invalid/missing outcome ",
          rt.format(outcome, 114, null),
        ].join("")
      );
    }
    cfp = rt.get(r, "carried_from_prior");
    if (rt.truth(rt.and(rt.compare("isnot", cfp, null), () => rt.compare("isnot", rt.invoke(type, cfp), bool)))) {
      rt.method(
        out,
        "append",
        [
          "prior_index row ",
          rt.format(obs, -1, null),
          ": carried_from_prior must be a BOOLEAN, got ",
          rt.format(cfp, 114, null),
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(rt.compare("is", cfp, true), () => rt.compare("notin", outcome, rt.tuple(["irrelevant", "unresolved"])))
      )
    ) {
      rt.method(
        out,
        "append",
        [
          "prior_index row ",
          rt.format(obs, -1, null),
          ": carried row cannot be ",
          rt.format(outcome, 114, null),
          " — nothing observed in that run supports it",
        ].join("")
      );
    }
    if (rt.truth(rt.compare("eq", outcome, "irrelevant"))) {
      reason = rt.truth(rt.invoke(isinstance, rt.get(r, "reason"), str)) ? rt.get(r, "reason") : "";
      if (
        rt.truth(
          rt.or(rt.compare("lt", rt.invoke(len, rt.method(reason, "strip")), 15), () =>
            rt.compare("in", rt.method(rt.method(reason, "strip"), "lower"), TRIVIAL_REASONS)
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [
            "prior_index row ",
            rt.format(obs, -1, null),
            ": irrelevant needs a concrete reason (same meter as the live index)",
          ].join("")
        );
      }
    }
    for (const loop49 of rt.iter(rt.tuple(["reason", "needed_evidence"]))) {
      k = loop49;
      if (rt.truth(rt.and(rt.compare("in", k, r), () => !rt.truth(rt.invoke(isinstance, rt.get(r, k), str))))) {
        rt.method(
          out,
          "append",
          [
            "prior_index row ",
            rt.format(obs, -1, null),
            ": ",
            rt.format(k, -1, null),
            " must be a STRING, got ",
            rt.format(rt.get(r, k), 114, null),
          ].join("")
        );
      }
    }
    if (rt.truth(rt.compare("eq", outcome, "unresolved"))) {
      if (
        rt.truth(
          rt.or(!rt.truth(rt.invoke(isinstance, rt.get(r, "needed_evidence"), str)), () =>
            rt.compare("lt", rt.invoke(len, rt.method(rt.get(r, "needed_evidence"), "strip")), 15)
          )
        )
      ) {
        rt.method(
          out,
          "append",
          ["prior_index row ", rt.format(obs, -1, null), ": unresolved requires needed_evidence"].join("")
        );
      }
      since = rt.get(r, "since");
      if (
        rt.truth(
          rt.or(
            rt.compare("isnot", rt.invoke(type, since), str),
            () => !rt.truth(rt.method(re, "fullmatch", "\\d{4}-\\d{2}-\\d{2}", since))
          )
        )
      ) {
        rt.method(
          out,
          "append",
          ["prior_index row ", rt.format(obs, -1, null), ": since must be EXACTLY YYYY-MM-DD"].join("")
        );
      } else {
        date = rt.attr(rt.module("datetime"), "date");
        try {
          if (rt.truth(rt.compare("gt", rt.method(date, "fromisoformat", since), rt.method(date, "today")))) {
            rt.method(
              out,
              "append",
              ["prior_index row ", rt.format(obs, -1, null), ": since is in the future"].join("")
            );
          }
        } catch (caught) {
          if (rt.catches(caught, ValueError)) {
            rt.method(
              out,
              "append",
              ["prior_index row ", rt.format(obs, -1, null), ": since is not a real date"].join("")
            );
          } else {
            throw caught;
          }
        }
      }
    }
    if (rt.truth(rt.compare("in", outcome, rt.tuple(["mapped", "proposed"])))) {
      ref = rt.get(r, "ref");
      if (rt.truth(rt.or(rt.compare("isnot", rt.invoke(type, ref), str), () => !rt.truth(rt.method(ref, "strip"))))) {
        rt.method(
          out,
          "append",
          [
            "prior_index row ",
            rt.format(obs, -1, null),
            ": ",
            rt.format(outcome, -1, null),
            " ref ",
            rt.format(ref, 114, null),
            " is not a non-blank STRING",
          ].join("")
        );
      }
    }
  }
  return out;
  return null;
});
cross_check_rejections = rt.fn("cross_check_rejections", (args, kwargs) => {
  let _: unknown;
  let d: unknown;
  let led: unknown;
  let otp_ids: unknown;
  let out: unknown;
  let p: unknown;
  let rat_rationale: unknown;
  let rats: unknown;
  let ref: unknown;
  let rej_refs: unknown;
  let reject_rats: unknown;
  let rejs: unknown;
  let seen_rej: unknown;
  rats = rt.argument(args, kwargs, 0, "rats", undefined);
  rejs = rt.argument(args, kwargs, 1, "rejs", undefined);
  otp_ids = rt.argument(args, kwargs, 2, "otp_ids", null);
  out = [];
  rej_refs = rt.set(
    rt.comprehend(rejs, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.invoke(str, rt.get(d, "proposal_ref"));
    })
  );
  reject_rats = rt.dict(
    rt.comprehend(rats, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("eq", rt.get(d, "decision"), "reject")))
        ? rt.entry(rt.invoke(str, rt.get(d, "proposal_ref")), rt.get(d, "rationale"))
        : rt.skip;
    })
  );
  for (const loop50 of rt.iter(rats)) {
    p = rt.item(loop50, 0);
    d = rt.item(loop50, 1);
    if (
      rt.truth(
        rt.and(rt.compare("eq", rt.get(d, "decision"), "reject"), () =>
          rt.compare("notin", rt.invoke(str, rt.get(d, "proposal_ref")), rej_refs)
        )
      )
    ) {
      rt.method(out, "append", [rt.format(p, -1, null), ": reject decision with no rejection-ledger record"].join(""));
    }
  }
  seen_rej = rt.dict([]);
  for (const loop51 of rt.iter(rejs)) {
    p = rt.item(loop51, 0);
    d = rt.item(loop51, 1);
    ref = rt.invoke(str, rt.get(d, "proposal_ref"));
    if (rt.truth(rt.compare("in", ref, seen_rej))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": DUPLICATE rejection-ledger row for ",
          rt.format(ref, -1, null),
          " (also ",
          rt.format(rt.item(seen_rej, ref), -1, null),
          ") — one ledger entry per proposal",
        ].join("")
      );
    }
    rt.setItem(seen_rej, ref, rt.invoke(str, p));
    if (rt.truth(rt.and(rt.compare("isnot", otp_ids, null), () => rt.compare("notin", ref, otp_ids)))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": rejection ledger names ",
          rt.format(ref, 114, null),
          " but no such proposal is in the scan — a ledger row for a ghost proposal suppresses future proposals nobody rejected",
        ].join("")
      );
    }
    if (rt.truth(rt.compare("notin", ref, reject_rats))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": rejection ledger row for ",
          rt.format(ref, -1, null),
          " has NO decision: reject ratification — the ledger records a steward rejection; without the ratification it is authority nobody authored",
        ].join("")
      );
    } else {
      rat_rationale = rt.item(reject_rats, ref);
      led = rt.get(d, "rationale");
      if (
        rt.truth(
          rt.and(rt.invoke(isinstance, rat_rationale, str), () =>
            rt.and(rt.invoke(isinstance, led, str), () =>
              rt.compare("ne", rt.method(led, "strip"), rt.method(rat_rationale, "strip"))
            )
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": rejection-ledger rationale for ",
            rt.format(ref, -1, null),
            " is NOT the ratification's rationale — the ledger must carry the steward's OWN reason; a substituted reason suppresses future proposals on authority the steward never gave",
          ].join("")
        );
      }
    }
  }
  return out;
  return null;
});
review_round = rt.fn("review_round", (args, kwargs) => {
  let m: unknown;
  let path: unknown;
  path = rt.argument(args, kwargs, 0, "path", undefined);
  m = rt.method(re, "search", "-r(\\d+)\\.review\\.yaml$", rt.invoke(str, path));
  return rt.truth(m) ? rt.invoke(int, rt.method(m, "group", 1)) : 1;
  return null;
});
latest_reviews = rt.fn("latest_reviews", (args, kwargs) => {
  let cur: unknown;
  let d: unknown;
  let p: unknown;
  let reviews: unknown;
  let tgt: unknown;
  reviews = rt.argument(args, kwargs, 0, "reviews", undefined);
  cur = rt.dict([]);
  for (const loop52 of rt.iter(
    rt.call(sorted, [reviews], {
      key: rt.fn("lambda", (args, kwargs) => {
        let t: unknown;
        t = rt.argument(args, kwargs, 0, "t", undefined);
        return rt.tuple([rt.invoke(review_round, rt.item(t, 0)), rt.invoke(str, rt.item(t, 0))]);
        return null;
      }),
    })
  )) {
    p = rt.item(loop52, 0);
    d = rt.item(loop52, 1);
    tgt = rt.invoke(str, rt.get(d, "target"));
    if (
      rt.truth(
        rt.or(rt.compare("notin", tgt, cur), () =>
          rt.compare("ge", rt.invoke(review_round, p), rt.invoke(review_round, rt.item(rt.item(cur, tgt), 0)))
        )
      )
    ) {
      rt.setItem(cur, tgt, rt.tuple([p, d]));
    }
  }
  return cur;
  return null;
});
cross_check_review_binding = rt.fn("cross_check_review_binding", (args, kwargs) => {
  let _: unknown;
  let a: unknown;
  let by_round: unknown;
  let d: unknown;
  let digests: unknown;
  let digs: unknown;
  let e: unknown;
  let failed: unknown;
  let failed_rules: unknown;
  let fd: unknown;
  let landed_rules_here: unknown;
  let latest: unknown;
  let logged: unknown;
  let oid: unknown;
  let otp_records: unknown;
  let out: unknown;
  let p: unknown;
  let path: unknown;
  let prev: unknown;
  let prior_failed: unknown;
  let prior_only: unknown;
  let r: unknown;
  let rec: unknown;
  let reviews: unknown;
  let rnd: unknown;
  let rounds: unknown;
  let rs: unknown;
  let tgt: unknown;
  let tsha: unknown;
  let unanswered: unknown;
  let v: unknown;
  reviews = rt.argument(args, kwargs, 0, "reviews", undefined);
  otp_records = rt.argument(args, kwargs, 1, "otp_records", undefined);
  out = [];
  for (const loop53 of rt.iter(reviews)) {
    p = rt.item(loop53, 0);
    d = rt.item(loop53, 1);
    tgt = rt.get(d, "target");
    if (rt.truth(rt.and(rt.compare("is", rt.invoke(type, tgt), str), () => rt.compare("notin", tgt, otp_records)))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": review target ",
          rt.format(tgt, 114, null),
          " resolves to NO scanned proposal — an orphan review is authority bound to nothing, and pre-planted history for a future id",
        ].join("")
      );
    }
  }
  digests = rt.dict([]);
  for (const loop54 of rt.iter(rt.method(otp_records, "items"))) {
    oid = rt.item(loop54, 0);
    path = rt.item(rt.item(loop54, 1), 0);
    _ = rt.item(rt.item(loop54, 1), 1);
    try {
      rt.setItem(
        digests,
        oid,
        rt.method(rt.method(hashlib, "sha256", rt.method(rt.invoke(Path, path), "read_bytes")), "hexdigest")
      );
    } catch (caught) {
      if (rt.catches(caught, Exception)) {
      } else {
        throw caught;
      }
    }
  }
  failed = rt.dict([]);
  failed_rules = rt.dict([]);
  prior_failed = rt.dict([]);
  rounds = rt.dict([]);
  for (const loop55 of rt.iter(
    rt.call(sorted, [reviews], {
      key: rt.fn("lambda", (args, kwargs) => {
        let t: unknown;
        t = rt.argument(args, kwargs, 0, "t", undefined);
        return rt.tuple([rt.invoke(review_round, rt.item(t, 0)), rt.invoke(str, rt.item(t, 0))]);
        return null;
      }),
    })
  )) {
    p = rt.item(loop55, 0);
    d = rt.item(loop55, 1);
    tgt = rt.item(
      rt.tuple([
        rt.invoke(str, rt.get(d, "target")),
        rt.invoke(
          str,
          rt.or(rt.get(d, "target_sha256"), () => "")
        ),
        rt.get(d, "verdict"),
      ]),
      0
    );
    tsha = rt.item(
      rt.tuple([
        rt.invoke(str, rt.get(d, "target")),
        rt.invoke(
          str,
          rt.or(rt.get(d, "target_sha256"), () => "")
        ),
        rt.get(d, "verdict"),
      ]),
      1
    );
    v = rt.item(
      rt.tuple([
        rt.invoke(str, rt.get(d, "target")),
        rt.invoke(
          str,
          rt.or(rt.get(d, "target_sha256"), () => "")
        ),
        rt.get(d, "verdict"),
      ]),
      2
    );
    r = rt.invoke(review_round, p);
    prev = rt.method(rounds, "setdefault", tgt, rt.dict([]));
    if (rt.truth(rt.compare("in", r, prev))) {
      rt.method(
        out,
        "append",
        [
          rt.format(p, -1, null),
          ": SECOND review at round ",
          rt.format(r, -1, null),
          " for ",
          rt.format(tgt, -1, null),
          " (first: ",
          rt.format(rt.item(prev, r), -1, null),
          ") — two files cannot both be one round; history is a sequence, not a pile",
        ].join("")
      );
    }
    rt.setItem(prev, r, rt.invoke(str, p));
    landed_rules_here = rt.set(
      rt.comprehend(rt.invoke(aslist, rt.get(d, "attacks")), (item: unknown) => {
        let a: unknown;
        a = item;
        return rt.truth(
          rt.truth(
            rt.and(rt.invoke(isinstance, a, dict), () =>
              rt.and(rt.compare("eq", rt.get(a, "outcome"), "landed"), () => rt.get(a, "rule"))
            )
          )
        )
          ? rt.invoke(str, rt.get(a, "rule"))
          : rt.skip;
      })
    );
    if (rt.truth(rt.compare("eq", v, "FAIL"))) {
      rt.method(rt.method(failed, "setdefault", tgt, rt.invoke(set)), "add", tsha);
      rt.method(
        rt.method(failed_rules, "setdefault", rt.tuple([tgt, tsha]), rt.invoke(set)),
        "update",
        landed_rules_here
      );
      rt.method(
        rt.method(rt.method(prior_failed, "setdefault", tgt, rt.dict([])), "setdefault", r, rt.invoke(set)),
        "add",
        tsha
      );
    } else {
      if (rt.truth(rt.compare("eq", v, "INDETERMINATE"))) {
        if (rt.truth(rt.compare("in", tsha, rt.get(failed, tgt, rt.tuple([]))))) {
          rt.method(
            out,
            "append",
            [
              rt.format(p, -1, null),
              ": INDETERMINATE on the SAME proposal bytes a FAIL already judged (",
              rt.format(tgt, -1, null),
              ") — an abstention does not retire a FAIL; only CHANGED bytes with revision_log coverage do",
            ].join("")
          );
        }
        rt.method(
          rt.method(failed_rules, "setdefault", rt.tuple([tgt, tsha]), rt.invoke(set)),
          "update",
          landed_rules_here
        );
        if (rt.truth(landed_rules_here)) {
          rt.method(rt.method(failed, "setdefault", tgt, rt.invoke(set)), "add", tsha);
          rt.method(
            rt.method(rt.method(prior_failed, "setdefault", tgt, rt.dict([])), "setdefault", r, rt.invoke(set)),
            "add",
            tsha
          );
        }
      } else {
        if (rt.truth(rt.compare("eq", v, "PASS"))) {
          if (rt.truth(rt.compare("in", tsha, rt.get(failed, tgt, rt.tuple([]))))) {
            rt.method(
              out,
              "append",
              [
                rt.format(p, -1, null),
                ": PASS on the SAME proposal bytes a FAIL (or a landed-attack INDETERMINATE) already judged (",
                rt.format(tgt, -1, null),
                ") — revision means the bytes change, not the verdict",
              ].join("")
            );
          } else {
            if (rt.truth(rt.get(failed, tgt))) {
              rec = rt.get(otp_records, tgt);
              logged = rt.dict([]);
              if (rt.truth(rec)) {
                for (const loop56 of rt.iter(rt.invoke(aslist, rt.get(rt.item(rec, 1), "revision_log")))) {
                  e = loop56;
                  if (rt.truth(rt.invoke(isinstance, e, dict))) {
                    rt.method(
                      rt.method(logged, "setdefault", rt.invoke(str, rt.get(e, "from_sha256")), rt.invoke(set)),
                      "update",
                      rt.comprehend(rt.invoke(aslist, rt.get(e, "addressed")), (item: unknown) => {
                        let a: unknown;
                        a = item;
                        return rt.truth(rt.truth(rt.invoke(isinstance, a, str))) ? rt.invoke(str, a) : rt.skip;
                      })
                    );
                  }
                }
              }
              for (const loop57 of rt.iter(rt.item(failed, tgt))) {
                fd = loop57;
                if (rt.truth(rt.compare("notin", fd, logged))) {
                  rt.method(
                    out,
                    "append",
                    [
                      rt.format(p, -1, null),
                      ": PASS after FAIL without a revision_log entry naming failed digest ",
                      rt.format(rt.item(fd, rt.slice(undefined, 12, undefined)), -1, null),
                      "…",
                    ].join("")
                  );
                } else {
                  unanswered = rt.op(
                    "sub",
                    rt.get(failed_rules, rt.tuple([tgt, fd]), rt.invoke(set)),
                    rt.item(logged, fd)
                  );
                  if (rt.truth(unanswered)) {
                    rt.method(
                      out,
                      "append",
                      [
                        rt.format(p, -1, null),
                        ": revision_log for failed digest ",
                        rt.format(rt.item(fd, rt.slice(undefined, 12, undefined)), -1, null),
                        "… does not address the FAIL's landed attack rule(s) ",
                        rt.format(rt.invoke(sorted, unanswered), -1, null),
                        " — a log entry that answers none of the attacks that landed is a guestbook signature, not a revision",
                      ].join("")
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  for (const loop58 of rt.iter(rt.method(rounds, "items"))) {
    tgt = rt.item(loop58, 0);
    rs = rt.item(loop58, 1);
    if (
      rt.truth(
        rt.compare("ne", rt.invoke(set, rs), rt.invoke(set, rt.invoke(range, 1, rt.op("add", rt.invoke(max, rs), 1))))
      )
    ) {
      rt.method(
        out,
        "append",
        [
          "reviews for ",
          rt.format(tgt, -1, null),
          ": rounds ",
          rt.format(rt.invoke(sorted, rs), -1, null),
          " are non-contiguous — a deleted or skipped round is deleted history",
        ].join("")
      );
    }
  }
  prior_only = rt.dict([]);
  for (const loop59 of rt.iter(rt.method(prior_failed, "items"))) {
    tgt = rt.item(loop59, 0);
    by_round = rt.item(loop59, 1);
    if (rt.truth(!rt.truth(by_round))) {
      continue;
    }
    latest = rt.invoke(max, rt.get(rounds, tgt, rt.dict([[1, null]])));
    rt.setItem(prior_only, tgt, rt.invoke(set));
    for (const loop60 of rt.iter(rt.method(by_round, "items"))) {
      rnd = rt.item(loop60, 0);
      digs = rt.item(loop60, 1);
      if (rt.truth(rt.compare("lt", rnd, latest))) {
        rt.method(rt.item(prior_only, tgt), "update", digs);
      }
    }
  }
  return rt.tuple([
    out,
    digests,
    rt.dict([
      ["all", failed],
      ["prior", prior_only],
      ["rules", failed_rules],
    ]),
  ]);
  return null;
});
cross_check_index = rt.fn("cross_check_index", (args, kwargs) => {
  let _: unknown;
  let by_id: unknown;
  let carried: unknown;
  let cfp: unknown;
  let d: unknown;
  let dh: unknown;
  let dh_by: unknown;
  let dhs: unknown;
  let idx_path: unknown;
  let indexed: unknown;
  let m: unknown;
  let missing: unknown;
  let ne: unknown;
  let obs: unknown;
  let otps: unknown;
  let out: unknown;
  let outcome: unknown;
  let prior: unknown;
  let prior_by: unknown;
  let prior_rows: unknown;
  let r: unknown;
  let reason: unknown;
  let ref: unknown;
  let rows: unknown;
  let seen_obs: unknown;
  let since: unknown;
  let tgt: unknown;
  let unrep_ids: unknown;
  rows = rt.argument(args, kwargs, 0, "rows", undefined);
  idx_path = rt.argument(args, kwargs, 1, "idx_path", undefined);
  seen_obs = rt.argument(args, kwargs, 2, "seen_obs", undefined);
  otps = rt.argument(args, kwargs, 3, "otps", undefined);
  dhs = rt.argument(args, kwargs, 4, "dhs", undefined);
  unrep_ids = rt.argument(args, kwargs, 5, "unrep_ids", undefined);
  prior_rows = rt.argument(args, kwargs, 6, "prior_rows", null);
  out = [];
  by_id = rt.dict(
    rt.comprehend(otps, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  dh_by = rt.dict(
    rt.comprehend(dhs, (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  prior_by = rt.dict(
    rt.comprehend(
      rt.or(prior_rows, () => []),
      (item: unknown) => {
        let r: unknown;
        r = item;
        return rt.truth(
          rt.truth(
            rt.and(rt.invoke(isinstance, r, dict), () =>
              rt.compare("is", rt.invoke(type, rt.get(r, "observation")), str)
            )
          )
        )
          ? rt.entry(rt.get(r, "observation"), r)
          : rt.skip;
      }
    )
  );
  indexed = rt.invoke(set);
  if (rt.truth(rt.and(rt.compare("isnot", rows, null), () => !rt.truth(rt.invoke(isinstance, rows, list))))) {
    rt.method(
      out,
      "append",
      [
        rt.format(idx_path, -1, null),
        ": index must be a LIST of rows, got ",
        rt.format(rt.attr(rt.invoke(type, rows), "__name__"), -1, null),
      ].join("")
    );
    return out;
  }
  for (const loop61 of rt.iter(rt.or(rows, () => []))) {
    r = loop61;
    if (rt.truth(!rt.truth(rt.invoke(isinstance, r, dict)))) {
      rt.method(
        out,
        "append",
        [rt.format(idx_path, -1, null), ": row ", rt.format(r, 114, null), " is not a mapping"].join("")
      );
      continue;
    }
    obs = rt.item(rt.tuple([rt.get(r, "observation"), rt.get(r, "outcome")]), 0);
    outcome = rt.item(rt.tuple([rt.get(r, "observation"), rt.get(r, "outcome")]), 1);
    if (rt.truth(rt.compare("isnot", rt.invoke(type, obs), str))) {
      rt.method(
        out,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row observation ",
          rt.format(obs, 114, null),
          " is not a STRING id — malformed authority is quarantined from joins, never hashed",
        ].join("")
      );
      continue;
    }
    if (rt.truth(rt.compare("in", obs, indexed))) {
      rt.method(
        out,
        "append",
        [rt.format(idx_path, -1, null), ": duplicate row for ", rt.format(obs, -1, null)].join("")
      );
    }
    rt.method(indexed, "add", obs);
    cfp = rt.get(r, "carried_from_prior");
    if (rt.truth(rt.and(rt.compare("isnot", cfp, null), () => rt.compare("isnot", rt.invoke(type, cfp), bool)))) {
      rt.method(
        out,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row ",
          rt.format(obs, -1, null),
          ": carried_from_prior must be a BOOLEAN, got ",
          rt.format(cfp, 114, null),
        ].join("")
      );
    }
    carried = rt.compare("is", cfp, true);
    if (rt.truth(carried)) {
      if (rt.truth(rt.compare("notin", obs, prior_by))) {
        rt.method(
          out,
          "append",
          [
            rt.format(idx_path, -1, null),
            ": row ",
            rt.format(obs, -1, null),
            ": carried_from_prior but the id is NOT in the prior index — carrying an invented ghost is denominator padding, not drift accounting",
          ].join("")
        );
      }
      if (rt.truth(rt.compare("in", obs, seen_obs))) {
        rt.method(
          out,
          "append",
          [
            rt.format(idx_path, -1, null),
            ": row ",
            rt.format(obs, -1, null),
            ": carried_from_prior on an observation THIS run emitted — carried means the parser no longer produces it; a live observation marked carried is a denominator bypass",
          ].join("")
        );
      }
      if (rt.truth(rt.compare("notin", outcome, rt.tuple(["irrelevant", "unresolved"])))) {
        rt.method(
          out,
          "append",
          [
            rt.format(idx_path, -1, null),
            ": row ",
            rt.format(obs, -1, null),
            ": a carried (retired/parked) observation cannot be ",
            rt.format(outcome, 114, null),
            " — nothing observed THIS run supports it",
          ].join("")
        );
      }
    } else {
      if (rt.truth(rt.compare("notin", obs, seen_obs))) {
        rt.method(
          out,
          "append",
          [rt.format(idx_path, -1, null), ": row ", rt.format(obs, -1, null), " matches no scanned observation"].join(
            ""
          )
        );
      }
    }
    prior = rt.get(prior_by, obs);
    if (rt.truth(carried)) {
      rt.method(
        flags,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row ",
          rt.format(obs, -1, null),
          ": CARRIED retirement/park (",
          rt.format(outcome, -1, null),
          ": ",
          rt.format(
            rt.invoke(
              str,
              rt.or(rt.get(r, "reason"), () => rt.get(r, "needed_evidence"))
            ),
            114,
            null
          ),
          ") — the steward judges whether it is truthful",
        ].join("")
      );
    } else {
      if (
        rt.truth(
          rt.and(prior, () =>
            rt.and(rt.compare("eq", rt.get(prior, "outcome"), "unresolved"), () =>
              rt.compare("eq", outcome, "irrelevant")
            )
          )
        )
      ) {
        rt.method(
          flags,
          "append",
          [
            rt.format(idx_path, -1, null),
            ": row ",
            rt.format(obs, -1, null),
            ": prior-UNRESOLVED row re-dispositioned IRRELEVANT (",
            rt.format(rt.invoke(str, rt.get(r, "reason")), 114, null),
            ") — the steward judges whether this retirement is truthful",
          ].join("")
        );
      }
    }
    if (rt.truth(rt.compare("notin", outcome, rt.tuple(["irrelevant", "mapped", "proposed", "unresolved"])))) {
      rt.method(
        out,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row ",
          rt.format(obs, -1, null),
          ": invalid outcome ",
          rt.format(outcome, 114, null),
        ].join("")
      );
      continue;
    }
    if (
      rt.truth(rt.and(rt.compare("in", "reason", r), () => !rt.truth(rt.invoke(isinstance, rt.get(r, "reason"), str))))
    ) {
      rt.method(
        out,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row ",
          rt.format(obs, -1, null),
          ": reason must be a STRING, got ",
          rt.format(rt.get(r, "reason"), 114, null),
          " — steward-facing prose is text",
        ].join("")
      );
    }
    if (
      rt.truth(
        rt.and(
          rt.compare("in", "needed_evidence", r),
          () => !rt.truth(rt.invoke(isinstance, rt.get(r, "needed_evidence"), str))
        )
      )
    ) {
      rt.method(
        out,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row ",
          rt.format(obs, -1, null),
          ": needed_evidence must be a STRING, got ",
          rt.format(rt.get(r, "needed_evidence"), 114, null),
        ].join("")
      );
    }
    if (rt.truth(rt.compare("eq", outcome, "irrelevant"))) {
      reason = rt.truth(rt.invoke(isinstance, rt.get(r, "reason"), str))
        ? rt.method(
            rt.invoke(
              str,
              rt.or(rt.get(r, "reason"), () => "")
            ),
            "strip"
          )
        : "";
      if (
        rt.truth(
          rt.or(rt.compare("lt", rt.invoke(len, reason), 15), () =>
            rt.compare("in", rt.method(reason, "lower"), TRIVIAL_REASONS)
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [
            rt.format(idx_path, -1, null),
            ": row ",
            rt.format(obs, -1, null),
            ": irrelevant needs a concrete reason",
          ].join("")
        );
      }
    } else {
      if (rt.truth(rt.compare("in", outcome, rt.tuple(["mapped", "proposed"])))) {
        ref = rt.invoke(
          str,
          rt.or(rt.get(r, "ref"), () => "")
        );
        tgt = rt.get(by_id, ref);
        if (rt.truth(rt.compare("is", tgt, null))) {
          rt.method(
            out,
            "append",
            [
              rt.format(idx_path, -1, null),
              ": row ",
              rt.format(obs, -1, null),
              ": ",
              rt.format(outcome, -1, null),
              " ref ",
              rt.format(ref, 114, null),
              " must resolve",
            ].join("")
          );
        } else {
          if (
            rt.truth(
              rt.and(rt.compare("eq", outcome, "mapped"), () =>
                rt.compare("isnot", rt.invoke(get, tgt, "reuse.exact_reuse_found"), true)
              )
            )
          ) {
            rt.method(
              out,
              "append",
              [
                rt.format(idx_path, -1, null),
                ": row ",
                rt.format(obs, -1, null),
                ": mapped ref is not a reuse proposal",
              ].join("")
            );
          }
          dh = rt.or(rt.get(dh_by, rt.invoke(skey, rt.get(tgt, "hypothesis_ref"))), () => rt.dict([]));
          if (rt.truth(rt.compare("notin", obs, rt.invoke(aslist, rt.get(dh, "observation_refs"))))) {
            rt.method(
              out,
              "append",
              [
                rt.format(idx_path, -1, null),
                ": row ",
                rt.format(obs, -1, null),
                ": proposal ",
                rt.format(ref, 114, null),
                " does not cite this observation in its hypothesis evidence — closing an observation with someone else's proposal skips its analysis",
              ].join("")
            );
          }
        }
      } else {
        ne = rt.truth(rt.invoke(isinstance, rt.get(r, "needed_evidence"), str))
          ? rt.method(
              rt.invoke(
                str,
                rt.or(rt.get(r, "needed_evidence"), () => "")
              ),
              "strip"
            )
          : "";
        if (rt.truth(rt.compare("lt", rt.invoke(len, ne), 15))) {
          rt.method(
            out,
            "append",
            [
              rt.format(idx_path, -1, null),
              ": row ",
              rt.format(obs, -1, null),
              ": unresolved requires needed_evidence",
            ].join("")
          );
        }
        since = rt.invoke(
          str,
          rt.or(rt.get(r, "since"), () => "")
        );
        if (rt.truth(!rt.truth(rt.method(re, "fullmatch", "\\d{4}-\\d{2}-\\d{2}", since)))) {
          rt.method(
            out,
            "append",
            [
              rt.format(idx_path, -1, null),
              ": row ",
              rt.format(obs, -1, null),
              ": since must be EXACTLY YYYY-MM-DD",
            ].join("")
          );
        } else {
          try {
            if (rt.truth(rt.compare("gt", rt.method(date, "fromisoformat", since), rt.method(date, "today")))) {
              rt.method(
                out,
                "append",
                [rt.format(idx_path, -1, null), ": row ", rt.format(obs, -1, null), ": since is in the future"].join("")
              );
            }
          } catch (caught) {
            if (rt.catches(caught, ValueError)) {
              rt.method(
                out,
                "append",
                [rt.format(idx_path, -1, null), ": row ", rt.format(obs, -1, null), ": since is not a real date"].join(
                  ""
                )
              );
            } else {
              throw caught;
            }
          }
        }
        prior = rt.get(prior_by, obs);
        if (
          rt.truth(
            rt.and(prior, () =>
              rt.and(rt.compare("eq", rt.get(prior, "outcome"), "unresolved"), () =>
                rt.compare(
                  "eq",
                  rt.method(
                    rt.invoke(
                      str,
                      rt.or(rt.get(prior, "needed_evidence"), () => "")
                    ),
                    "strip"
                  ),
                  ne
                )
              )
            )
          )
        ) {
          rt.method(
            out,
            "append",
            [
              rt.format(idx_path, -1, null),
              ": row ",
              rt.format(obs, -1, null),
              ": re-parked VERBATIM from the prior run",
            ].join("")
          );
        }
      }
    }
    if (
      rt.truth(
        rt.and(rt.compare("in", obs, unrep_ids), () => rt.compare("in", outcome, rt.tuple(["mapped", "proposed"])))
      )
    ) {
      rt.method(
        out,
        "append",
        [
          rt.format(idx_path, -1, null),
          ": row ",
          rt.format(obs, -1, null),
          ": unrepresentable_construct observations may only be unresolved or irrelevant",
        ].join("")
      );
    }
  }
  missing = rt.op("sub", seen_obs, indexed);
  if (rt.truth(missing)) {
    rt.method(
      out,
      "append",
      [
        rt.format(idx_path, -1, null),
        ": ",
        rt.format(rt.invoke(len, missing), -1, null),
        " observation(s) have NO disposition: ",
        rt.format(
          rt.item(
            rt.invoke(
              sorted,
              rt.comprehend(missing, (item: unknown) => {
                let m: unknown;
                m = item;
                return rt.invoke(str, m);
              })
            ),
            rt.slice(undefined, 3, undefined)
          ),
          -1,
          null
        ),
      ].join("")
    );
  }
  return out;
  return null;
});
safe_join = rt.fn("safe_join", (args, kwargs) => {
  let ex: unknown;
  let p: unknown;
  let rel: unknown;
  let repo_root: unknown;
  let root_res: unknown;
  let target: unknown;
  let what: unknown;
  repo_root = rt.argument(args, kwargs, 0, "repo_root", undefined);
  rel = rt.argument(args, kwargs, 1, "rel", undefined);
  p = rt.argument(args, kwargs, 2, "p", undefined);
  what = rt.argument(args, kwargs, 3, "what", "repository.path");
  rel = rt.invoke(
    str,
    rt.or(rel, () => "")
  );
  if (
    rt.truth(
      rt.or(rt.method(rel, "startswith", rt.tuple(["/", "\\"])), () => rt.method(re, "match", "^[A-Za-z]:", rel))
    )
  ) {
    rt.invoke(
      err,
      p,
      [
        rt.format(what, -1, null),
        " ",
        rt.format(rel, 114, null),
        " is absolute — pinned paths are relative to the root",
      ].join("")
    );
    return null;
  }
  try {
    try {
      target = rt.call(rt.attr(rt.op("div", repo_root, rel), "resolve"), [], { strict: true });
    } catch (caught) {
      if (rt.catches(caught, FileNotFoundError)) {
        target = rt.method(rt.op("div", repo_root, rel), "resolve");
      } else {
        throw caught;
      }
    }
    root_res = rt.method(repo_root, "resolve");
  } catch (caught) {
    if (rt.catches(caught, rt.tuple([OSError, RuntimeError]))) {
      ex = caught;
      rt.invoke(
        err,
        p,
        [
          rt.format(what, -1, null),
          " ",
          rt.format(rel, 114, null),
          " cannot be resolved (",
          rt.format(ex, -1, null),
          ") — fails CLOSED as a violation, never a crash",
        ].join("")
      );
      return null;
    } else {
      throw caught;
    }
  }
  if (
    rt.truth(
      rt.and(
        !rt.truth(rt.method(rt.invoke(str, target), "startswith", rt.op("add", rt.invoke(str, root_res), "/"))),
        () => rt.compare("ne", target, root_res)
      )
    )
  ) {
    rt.invoke(err, p, [rt.format(what, -1, null), " ", rt.format(rel, 114, null), " escapes the pinned root"].join(""));
    return null;
  }
  return target;
  return null;
});
make_pinned_reader = rt.fn("make_pinned_reader", (args, kwargs) => {
  let dirty_waived: unknown;
  let out: unknown;
  let pinned_read: unknown;
  let repo_root: unknown;
  repo_root = rt.argument(args, kwargs, 0, "repo_root", undefined);
  out = rt.argument(args, kwargs, 1, "out", undefined);
  dirty_waived = rt.argument(args, kwargs, 2, "dirty_waived", undefined);
  pinned_read = rt.fn("pinned_read", (args, kwargs) => {
    let ex: unknown;
    let ls: unknown;
    let mode: unknown;
    let posixpath: unknown;
    let raw: unknown;
    let rel: unknown;
    let rel_n: unknown;
    let show: unknown;
    let typ: unknown;
    let where: unknown;
    rel = rt.argument(args, kwargs, 0, "rel", undefined);
    where = rt.argument(args, kwargs, 1, "where", undefined);
    posixpath = rt.module("posixpath");
    raw = rt.invoke(
      str,
      rt.or(rel, () => "")
    );
    if (rt.truth(rt.compare("in", "..", rt.method(raw, "split", "/")))) {
      rt.method(
        out,
        "append",
        [
          rt.format(where, -1, null),
          ": consumed path ",
          rt.format(raw, 114, null),
          " contains a raw '..' component — parent traversal is rejected BEFORE normalization, in-repo cancellation included",
        ].join("")
      );
      return null;
    }
    rel_n = rt.method(rt.method(posixpath, "normpath", raw), "rstrip", "/");
    if (rt.truth(rt.compare("in", rel_n, rt.tuple([".", ""])))) {
      rel_n = "";
    }
    if (
      rt.truth(
        rt.or(!rt.truth(rel_n), () =>
          rt.or(rt.method(rel_n, "startswith", rt.tuple(["/", "\\"])), () =>
            rt.method(re, "match", "^[A-Za-z]:", rel_n)
          )
        )
      )
    ) {
      rt.method(
        out,
        "append",
        [rt.format(where, -1, null), ": consumed path ", rt.format(rel, 114, null), " is absolute/empty"].join("")
      );
      return null;
    }
    if (rt.truth(rt.compare("in", "..", rt.method(rel_n, "split", "/")))) {
      rt.method(
        out,
        "append",
        [rt.format(where, -1, null), ": consumed path ", rt.format(rel, 114, null), " escapes the pinned root"].join("")
      );
      return null;
    }
    try {
      ls = rt.call(
        rt.attr(subprocess, "run"),
        [["git", "-C", rt.invoke(str, repo_root), "ls-files", "-s", "--", rel_n]],
        {
          capture_output: true,
          text: true,
          timeout: 10,
        }
      );
    } catch (caught) {
      if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
        rt.method(
          out,
          "append",
          [
            rt.format(where, -1, null),
            ": git ls-files for ",
            rt.format(rel_n, 114, null),
            " TIMED OUT — fails CLOSED as a violation, never a crash",
          ].join("")
        );
        return null;
      } else {
        throw caught;
      }
    }
    if (
      rt.truth(
        rt.or(
          rt.compare("ne", rt.attr(ls, "returncode"), 0),
          () => !rt.truth(rt.method(rt.attr(ls, "stdout"), "strip"))
        )
      )
    ) {
      rt.method(
        out,
        "append",
        [
          rt.format(where, -1, null),
          ": consumed path ",
          rt.format(rel_n, 114, null),
          " is NOT tracked at the pinned commit — untracked bytes are not pinned evidence",
        ].join("")
      );
      return null;
    }
    mode = rt.item(rt.method(rt.attr(ls, "stdout"), "split"), 0);
    if (rt.truth(rt.compare("in", mode, rt.tuple(["120000", "160000"])))) {
      rt.method(
        out,
        "append",
        [
          rt.format(where, -1, null),
          ": consumed path ",
          rt.format(rel_n, 114, null),
          " is a symlink/submodule (mode ",
          rt.format(mode, -1, null),
          ") — evidence is a blob, not a pointer to bytes outside the pin",
        ].join("")
      );
      return null;
    }
    if (rt.truth(dirty_waived)) {
      try {
        typ = rt.call(
          rt.attr(subprocess, "run"),
          [["git", "-C", rt.invoke(str, repo_root), "cat-file", "-t", ["HEAD:", rt.format(rel_n, -1, null)].join("")]],
          { capture_output: true, text: true, timeout: 10 }
        );
        if (
          rt.truth(
            rt.and(rt.compare("eq", rt.attr(typ, "returncode"), 0), () =>
              rt.compare("ne", rt.method(rt.attr(typ, "stdout"), "strip"), "blob")
            )
          )
        ) {
          rt.method(
            out,
            "append",
            [
              rt.format(where, -1, null),
              ": HEAD:",
              rt.format(rel_n, -1, null),
              " is ",
              rt.format(rt.method(rt.attr(typ, "stdout"), "strip"), 114, null),
              ", not a blob — the dirty waiver reads worktree bytes but does not waive object-type authentication",
            ].join("")
          );
          return null;
        }
      } catch (caught) {
        if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
          rt.method(
            out,
            "append",
            [
              rt.format(where, -1, null),
              ": git cat-file for ",
              rt.format(rel_n, 114, null),
              " TIMED OUT — fails CLOSED",
            ].join("")
          );
          return null;
        } else {
          throw caught;
        }
      }
      try {
        return rt.method(rt.op("div", repo_root, rel_n), "read_bytes");
      } catch (caught) {
        if (rt.catches(caught, Exception)) {
          ex = caught;
          rt.method(
            out,
            "append",
            [
              rt.format(where, -1, null),
              ": cannot read ",
              rt.format(rel_n, 114, null),
              " (",
              rt.format(ex, -1, null),
              ")",
            ].join("")
          );
          return null;
        } else {
          throw caught;
        }
      }
    }
    try {
      typ = rt.call(
        rt.attr(subprocess, "run"),
        [["git", "-C", rt.invoke(str, repo_root), "cat-file", "-t", ["HEAD:", rt.format(rel_n, -1, null)].join("")]],
        {
          capture_output: true,
          text: true,
          timeout: 10,
        }
      );
      if (
        rt.truth(
          rt.or(rt.compare("ne", rt.attr(typ, "returncode"), 0), () =>
            rt.compare("ne", rt.method(rt.attr(typ, "stdout"), "strip"), "blob")
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [
            rt.format(where, -1, null),
            ": HEAD:",
            rt.format(rel_n, -1, null),
            " is ",
            rt.format(
              rt.or(rt.method(rt.attr(typ, "stdout"), "strip"), () => "unresolvable"),
              -1,
              null
            ),
            ", not a blob — a directory listing is not evidence",
          ].join("")
        );
        return null;
      }
      show = rt.call(
        rt.attr(subprocess, "run"),
        [["git", "-C", rt.invoke(str, repo_root), "show", ["HEAD:", rt.format(rel_n, -1, null)].join("")]],
        {
          capture_output: true,
          timeout: 15,
        }
      );
      if (rt.truth(rt.compare("ne", rt.attr(show, "returncode"), 0))) {
        rt.method(
          out,
          "append",
          [
            rt.format(where, -1, null),
            ": git show HEAD:",
            rt.format(rel_n, -1, null),
            " FAILED — pinned-blob verification fails CLOSED",
          ].join("")
        );
        return null;
      }
      return rt.attr(show, "stdout");
    } catch (caught) {
      if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
        rt.method(
          out,
          "append",
          [rt.format(where, -1, null), ": git read of ", rt.format(rel_n, 114, null), " TIMED OUT — fails CLOSED"].join(
            ""
          )
        );
        return null;
      } else {
        throw caught;
      }
    }
    return null;
  });
  return pinned_read;
  return null;
});
repo_fidelity = rt.fn("repo_fidelity", (args, kwargs) => {
  let _: unknown;
  let a: unknown;
  let blob: unknown;
  let bmember: unknown;
  let bmeta: unknown;
  let brow: unknown;
  let btab: unknown;
  let c: unknown;
  let cid: unknown;
  let cq_bytes: unknown;
  let cq_ids: unknown;
  let cq_rel: unknown;
  let d: unknown;
  let data: unknown;
  let dd: unknown;
  let dhs: unknown;
  let dirty_waived: unknown;
  let dp: unknown;
  let e: unknown;
  let entries: unknown;
  let ex: unknown;
  let excluded: unknown;
  let f: unknown;
  let field: unknown;
  let genv: unknown;
  let gmode: unknown;
  let head: unknown;
  let k: unknown;
  let key: unknown;
  let label: unknown;
  let lex: unknown;
  let lines: unknown;
  let loaded: unknown;
  let ls: unknown;
  let man_commit: unknown;
  let manifest: unknown;
  let md: unknown;
  let member: unknown;
  let mp: unknown;
  let node: unknown;
  let norm_span: unknown;
  let obj: unknown;
  let otps: unknown;
  let out: unknown;
  let p: unknown;
  let parts: unknown;
  let pinned_read: unknown;
  let pos: unknown;
  let pr: unknown;
  let pred: unknown;
  let quote: unknown;
  let rd: unknown;
  let rel: unknown;
  let rel_n: unknown;
  let repo_root: unknown;
  let reviews: unknown;
  let rp: unknown;
  let s: unknown;
  let show: unknown;
  let sos: unknown;
  let span: unknown;
  let span_text: unknown;
  let st: unknown;
  let status: unknown;
  let stripped: unknown;
  let stripped_cfg: unknown;
  let typ: unknown;
  let typ_out: unknown;
  let val: unknown;
  let want: unknown;
  let wt: unknown;
  sos = rt.argument(args, kwargs, 0, "sos", undefined);
  pos = rt.argument(args, kwargs, 1, "pos", undefined);
  manifest = rt.argument(args, kwargs, 2, "manifest", undefined);
  otps = rt.argument(args, kwargs, 3, "otps", undefined);
  reviews = rt.argument(args, kwargs, 4, "reviews", undefined);
  dhs = rt.argument(args, kwargs, 5, "dhs", undefined);
  repo_root = rt.argument(args, kwargs, 6, "repo_root", undefined);
  out = [];
  man_commit = rt.truth(manifest) ? rt.invoke(get, rt.item(manifest, 1), "repository.commit") : null;
  dirty_waived = rt.invoke(
    bool,
    rt.and(manifest, () =>
      rt.and(rt.compare("is", rt.invoke(get, rt.item(manifest, 1), "repository.dirty"), true), () =>
        rt.compare("is", rt.invoke(get, rt.item(manifest, 1), "repository.pin_waived"), true)
      )
    )
  );
  pinned_read = rt.invoke(make_pinned_reader, repo_root, out, dirty_waived);
  try {
    head = rt.call(rt.attr(subprocess, "run"), [["git", "-C", rt.invoke(str, repo_root), "rev-parse", "HEAD"]], {
      capture_output: true,
      text: true,
      timeout: 10,
    });
    if (rt.truth(rt.compare("ne", rt.attr(head, "returncode"), 0))) {
      rt.method(
        out,
        "append",
        [
          rt.format(repo_root, -1, null),
          ": cannot resolve git HEAD — an unpinnable tree must use an explicit pin waiver, not silence",
        ].join("")
      );
    } else {
      if (
        rt.truth(
          rt.and(man_commit, () =>
            rt.compare("ne", rt.method(rt.attr(head, "stdout"), "strip"), rt.invoke(str, man_commit))
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [
            rt.format(repo_root, -1, null),
            ": manifest commit ",
            rt.format(rt.item(rt.invoke(str, man_commit), rt.slice(undefined, 12, undefined)), -1, null),
            " does not match git HEAD ",
            rt.format(
              rt.item(rt.method(rt.attr(head, "stdout"), "strip"), rt.slice(undefined, 12, undefined)),
              -1,
              null
            ),
            " — the pin names a tree that is not the one being read",
          ].join("")
        );
      }
      status = rt.call(
        rt.attr(subprocess, "run"),
        [["git", "-C", rt.invoke(str, repo_root), "status", "--porcelain", "-uno"]],
        {
          capture_output: true,
          text: true,
          timeout: 10,
        }
      );
      if (rt.truth(rt.compare("ne", rt.attr(status, "returncode"), 0))) {
        rt.method(
          out,
          "append",
          [
            rt.format(repo_root, -1, null),
            ": git status FAILED (rc=",
            rt.format(rt.attr(status, "returncode"), -1, null),
            ") — dirty-state verification fails CLOSED, never open",
          ].join("")
        );
      } else {
        if (
          rt.truth(
            rt.and(
              rt.method(rt.attr(status, "stdout"), "strip"),
              () =>
                !rt.truth(
                  rt.and(manifest, () =>
                    rt.compare("is", rt.invoke(get, rt.item(manifest, 1), "repository.dirty"), true)
                  )
                )
            )
          )
        ) {
          rt.method(
            out,
            "append",
            [
              rt.format(repo_root, -1, null),
              ": the working tree has TRACKED modifications but the manifest asserts dirty: false",
            ].join("")
          );
        }
      }
    }
  } catch (caught) {
    if (rt.catches(caught, Exception)) {
      ex = caught;
      rt.method(
        out,
        "append",
        [rt.format(repo_root, -1, null), ": cannot verify commit against git (", rt.format(ex, -1, null), ")"].join("")
      );
    } else {
      throw caught;
    }
  }
  for (const loop62 of rt.iter(sos)) {
    p = rt.item(loop62, 0);
    d = rt.item(loop62, 1);
    if (rt.truth(rt.and(man_commit, () => rt.compare("ne", rt.invoke(get, d, "repository.commit"), man_commit)))) {
      rt.method(out, "append", [rt.format(p, -1, null), ": observation commit differs from the manifest pin"].join(""));
    }
    blob = rt.invoke(pinned_read, rt.invoke(get, d, "repository.path"), p);
    if (rt.truth(rt.compare("is", blob, null))) {
      continue;
    }
    span = rt.truth(rt.invoke(isinstance, rt.get(d, "source_span"), dict)) ? rt.get(d, "source_span") : rt.dict([]);
    try {
      lines = rt.call(rt.attr(rt.call(rt.attr(blob, "decode"), [], { errors: "replace" }), "splitlines"), [], {
        keepends: true,
      });
      s = rt.item(
        rt.tuple([rt.invoke(int, rt.get(span, "start_line", 0)), rt.invoke(int, rt.get(span, "end_line", 0))]),
        0
      );
      e = rt.item(
        rt.tuple([rt.invoke(int, rt.get(span, "start_line", 0)), rt.invoke(int, rt.get(span, "end_line", 0))]),
        1
      );
      span_text = rt.method("", "join", rt.item(lines, rt.slice(rt.op("sub", s, 1), e, undefined)));
      if (
        rt.truth(
          rt.compare(
            "ne",
            rt.method(rt.method(hashlib, "sha256", rt.method(span_text, "encode")), "hexdigest"),
            rt.get(span, "content_sha256")
          )
        )
      ) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": source_span.content_sha256 does not match the PINNED BLOB (git show HEAD:path) — working-tree bytes are not the pin",
          ].join("")
        );
      }
      stripped = rt.invoke(strip_comments, span_text, rt.invoke(get, d, "repository.path"));
      stripped_cfg = rt.invoke(strip_comments_config, span_text, rt.invoke(get, d, "repository.path"));
      lex = rt.invoke(get, d, "symbol.lexical_name");
      if (rt.truth(rt.and(lex, () => !rt.truth(rt.invoke(occurs, lex, stripped))))) {
        rt.method(
          out,
          "append",
          [
            rt.format(p, -1, null),
            ": symbol ",
            rt.format(lex, 114, null),
            " does not occur (token-bounded, comments stripped) in its own span",
          ].join("")
        );
      }
      for (const loop63 of rt.iter(rt.invoke(aslist, rt.get(d, "observed_facts")))) {
        f = loop63;
        if (rt.truth(!rt.truth(rt.invoke(isinstance, f, dict)))) {
          continue;
        }
        pred = rt.item(
          rt.tuple([
            rt.get(f, "predicate"),
            rt.invoke(
              str,
              rt.or(rt.get(f, "object"), () => "")
            ),
          ]),
          0
        );
        obj = rt.item(
          rt.tuple([
            rt.get(f, "predicate"),
            rt.invoke(
              str,
              rt.or(rt.get(f, "object"), () => "")
            ),
          ]),
          1
        );
        if (rt.truth(rt.or(rt.compare("eq", pred, "unrepresentable_construct"), () => !rt.truth(obj)))) {
          continue;
        }
        if (rt.truth(rt.compare("eq", pred, "config_key_value"))) {
          key = rt.item(rt.method(obj, "partition", "="), 0);
          _ = rt.item(rt.method(obj, "partition", "="), 1);
          val = rt.item(rt.method(obj, "partition", "="), 2);
          if (
            rt.truth(
              !rt.truth(rt.invoke(config_pair_occurs, key, val, stripped_cfg, rt.invoke(get, d, "repository.path")))
            )
          ) {
            rt.method(
              out,
              "append",
              [
                rt.format(p, -1, null),
                ": config pair ",
                rt.format(key, 114, null),
                "=",
                rt.format(val, 114, null),
                " does not occur AS A PAIRING in the span — key and value found on different keys authenticate a pairing that is not in the file",
              ].join("")
            );
          }
        } else {
          if (rt.truth(!rt.truth(rt.invoke(occurs, obj, stripped)))) {
            rt.method(
              out,
              "append",
              [
                rt.format(p, -1, null),
                ": fact object ",
                rt.format(obj, 114, null),
                " does not occur token-bounded in the comment-stripped span — substring shadows (id⊂override) and comment mentions are not declarations",
              ].join("")
            );
          }
        }
      }
    } catch (caught) {
      if (rt.catches(caught, Exception)) {
        ex = caught;
        rt.method(
          out,
          "append",
          [rt.format(p, -1, null), ": cannot verify span against repo (", rt.format(ex, -1, null), ")"].join("")
        );
      } else {
        throw caught;
      }
    }
  }
  for (const loop64 of rt.iter(pos)) {
    p = rt.item(loop64, 0);
    d = rt.item(loop64, 1);
    if (rt.truth(rt.and(man_commit, () => rt.compare("ne", rt.invoke(get, d, "repository.commit"), man_commit)))) {
      rt.method(out, "append", [rt.format(p, -1, null), ": observation commit differs from the manifest pin"].join(""));
    }
    blob = rt.invoke(pinned_read, rt.invoke(get, d, "repository.path"), p);
    if (rt.truth(rt.compare("is", blob, null))) {
      continue;
    }
    span = rt.truth(rt.invoke(isinstance, rt.get(d, "source_span"), dict)) ? rt.get(d, "source_span") : rt.dict([]);
    try {
      lines = rt.call(rt.attr(rt.call(rt.attr(blob, "decode"), [], { errors: "replace" }), "splitlines"), [], {
        keepends: true,
      });
      s = rt.item(
        rt.tuple([rt.invoke(int, rt.get(span, "start_line", 0)), rt.invoke(int, rt.get(span, "end_line", 0))]),
        0
      );
      e = rt.item(
        rt.tuple([rt.invoke(int, rt.get(span, "start_line", 0)), rt.invoke(int, rt.get(span, "end_line", 0))]),
        1
      );
      span_text = rt.method("", "join", rt.item(lines, rt.slice(rt.op("sub", s, 1), e, undefined)));
      quote = rt.method(
        re,
        "sub",
        "\\s+",
        " ",
        rt.method(
          rt.invoke(
            str,
            rt.or(rt.get(d, "quote"), () => "")
          ),
          "strip"
        )
      );
      norm_span = rt.method(re, "sub", "\\s+", " ", span_text);
      if (rt.truth(rt.or(!rt.truth(quote), () => rt.compare("notin", quote, norm_span)))) {
        rt.method(out, "append", [rt.format(p, -1, null), ": quote does not occur verbatim in its span"].join(""));
      }
    } catch (caught) {
      if (rt.catches(caught, Exception)) {
        ex = caught;
        rt.method(
          out,
          "append",
          [rt.format(p, -1, null), ": cannot verify quote against repo (", rt.format(ex, -1, null), ")"].join("")
        );
      } else {
        throw caught;
      }
    }
  }
  if (rt.truth(manifest)) {
    mp = rt.item(manifest, 0);
    md = rt.item(manifest, 1);
    for (const loop65 of rt.iter(
      rt.tuple([rt.tuple(["scope_doc", rt.get(md, "scope_doc")]), rt.tuple(["cq_suite", rt.get(md, "cq_suite")])])
    )) {
      label = rt.item(loop65, 0);
      node = rt.item(loop65, 1);
      node = rt.truth(rt.invoke(isinstance, node, dict)) ? node : rt.dict([]);
      rel = rt.item(rt.tuple([rt.get(node, "path"), rt.get(node, "sha256_12")]), 0);
      want = rt.item(rt.tuple([rt.get(node, "path"), rt.get(node, "sha256_12")]), 1);
      if (rt.truth(!rt.truth(rel))) {
        continue;
      }
      data = rt.invoke(pinned_read, rel, mp);
      if (rt.truth(rt.compare("is", data, null))) {
        continue;
      }
      if (rt.truth(!rt.truth(want))) {
        rt.method(
          out,
          "append",
          [rt.format(mp, -1, null), ": ", rt.format(label, -1, null), ".sha256_12 missing"].join("")
        );
      } else {
        if (rt.truth(rt.compare("ne", rt.invoke(sha12, data), want))) {
          rt.method(
            out,
            "append",
            [
              rt.format(mp, -1, null),
              ": ",
              rt.format(label, -1, null),
              ".sha256_12 does not match the pinned ",
              rt.format(rel, -1, null),
            ].join("")
          );
        }
      }
    }
    for (const loop66 of rt.iter(rt.invoke(aslist, rt.get(md, "adapters")))) {
      a = loop66;
      if (rt.truth(!rt.truth(rt.invoke(isinstance, a, dict)))) {
        continue;
      }
      for (const loop67 of rt.iter(
        rt.tuple([rt.tuple(["script", "adapter script"]), rt.tuple(["golden_fixture", "golden fixture"])])
      )) {
        field = rt.item(loop67, 0);
        label = rt.item(loop67, 1);
        rel = rt.get(a, field);
        if (rt.truth(!rt.truth(rel))) {
          continue;
        }
        if (rt.truth(rt.compare("eq", field, "script"))) {
          data = rt.invoke(pinned_read, rel, mp);
          if (
            rt.truth(
              rt.and(rt.compare("isnot", data, null), () =>
                rt.and(rt.get(a, "script_sha256_12"), () =>
                  rt.compare("ne", rt.invoke(sha12, data), rt.get(a, "script_sha256_12"))
                )
              )
            )
          ) {
            rt.method(
              out,
              "append",
              [
                rt.format(mp, -1, null),
                ": ",
                rt.format(label, -1, null),
                " digest does not match the pinned ",
                rt.format(rel, -1, null),
              ].join("")
            );
          }
        } else {
          rel_n = rt.method(rt.method(re, "sub", "^\\./+", "", rt.invoke(str, rel)), "rstrip", "/");
          if (
            rt.truth(
              rt.or(rt.method(rel_n, "startswith", ":"), () =>
                rt.or(rt.compare("in", "*", rel_n), () =>
                  rt.or(rt.compare("in", "?", rel_n), () => rt.compare("in", "[", rel_n))
                )
              )
            )
          ) {
            rt.method(
              out,
              "append",
              [
                rt.format(mp, -1, null),
                ": ",
                rt.format(label, -1, null),
                " ",
                rt.format(rel_n, 114, null),
                " is not a LITERAL repository-relative path — pathspec magic (:(exclude)…) and globs would let the manifest select members the fixture never named",
              ].join("")
            );
            continue;
          }
          genv = rt.call(dict, [rt.attr(os, "environ")], { GIT_LITERAL_PATHSPECS: "1" });
          try {
            ls = rt.call(
              rt.attr(subprocess, "run"),
              [["git", "-C", rt.invoke(str, repo_root), "ls-files", "-s", "-z", "--", rel_n]],
              {
                capture_output: true,
                timeout: 10,
                env: genv,
              }
            );
          } catch (caught) {
            if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": git ls-files for ",
                  rt.format(label, -1, null),
                  " TIMED OUT — fails CLOSED",
                ].join("")
              );
              continue;
            } else {
              throw caught;
            }
          }
          if (
            rt.truth(
              rt.or(
                rt.compare("ne", rt.attr(ls, "returncode"), 0),
                () => !rt.truth(rt.method(rt.method(rt.attr(ls, "stdout"), "strip", rt.bytes([0])), "strip"))
              )
            )
          ) {
            rt.method(
              out,
              "append",
              [
                rt.format(mp, -1, null),
                ": ",
                rt.format(label, -1, null),
                " ",
                rt.format(rel_n, 114, null),
                " has no tracked files at the pinned commit",
              ].join("")
            );
            continue;
          }
          try {
            st = rt.call(
              rt.attr(subprocess, "run"),
              [["git", "-C", rt.invoke(str, repo_root), "status", "--porcelain", "--ignored=matching", "--", rel_n]],
              {
                capture_output: true,
                timeout: 10,
                env: genv,
              }
            );
          } catch (caught) {
            if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": git status on ",
                  rt.format(label, -1, null),
                  " TIMED OUT — fails CLOSED",
                ].join("")
              );
              continue;
            } else {
              throw caught;
            }
          }
          if (rt.truth(rt.compare("ne", rt.attr(st, "returncode"), 0))) {
            rt.method(
              out,
              "append",
              [rt.format(mp, -1, null), ": git status on ", rt.format(label, -1, null), " FAILED — fails CLOSED"].join(
                ""
              )
            );
          } else {
            if (rt.truth(rt.and(rt.method(rt.attr(st, "stdout"), "strip"), () => !rt.truth(dirty_waived)))) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": ",
                  rt.format(label, -1, null),
                  " ",
                  rt.format(rel_n, 114, null),
                  " contains modified/untracked/ignored files — a fixture suite with unpinned members is unpinned",
                ].join("")
              );
            }
          }
          for (const loop68 of rt.iter(rt.method(rt.attr(ls, "stdout"), "split", rt.bytes([0])))) {
            brow = loop68;
            if (rt.truth(!rt.truth(brow))) {
              continue;
            }
            bmeta = rt.item(rt.method(brow, "partition", rt.bytes([9])), 0);
            btab = rt.item(rt.method(brow, "partition", rt.bytes([9])), 1);
            bmember = rt.item(rt.method(brow, "partition", rt.bytes([9])), 2);
            try {
              parts = rt.method(rt.method(bmeta, "decode", "ascii"), "split");
              member = rt.method(os, "fsdecode", bmember);
            } catch (caught) {
              if (rt.catches(caught, Exception)) {
                parts = rt.item(rt.tuple([[], ""]), 0);
                member = rt.item(rt.tuple([[], ""]), 1);
              } else {
                throw caught;
              }
            }
            if (
              rt.truth(
                rt.or(!rt.truth(btab), () => rt.or(rt.compare("lt", rt.invoke(len, parts), 3), () => !rt.truth(member)))
              )
            ) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": ",
                  rt.format(label, -1, null),
                  " ls-files row ",
                  rt.format(brow, 114, null),
                  " unparseable — fails CLOSED",
                ].join("")
              );
              continue;
            }
            gmode = rt.item(parts, 0);
            if (rt.truth(rt.compare("in", gmode, rt.tuple(["120000", "160000"])))) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": ",
                  rt.format(label, -1, null),
                  " member ",
                  rt.format(member, 114, null),
                  " is a symlink/submodule (mode ",
                  rt.format(gmode, -1, null),
                  ") — fixture evidence is blobs, not pointers",
                ].join("")
              );
              continue;
            }
            try {
              typ = rt.call(
                rt.attr(subprocess, "run"),
                [
                  [
                    "git",
                    "-C",
                    rt.invoke(str, repo_root),
                    "cat-file",
                    "-t",
                    ["HEAD:", rt.format(member, -1, null)].join(""),
                  ],
                ],
                { capture_output: true, timeout: 10 }
              );
            } catch (caught) {
              if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
                rt.method(
                  out,
                  "append",
                  [rt.format(mp, -1, null), ": cat-file for ", rt.format(member, 114, null), " TIMED OUT"].join("")
                );
                continue;
              } else {
                throw caught;
              }
            }
            typ_out = rt.method(rt.method(rt.attr(typ, "stdout"), "strip"), "decode", "ascii", "replace");
            if (rt.truth(dirty_waived)) {
              if (
                rt.truth(
                  rt.and(rt.compare("eq", rt.attr(typ, "returncode"), 0), () => rt.compare("ne", typ_out, "blob"))
                )
              ) {
                rt.method(
                  out,
                  "append",
                  [
                    rt.format(mp, -1, null),
                    ": ",
                    rt.format(label, -1, null),
                    " member ",
                    rt.format(member, 114, null),
                    " is ",
                    rt.format(typ_out, 114, null),
                    " at HEAD, not a blob — the dirty waiver does not waive object-type authentication",
                  ].join("")
                );
              }
              continue;
            }
            if (
              rt.truth(rt.or(rt.compare("ne", rt.attr(typ, "returncode"), 0), () => rt.compare("ne", typ_out, "blob")))
            ) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": ",
                  rt.format(label, -1, null),
                  " member ",
                  rt.format(member, 114, null),
                  " is ",
                  rt.format(
                    rt.or(typ_out, () => "unresolvable"),
                    -1,
                    null
                  ),
                  " at HEAD, not a blob — a stage mode that says file over a tree object is a forged entry",
                ].join("")
              );
              continue;
            }
            try {
              show = rt.call(
                rt.attr(subprocess, "run"),
                [["git", "-C", rt.invoke(str, repo_root), "show", ["HEAD:", rt.format(member, -1, null)].join("")]],
                {
                  capture_output: true,
                  timeout: 15,
                }
              );
            } catch (caught) {
              if (rt.catches(caught, rt.attr(subprocess, "TimeoutExpired"))) {
                rt.method(
                  out,
                  "append",
                  [rt.format(mp, -1, null), ": git show for ", rt.format(member, 114, null), " TIMED OUT"].join("")
                );
                continue;
              } else {
                throw caught;
              }
            }
            try {
              wt = rt.method(rt.op("div", repo_root, member), "read_bytes");
            } catch (caught) {
              if (rt.catches(caught, Exception)) {
                wt = null;
              } else {
                throw caught;
              }
            }
            if (
              rt.truth(
                rt.or(rt.compare("ne", rt.attr(show, "returncode"), 0), () =>
                  rt.or(rt.compare("is", wt, null), () => rt.compare("ne", rt.attr(show, "stdout"), wt))
                )
              )
            ) {
              rt.method(
                out,
                "append",
                [
                  rt.format(mp, -1, null),
                  ": ",
                  rt.format(label, -1, null),
                  " member ",
                  rt.format(member, 114, null),
                  " worktree bytes do not equal the pinned blob — a skip-worktree/assume-unchanged fixture is unpinned evidence the self-check will read",
                ].join("")
              );
            }
          }
        }
      }
    }
    cq_rel = rt.invoke(get, md, "cq_suite.path");
    cq_bytes = rt.truth(cq_rel) ? rt.invoke(pinned_read, cq_rel, mp) : null;
    if (rt.truth(rt.compare("isnot", cq_bytes, null))) {
      try {
        loaded = rt.invoke(yload, cq_bytes);
        entries = rt.truth(rt.invoke(isinstance, loaded, list)) ? loaded : null;
        if (rt.truth(rt.and(rt.compare("is", entries, null), () => rt.invoke(isinstance, loaded, dict)))) {
          for (const loop69 of rt.iter(rt.tuple(["cqs", "competency_questions", "questions"]))) {
            k = loop69;
            if (rt.truth(rt.invoke(isinstance, rt.get(loaded, k), list))) {
              entries = rt.item(loaded, k);
            }
          }
        }
        if (rt.truth(rt.compare("is", entries, null))) {
          rt.method(out, "append", [rt.format(mp, -1, null), ": CQ file shape unrecognized — fails closed"].join(""));
        } else {
          if (rt.truth(rt.compare("ne", rt.invoke(len, entries), rt.invoke(get, md, "cq_suite.cq_count")))) {
            rt.method(
              out,
              "append",
              [
                rt.format(mp, -1, null),
                ": cq_count mismatch (",
                rt.format(rt.invoke(len, entries), -1, null),
                " in file)",
              ].join("")
            );
          }
          cq_ids = rt.item(rt.tuple([rt.invoke(set), rt.invoke(set)]), 0);
          excluded = rt.item(rt.tuple([rt.invoke(set), rt.invoke(set)]), 1);
          for (const loop70 of rt.iter(entries)) {
            e = loop70;
            if (rt.truth(rt.invoke(isinstance, e, dict))) {
              cid = rt.get(e, "id");
              if (
                rt.truth(
                  rt.or(
                    !rt.truth(rt.invoke(isinstance, cid, str)),
                    () => !rt.truth(rt.method(re, "match", "^CQ-[\\w-]+$", cid))
                  )
                )
              ) {
                rt.method(
                  out,
                  "append",
                  [
                    rt.format(mp, -1, null),
                    ": CQ entry with malformed/missing id ",
                    rt.format(cid, 114, null),
                    " — a null id stringifies into a citable ghost",
                  ].join("")
                );
                continue;
              }
              if (rt.truth(rt.compare("in", cid, cq_ids))) {
                rt.method(
                  out,
                  "append",
                  [rt.format(mp, -1, null), ": duplicate CQ id ", rt.format(cid, 114, null)].join("")
                );
              }
              rt.method(cq_ids, "add", cid);
              pr = rt.invoke(
                str,
                rt.or(rt.get(e, "priority"), () => "")
              );
              if (rt.truth(rt.and(pr, () => rt.compare("notin", pr, rt.tuple(["must_have", "should_have"]))))) {
                rt.method(excluded, "add", cid);
              }
            } else {
              if (rt.truth(rt.and(rt.invoke(isinstance, e, str), () => rt.method(re, "match", "^CQ-[\\w-]+$", e)))) {
                rt.method(cq_ids, "add", e);
              } else {
                rt.method(
                  out,
                  "append",
                  [rt.format(mp, -1, null), ": CQ entry ", rt.format(e, 114, null), " is not a CQ"].join("")
                );
              }
            }
          }
          for (const loop71 of rt.iter(otps)) {
            p = rt.item(loop71, 0);
            d = rt.item(loop71, 1);
            for (const loop72 of rt.iter(
              rt.invoke(aslist, rt.invoke(get, d, "operational_warrant.competency_questions"))
            )) {
              c = loop72;
              c = rt.invoke(str, c);
              if (rt.truth(rt.compare("notin", c, cq_ids))) {
                rt.method(
                  out,
                  "append",
                  [
                    rt.format(p, -1, null),
                    ": cited CQ ",
                    rt.format(c, 114, null),
                    " does not exist in ",
                    rt.format(cq_rel, -1, null),
                  ].join("")
                );
              } else {
                if (rt.truth(rt.compare("in", c, excluded))) {
                  rt.method(
                    out,
                    "append",
                    [
                      rt.format(p, -1, null),
                      ": cited CQ ",
                      rt.format(c, 114, null),
                      " has a non-Must/Should priority — admission is warranted by Must/Should CQs only (unknown values fail closed)",
                    ].join("")
                  );
                }
              }
            }
            for (const loop73 of rt.iter(rt.invoke(aslist, rt.invoke(get, d, "definition.source")))) {
              c = loop73;
              if (
                rt.truth(
                  rt.and(rt.method(rt.invoke(str, c), "startswith", "CQ-"), () =>
                    rt.compare("notin", rt.invoke(str, c), cq_ids)
                  )
                )
              ) {
                rt.method(
                  out,
                  "append",
                  [
                    rt.format(p, -1, null),
                    ": definition.source CQ ",
                    rt.format(c, 114, null),
                    " does not exist in the suite",
                  ].join("")
                );
              }
            }
          }
          for (const loop74 of rt.iter(reviews)) {
            rp = rt.item(loop74, 0);
            rd = rt.item(loop74, 1);
            for (const loop75 of rt.iter(rt.invoke(aslist, rt.get(rd, "evidence")))) {
              e = loop75;
              if (
                rt.truth(
                  rt.and(rt.method(rt.invoke(str, e), "startswith", "CQ-"), () =>
                    rt.compare("notin", rt.invoke(str, e), cq_ids)
                  )
                )
              ) {
                rt.method(
                  out,
                  "append",
                  [
                    rt.format(rp, -1, null),
                    ": evidence CQ ",
                    rt.format(e, 114, null),
                    " does not exist in the suite — a verdict cannot stand on a ghost warrant",
                  ].join("")
                );
              }
            }
          }
          for (const loop76 of rt.iter(dhs)) {
            dp = rt.item(loop76, 0);
            dd = rt.item(loop76, 1);
            for (const loop77 of rt.iter(rt.invoke(aslist, rt.get(dd, "cq_warrants")))) {
              c = loop77;
              if (rt.truth(rt.compare("notin", rt.invoke(str, c), cq_ids))) {
                rt.method(
                  out,
                  "append",
                  [
                    rt.format(dp, -1, null),
                    ": cq_warrants ",
                    rt.format(c, 114, null),
                    " does not exist in the suite",
                  ].join("")
                );
              }
            }
          }
        }
      } catch (caught) {
        if (rt.catches(caught, Exception)) {
          ex = caught;
          rt.method(
            out,
            "append",
            [rt.format(mp, -1, null), ": cannot verify CQ suite (", rt.format(ex, -1, null), ")"].join("")
          );
        } else {
          throw caught;
        }
      }
    }
  }
  return out;
  return null;
});
CHECKS = rt.dict([
  ["so", check_so],
  ["po", check_po],
  ["dh", check_dh],
  ["ic", check_ic],
  ["fa", check_fa],
  ["otp", check_otp],
  ["rat", check_rat],
  ["rej", check_rej],
]);
RECORD_DISPATCH = rt.tuple([
  rt.tuple(["so-", "so"]),
  rt.tuple(["po-", "po"]),
  rt.tuple(["dh-", "dh"]),
  rt.tuple(["ic-", "ic"]),
  rt.tuple(["fa-", "fa"]),
  rt.tuple(["otp-", "otp"]),
  rt.tuple(["rat-", "rat"]),
  rt.tuple(["rej-", "rej"]),
]);
validate_dir = rt.fn("validate_dir", (args, kwargs) => {
  let _: unknown;
  let a: unknown;
  let alt: unknown;
  let alt_fa_by_hyp: unknown;
  let alt_ic_by_hyp: unknown;
  let binding_errs: unknown;
  let cited: unknown;
  let closure_ids: unknown;
  let comp: unknown;
  let d: unknown;
  let declared: unknown;
  let dh: unknown;
  let dh_by_id_all: unknown;
  let e: unknown;
  let ex: unknown;
  let expected: unknown;
  let f: unknown;
  let failed_map: unknown;
  let gate: unknown;
  let h: unknown;
  let ic: unknown;
  let ids_seen: unknown;
  let index: unknown;
  let is_alt: unknown;
  let jk: unknown;
  let k: unknown;
  let key: unknown;
  let kind_key: unknown;
  let kinds: unknown;
  let label: unknown;
  let lex_bad: unknown;
  let lk: unknown;
  let m: unknown;
  let m_: unknown;
  let manifest: unknown;
  let missing: unknown;
  let name: unknown;
  let new_ids: unknown;
  let o: unknown;
  let obs_ids: unknown;
  let obs_paths: unknown;
  let otp_digests: unknown;
  let otp_records: unknown;
  let p: unknown;
  let pdata: unknown;
  let pfx: unknown;
  let pinned: unknown;
  let prefix: unknown;
  let primary: unknown;
  let prior: unknown;
  let prior_rows: unknown;
  let r: unknown;
  let rd: unknown;
  let rel_parts: unknown;
  let repo: unknown;
  let rid: unknown;
  let root: unknown;
  let rp: unknown;
  let seen_hyp: unknown;
  let tgt: unknown;
  let tgt_dh: unknown;
  let tgt_rec: unknown;
  let tup: unknown;
  let unrep_ids: unknown;
  let want12: unknown;
  let x: unknown;
  root = rt.argument(args, kwargs, 0, "root", undefined);
  gate = rt.argument(args, kwargs, 1, "gate", false);
  repo = rt.argument(args, kwargs, 2, "repo", null);
  root = rt.invoke(Path, root);
  if (rt.truth(!rt.truth(rt.method(root, "is_dir")))) {
    rt.invoke(err, root, "scan root does not exist or is not a directory");
    return undefined;
  }
  kinds = rt.dict(
    rt.comprehend(rt.tuple(["so", "po", "dh", "ic", "fa", "otp", "rat", "rej", "review"]), (item: unknown) => {
      let k: unknown;
      k = item;
      return rt.entry(k, []);
    })
  );
  manifest = rt.item(rt.tuple([null, null]), 0);
  index = rt.item(rt.tuple([null, null]), 1);
  ids_seen = rt.dict([]);
  for (const loop78 of rt.iter(rt.invoke(sorted, rt.method(root, "rglob", "*.yaml")))) {
    f = loop78;
    name = rt.attr(f, "name");
    rel_parts = rt.attr(rt.method(f, "relative_to", root), "parts");
    if (
      rt.truth(
        rt.and(rt.compare("eq", rt.item(rel_parts, rt.slice(undefined, 1, undefined)), rt.tuple(["runs"])), () =>
          rt.compare("notin", name, rt.tuple(["run-manifest.yaml", "dispositions.index.yaml"]))
        )
      )
    ) {
      if (
        rt.truth(
          rt.or(rt.method(name, "endswith", ".review.yaml"), () =>
            rt.invoke(
              any,
              rt.comprehend(RECORD_DISPATCH, (item: unknown) => {
                let pfx: unknown;
                let _: unknown;
                pfx = rt.item(item, 0);
                _ = rt.item(item, 1);
                return rt.method(name, "startswith", pfx);
              })
            )
          )
        )
      ) {
        rt.invoke(
          err,
          f,
          "record-prefixed file under runs/ — archived per-run records are NOT live evidence; rotate them to the sibling archive shelter (../archives/<root-name>/), never leave them in the scan root"
        );
      }
      continue;
    }
    try {
      d = rt.or(rt.invoke(yload, rt.method(f, "read_text")), () => rt.dict([]));
    } catch (caught) {
      if (rt.catches(caught, Exception)) {
        ex = caught;
        rt.invoke(err, f, ["unparseable: ", rt.format(ex, -1, null)].join(""));
        continue;
      } else {
        throw caught;
      }
    }
    if (rt.truth(rt.compare("eq", name, "run-manifest.yaml"))) {
      if (rt.truth(rt.compare("ne", rel_parts, rt.tuple(["work", "run-manifest.yaml"])))) {
        rt.invoke(
          err,
          f,
          "run-manifest.yaml is only authoritative at work/run-manifest.yaml — a manifest elsewhere is a shadow"
        );
        continue;
      }
      if (rt.truth(rt.compare("isnot", manifest, null))) {
        rt.invoke(
          err,
          f,
          [
            "SECOND run manifest (first: ",
            rt.format(rt.item(manifest, 0), -1, null),
            ") — the provenance record is a singleton, not a last-wins pile",
          ].join("")
        );
        continue;
      }
      if (rt.truth(rt.invoke(isinstance, d, dict))) {
        manifest = rt.tuple([f, d]);
      }
      rt.invoke(check_manifest, d, f);
    } else {
      if (rt.truth(rt.compare("eq", name, "dispositions.index.yaml"))) {
        if (rt.truth(rt.compare("ne", rel_parts, rt.tuple(["work", "dispositions.index.yaml"])))) {
          rt.invoke(
            err,
            f,
            "dispositions.index.yaml is only authoritative at work/dispositions.index.yaml — an index elsewhere is a shadow"
          );
          continue;
        }
        if (rt.truth(rt.compare("isnot", index, null))) {
          rt.invoke(
            err,
            f,
            ["SECOND dispositions index (first: ", rt.format(rt.item(index, 0), -1, null), ")"].join("")
          );
          continue;
        }
        index = rt.tuple([f, d]);
      } else {
        if (rt.truth(rt.method(name, "endswith", ".review.yaml"))) {
          rt.invoke(check_review, d, f);
          if (rt.truth(rt.invoke(isinstance, d, dict))) {
            m = rt.method(REVIEW_NAME, "match", name);
            if (rt.truth(!rt.truth(m))) {
              rt.invoke(
                err,
                f,
                "review filename must be otp-<slug>-<nnn>[-rN].review.yaml — free-named reviews make rounds and targets untrackable"
              );
            } else {
              tgt = rt.invoke(
                str,
                rt.or(rt.get(d, "target"), () => "")
              );
              expected = rt.truth(rt.compare("eq", rt.method(tgt, "count", ":"), 2))
                ? rt.op(
                    "add",
                    "otp-",
                    rt.method("-", "join", rt.item(rt.method(tgt, "split", ":"), rt.slice(1, undefined, undefined)))
                  )
                : "";
              if (
                rt.truth(
                  rt.and(expected, () =>
                    rt.compare("ne", rt.method(rt.method(m, "group", 1), "lower"), rt.method(expected, "lower"))
                  )
                )
              ) {
                rt.invoke(
                  err,
                  f,
                  [
                    "review filename ",
                    rt.format(rt.method(m, "group", 1), 114, null),
                    " does not correspond to its target ",
                    rt.format(tgt, 114, null),
                    " (expected ",
                    rt.format(expected, 114, null),
                    ") — a review filed under another proposal's name hides its history",
                  ].join("")
                );
              }
            }
            rt.method(rt.item(kinds, "review"), "append", rt.tuple([f, d]));
          }
        } else {
          for (const loop79 of rt.iter(RECORD_DISPATCH)) {
            prefix = rt.item(loop79, 0);
            key = rt.item(loop79, 1);
            if (rt.truth(rt.method(name, "startswith", prefix))) {
              rt.invoke(rt.item(CHECKS, key), d, f);
              if (rt.truth(!rt.truth(rt.invoke(isinstance, d, dict)))) {
                break;
              }
              if (
                rt.truth(
                  rt.and(rt.compare("eq", key, "rat"), () =>
                    rt.compare(
                      "ne",
                      rt.item(rel_parts, rt.slice(undefined, 2, undefined)),
                      rt.tuple(["governance", "ratifications"])
                    )
                  )
                )
              ) {
                rt.invoke(
                  err,
                  f,
                  "ratification records are only authoritative under governance/ratifications/ — an authority-shaped file in a writable location is a forgery surface"
                );
                break;
              }
              for (const loop80 of rt.iter(
                rt.tuple(["id", "hypothesis_ref", "identity_card_ref", "target", "proposal_ref"])
              )) {
                jk = loop80;
                if (
                  rt.truth(
                    rt.and(rt.compare("in", jk, d), () =>
                      rt.and(rt.compare("isnot", rt.get(d, jk), null), () =>
                        rt.compare("isnot", rt.invoke(type, rt.get(d, jk)), str)
                      )
                    )
                  )
                ) {
                  rt.invoke(
                    err,
                    f,
                    [
                      rt.format(jk, -1, null),
                      " ",
                      rt.format(rt.get(d, jk), 114, null),
                      " is not a STRING — quarantined from every join",
                    ].join("")
                  );
                  rt.setItem(d, jk, null);
                }
              }
              for (const loop81 of rt.iter(rt.tuple(["observation_refs", "evidence"]))) {
                lk = loop81;
                if (
                  rt.truth(
                    rt.and(rt.invoke(isinstance, rt.get(d, lk), list), () =>
                      rt.invoke(
                        any,
                        rt.comprehend(rt.get(d, lk), (item: unknown) => {
                          let x: unknown;
                          x = item;
                          return rt.compare("isnot", rt.invoke(type, x), str);
                        })
                      )
                    )
                  )
                ) {
                  rt.invoke(
                    err,
                    f,
                    [rt.format(lk, -1, null), " carries non-STRING entries — quarantined from every join"].join("")
                  );
                  rt.setItem(
                    d,
                    lk,
                    rt.comprehend(rt.get(d, lk), (item: unknown) => {
                      let x: unknown;
                      x = item;
                      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, x), str))) ? x : rt.skip;
                    })
                  );
                }
              }
              rt.method(rt.item(kinds, key), "append", rt.tuple([f, d]));
              rid = rt.get(d, "id");
              if (rt.truth(rt.compare("isnot", rid, null))) {
                if (rt.truth(rt.compare("in", rt.tuple([key, rid]), ids_seen))) {
                  rt.invoke(
                    err,
                    f,
                    [
                      "duplicate id ",
                      rt.format(rid, 114, null),
                      " (also in ",
                      rt.format(rt.item(ids_seen, rt.tuple([key, rid])), -1, null),
                      ")",
                    ].join("")
                  );
                }
                rt.setItem(ids_seen, rt.tuple([key, rid]), rt.invoke(str, f));
              }
              break;
            }
          }
        }
      }
    }
  }
  if (rt.truth(rt.compare("isnot", manifest, null))) {
    declared = rt.invoke(get, rt.item(manifest, 1), "ontology.name");
    if (
      rt.truth(
        rt.and(rt.invoke(isinstance, declared, str), () =>
          rt.and(declared, () => rt.compare("ne", declared, rt.attr(root, "name")))
        )
      )
    ) {
      rt.invoke(
        err,
        rt.item(manifest, 0),
        [
          "ontology.name ",
          rt.format(declared, 114, null),
          " does not match the ontology root directory ",
          rt.format(rt.attr(root, "name"), 114, null),
          " — every documented path derives from this name; an unbound name unbinds them all",
        ].join("")
      );
    }
  }
  if (rt.truth(rt.compare("is", manifest, null))) {
    if (rt.truth(rt.or(rt.invoke(any, rt.method(kinds, "values")), () => rt.compare("isnot", index, null)))) {
      rt.invoke(
        err,
        rt.op("div", root, "work/run-manifest.yaml"),
        "records exist but work/run-manifest.yaml does not — an unpinned run has no provenance and every stage-boundary check is void"
      );
    } else {
      rt.invoke(
        err,
        root,
        "scan found NO records and no manifest — an empty root must never read as a green run (wrong path?)"
      );
    }
  }
  is_alt = rt.fn("is_alt", (args, kwargs) => {
    let p: unknown;
    p = rt.argument(args, kwargs, 0, "p", undefined);
    return rt.compare(
      "eq",
      rt.item(rt.attr(rt.method(p, "relative_to", root), "parts"), rt.slice(undefined, 2, undefined)),
      rt.tuple(["work", "alternative"])
    );
    return null;
  });
  primary = rt.dict(
    rt.comprehend(rt.tuple(["otp", "ic", "fa", "dh"]), (item: unknown) => {
      let k: unknown;
      k = item;
      return rt.entry(
        k,
        rt.comprehend(rt.item(kinds, k), (item: unknown) => {
          let p: unknown;
          let d: unknown;
          p = rt.item(item, 0);
          d = rt.item(item, 1);
          return rt.truth(rt.truth(!rt.truth(rt.invoke(is_alt, p)))) ? rt.tuple([p, d]) : rt.skip;
        })
      );
    })
  );
  alt = rt.dict(
    rt.comprehend(rt.tuple(["ic", "fa"]), (item: unknown) => {
      let k: unknown;
      k = item;
      return rt.entry(
        k,
        rt.comprehend(rt.item(kinds, k), (item: unknown) => {
          let p: unknown;
          let d: unknown;
          p = rt.item(item, 0);
          d = rt.item(item, 1);
          return rt.truth(rt.truth(rt.invoke(is_alt, p))) ? rt.tuple([p, d]) : rt.skip;
        })
      );
    })
  );
  obs_ids = rt.set(
    rt.comprehend(rt.op("add", rt.item(kinds, "so"), rt.item(kinds, "po")), (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str))) ? rt.get(d, "id") : rt.skip;
    })
  );
  unrep_ids = rt.set(
    rt.comprehend(rt.item(kinds, "so"), (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(
        rt.truth(
          rt.and(rt.invoke(so_is_unrepresentable_only, d), () =>
            rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)
          )
        )
      )
        ? rt.get(d, "id")
        : rt.skip;
    })
  );
  otp_records = rt.dict(
    rt.comprehend(rt.item(primary, "otp"), (item: unknown) => {
      let p: unknown;
      let d: unknown;
      p = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), rt.tuple([p, d]))
        : rt.skip;
    })
  );
  for (const loop82 of rt.iter(
    rt.tuple([rt.tuple(["ic", "IdentityCard"]), rt.tuple(["fa", "FoundationalAnalysis"])])
  )) {
    kind_key = rt.item(loop82, 0);
    label = rt.item(loop82, 1);
    seen_hyp = rt.dict([]);
    for (const loop83 of rt.iter(rt.item(primary, kind_key))) {
      p = rt.item(loop83, 0);
      d = rt.item(loop83, 1);
      h = rt.get(d, "hypothesis_ref");
      if (rt.truth(rt.and(rt.compare("isnot", h, null), () => rt.compare("isnot", rt.invoke(type, h), str)))) {
        rt.invoke(
          err,
          p,
          ["hypothesis_ref ", rt.format(h, 114, null), " is not a STRING — quarantined from the seat join"].join("")
        );
        continue;
      }
      if (rt.truth(rt.compare("in", h, seen_hyp))) {
        rt.invoke(
          err,
          p,
          [
            "second primary ",
            rt.format(label, -1, null),
            " for ",
            rt.format(h, 114, null),
            " (first: ",
            rt.format(rt.item(seen_hyp, h), -1, null),
            ") — one analysis per hypothesis; a duplicate is a shadow-ruling injection point",
          ].join("")
        );
      }
      rt.setItem(seen_hyp, h, rt.invoke(str, p));
    }
  }
  if (rt.truth(rt.compare("isnot", manifest, null))) {
    pinned = rt.set(
      rt.comprehend(rt.invoke(aslist, rt.get(rt.item(manifest, 1), "adapters")), (item: unknown) => {
        let a: unknown;
        a = item;
        return rt.truth(rt.truth(rt.invoke(isinstance, a, dict)))
          ? rt.tuple([
              rt.invoke(str, rt.get(a, "id")),
              rt.invoke(str, rt.get(a, "version")),
              rt.invoke(str, rt.get(a, "script")),
            ])
          : rt.skip;
      })
    );
    for (const loop84 of rt.iter(rt.item(kinds, "so"))) {
      p = rt.item(loop84, 0);
      d = rt.item(loop84, 1);
      tup = rt.tuple([
        rt.invoke(str, rt.invoke(get, d, "extractor.id")),
        rt.invoke(str, rt.invoke(get, d, "extractor.version")),
        rt.invoke(str, rt.invoke(get, d, "extractor.script")),
      ]);
      if (rt.truth(rt.and(pinned, () => rt.compare("notin", tup, pinned)))) {
        rt.invoke(
          err,
          p,
          [
            "extractor ",
            rt.format(tup, -1, null),
            " matches no adapter pinned in the manifest — observations from an unrecorded extractor are unpinned evidence",
          ].join("")
        );
      }
    }
  }
  rt.method(
    errors,
    "extend",
    rt.invoke(
      cross_check_chain,
      rt.item(primary, "otp"),
      rt.item(primary, "dh"),
      rt.item(primary, "ic"),
      rt.item(primary, "fa"),
      obs_ids
    )
  );
  if (
    rt.truth(rt.or(rt.item(primary, "otp"), () => rt.or(rt.item(kinds, "rat"), () => rt.compare("isnot", index, null))))
  ) {
    cited = rt.invoke(set);
    for (const loop85 of rt.iter(rt.item(primary, "dh"))) {
      _ = rt.item(loop85, 0);
      dh = rt.item(loop85, 1);
      rt.method(
        cited,
        "update",
        rt.comprehend(rt.invoke(aslist, rt.get(dh, "observation_refs")), (item: unknown) => {
          let x: unknown;
          x = item;
          return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, x), str))) ? x : rt.skip;
        })
      );
    }
    for (const loop86 of rt.iter(
      rt.item(
        rt.invoke(
          sorted,
          rt.comprehend(rt.op("sub", obs_ids, cited), (item: unknown) => {
            let o: unknown;
            o = item;
            return rt.invoke(str, o);
          })
        ),
        rt.slice(undefined, 5, undefined)
      )
    )) {
      missing = loop86;
      rt.invoke(
        err,
        root,
        [
          "observation ",
          rt.format(missing, -1, null),
          " was never cited by any DenotationHypothesis — the denotation stage is mandatory for every observation; rejecting without hypothesizing is the skipped-null-hypothesis hard blocker",
        ].join("")
      );
    }
  }
  binding_errs = rt.item(rt.invoke(cross_check_review_binding, rt.item(kinds, "review"), otp_records), 0);
  otp_digests = rt.item(rt.invoke(cross_check_review_binding, rt.item(kinds, "review"), otp_records), 1);
  failed_map = rt.item(rt.invoke(cross_check_review_binding, rt.item(kinds, "review"), otp_records), 2);
  dh_by_id_all = rt.dict(
    rt.comprehend(rt.item(primary, "dh"), (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  for (const loop87 of rt.iter(rt.item(kinds, "review"))) {
    rp = rt.item(loop87, 0);
    rd = rt.item(loop87, 1);
    tgt_rec = rt.get(otp_records, rt.invoke(str, rt.get(rd, "target")));
    tgt_dh = rt.truth(tgt_rec)
      ? rt.get(dh_by_id_all, rt.invoke(skey, rt.get(rt.item(tgt_rec, 1), "hypothesis_ref")))
      : null;
    closure_ids = rt.truth(tgt_dh)
      ? rt.set(
          rt.comprehend(rt.invoke(aslist, rt.get(tgt_dh, "observation_refs")), (item: unknown) => {
            let x: unknown;
            x = item;
            return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, x), str))) ? x : rt.skip;
          })
        )
      : rt.invoke(set);
    for (const loop88 of rt.iter(rt.invoke(aslist, rt.get(rd, "evidence")))) {
      e = loop88;
      e = rt.invoke(str, e);
      if (rt.truth(rt.method(e, "startswith", rt.tuple(["so:", "po:"])))) {
        if (rt.truth(rt.compare("notin", e, obs_ids))) {
          rt.invoke(
            err,
            rp,
            [
              "evidence ",
              rt.format(rt.item(e, rt.slice(undefined, 24, undefined)), -1, null),
              "… matches no scanned observation — ghost evidence in ANY review manufactures history",
            ].join("")
          );
        } else {
          if (rt.truth(rt.and(closure_ids, () => rt.compare("notin", e, closure_ids)))) {
            rt.invoke(
              err,
              rp,
              [
                "evidence ",
                rt.format(rt.item(e, rt.slice(undefined, 24, undefined)), -1, null),
                "… is outside the target hypothesis's observations",
              ].join("")
            );
          }
        }
      }
    }
  }
  rt.method(errors, "extend", binding_errs);
  rt.method(
    errors,
    "extend",
    rt.invoke(cross_check_support_graph, rt.item(primary, "otp"), rt.item(kinds, "rat"), otp_digests)
  );
  rt.method(errors, "extend", rt.invoke(cross_check_rats, rt.item(kinds, "rat"), rt.item(primary, "otp"), otp_digests));
  rt.method(
    errors,
    "extend",
    rt.call(cross_check_rejections, [rt.item(kinds, "rat"), rt.item(kinds, "rej")], {
      otp_ids: rt.set(
        rt.comprehend(rt.item(kinds, "otp"), (item: unknown) => {
          let _: unknown;
          let d: unknown;
          _ = rt.item(item, 0);
          d = rt.item(item, 1);
          return rt.invoke(str, rt.get(d, "id"));
        })
      ),
    })
  );
  alt_ic_by_hyp = rt.item(rt.tuple([rt.dict([]), rt.dict([])]), 0);
  alt_fa_by_hyp = rt.item(rt.tuple([rt.dict([]), rt.dict([])]), 1);
  for (const loop89 of rt.iter(rt.item(alt, "ic"))) {
    p = rt.item(loop89, 0);
    d = rt.item(loop89, 1);
    h = rt.get(d, "hypothesis_ref");
    if (rt.truth(rt.and(rt.compare("isnot", h, null), () => rt.compare("isnot", rt.invoke(type, h), str)))) {
      rt.invoke(
        err,
        p,
        [
          "alternative hypothesis_ref ",
          rt.format(h, 114, null),
          " is not a STRING — quarantined from the seat join",
        ].join("")
      );
      continue;
    }
    if (rt.truth(rt.compare("in", h, alt_ic_by_hyp))) {
      rt.invoke(
        err,
        p,
        [
          "second alternative IdentityCard for ",
          rt.format(h, 114, null),
          " — one pair per hypothesis; ambiguous seats are no seat",
        ].join("")
      );
    }
    rt.setItem(alt_ic_by_hyp, h, d);
  }
  for (const loop90 of rt.iter(rt.item(alt, "fa"))) {
    p = rt.item(loop90, 0);
    d = rt.item(loop90, 1);
    h = rt.get(d, "hypothesis_ref");
    if (rt.truth(rt.and(rt.compare("isnot", h, null), () => rt.compare("isnot", rt.invoke(type, h), str)))) {
      rt.invoke(
        err,
        p,
        [
          "alternative hypothesis_ref ",
          rt.format(h, 114, null),
          " is not a STRING — quarantined from the seat join",
        ].join("")
      );
      continue;
    }
    if (rt.truth(rt.compare("in", h, alt_fa_by_hyp))) {
      rt.invoke(err, p, ["second alternative FoundationalAnalysis for ", rt.format(h, 114, null)].join(""));
    }
    rt.setItem(alt_fa_by_hyp, h, d);
    ic = rt.get(alt_ic_by_hyp, h);
    if (
      rt.truth(
        rt.and(rt.compare("isnot", ic, null), () => rt.compare("ne", rt.get(d, "identity_card_ref"), rt.get(ic, "id")))
      )
    ) {
      rt.invoke(err, p, "alternative FA does not join its own seat's IdentityCard");
    }
  }
  prior_rows = null;
  if (
    rt.truth(rt.and(rt.compare("isnot", manifest, null), () => rt.invoke(get, rt.item(manifest, 1), "prior_index")))
  ) {
    lex_bad = rt.invoke(lexical_symlink_violations, root, rt.invoke(get, rt.item(manifest, 1), "prior_index"));
    for (const loop91 of rt.iter(lex_bad)) {
      comp = loop91;
      rt.invoke(
        err,
        rt.item(manifest, 0),
        [
          "prior_index component ",
          rt.format(comp, 114, null),
          " is a SYMLINK at its lexical path — an aliased predecessor (or an archive reached through an aliased directory) is not an archived one (resolve() must never run before this check)",
        ].join("")
      );
    }
    prior = rt.truth(lex_bad)
      ? null
      : rt.invoke(
          safe_join,
          root,
          rt.invoke(get, rt.item(manifest, 1), "prior_index"),
          rt.item(manifest, 0),
          "prior_index"
        );
    if (rt.truth(rt.compare("isnot", prior, null))) {
      if (rt.truth(rt.method(prior, "is_symlink"))) {
        rt.invoke(
          err,
          rt.item(manifest, 0),
          [
            "prior_index ",
            rt.format(prior, -1, null),
            " is a SYMLINK — an aliased predecessor is not an archived one",
          ].join("")
        );
        prior = null;
      }
    }
    if (rt.truth(rt.compare("isnot", prior, null))) {
      try {
        pdata = rt.method(prior, "read_bytes");
        want12 = rt.invoke(
          str,
          rt.or(rt.invoke(get, rt.item(manifest, 1), "prior_index_sha256_12"), () => "")
        );
        if (rt.truth(rt.and(want12, () => rt.compare("ne", rt.invoke(sha12, pdata), want12)))) {
          rt.invoke(
            err,
            rt.item(manifest, 0),
            "prior_index bytes do not match prior_index_sha256_12 — carried authority from a mutated prior index is forged authority"
          );
        }
        prior_rows = rt.invoke(yload, pdata);
        if (rt.truth(!rt.truth(rt.invoke(isinstance, prior_rows, list)))) {
          rt.invoke(err, rt.item(manifest, 0), "prior_index root must be a LIST of rows");
          prior_rows = [];
        }
        for (const loop92 of rt.iter(rt.invoke(check_prior_rows, prior_rows, rt.item(manifest, 0)))) {
          m_ = loop92;
          rt.invoke(err, rt.item(manifest, 0), m_);
        }
      } catch (caught) {
        if (rt.catches(caught, Exception)) {
          ex = caught;
          rt.invoke(err, rt.item(manifest, 0), ["prior_index unreadable: ", rt.format(ex, -1, null)].join(""));
          prior_rows = [];
        } else {
          throw caught;
        }
      }
      new_ids = rt.set(
        rt.comprehend(rt.invoke(aslist, rt.truth(index) ? rt.item(index, 1) : []), (item: unknown) => {
          let r: unknown;
          r = item;
          return rt.truth(
            rt.truth(
              rt.and(rt.invoke(isinstance, r, dict), () =>
                rt.compare("is", rt.invoke(type, rt.get(r, "observation")), str)
              )
            )
          )
            ? rt.get(r, "observation")
            : rt.skip;
        })
      );
      for (const loop93 of rt.iter(prior_rows)) {
        r = loop93;
        if (
          rt.truth(
            rt.and(rt.invoke(isinstance, r, dict), () =>
              rt.and(rt.compare("eq", rt.get(r, "outcome"), "unresolved"), () =>
                rt.and(rt.compare("is", rt.invoke(type, rt.get(r, "observation")), str), () =>
                  rt.compare("notin", rt.get(r, "observation"), new_ids)
                )
              )
            )
          )
        ) {
          rt.invoke(
            err,
            rt.item(manifest, 0),
            [
              "prior unresolved observation ",
              rt.format(rt.get(r, "observation"), -1, null),
              " has NO row in this run's index",
            ].join("")
          );
        }
      }
    }
  }
  if (rt.truth(rt.or(obs_ids, () => rt.compare("isnot", index, null)))) {
    if (rt.truth(rt.compare("is", index, null))) {
      if (rt.truth(rt.or(gate, () => rt.item(primary, "otp")))) {
        rt.invoke(err, rt.op("div", root, "work/dispositions.index.yaml"), "dispositions.index.yaml missing");
      }
    } else {
      rt.method(
        errors,
        "extend",
        rt.invoke(
          cross_check_index,
          rt.item(index, 1),
          rt.item(index, 0),
          obs_ids,
          rt.item(primary, "otp"),
          rt.item(primary, "dh"),
          unrep_ids,
          prior_rows
        )
      );
    }
  } else {
    if (
      rt.truth(
        rt.and(rt.compare("isnot", manifest, null), () =>
          rt.compare(
            "lt",
            rt.invoke(
              len,
              rt.method(
                rt.invoke(
                  str,
                  rt.or(rt.invoke(get, rt.item(manifest, 1), "empty_corpus_reason"), () => "")
                ),
                "strip"
              )
            ),
            20
          )
        )
      )
    ) {
      rt.invoke(err, rt.item(manifest, 0), "run produced ZERO observations without a substantive empty_corpus_reason");
    }
  }
  if (rt.truth(rt.compare("isnot", repo, null))) {
    rt.method(
      errors,
      "extend",
      rt.invoke(
        repo_fidelity,
        rt.item(kinds, "so"),
        rt.item(kinds, "po"),
        manifest,
        rt.item(primary, "otp"),
        rt.item(kinds, "review"),
        rt.item(primary, "dh"),
        rt.invoke(Path, repo)
      )
    );
  }
  if (rt.truth(gate)) {
    obs_paths = rt.dict(
      rt.comprehend(rt.op("add", rt.item(kinds, "so"), rt.item(kinds, "po")), (item: unknown) => {
        let p: unknown;
        let d: unknown;
        p = rt.item(item, 0);
        d = rt.item(item, 1);
        return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
          ? rt.entry(rt.get(d, "id"), p)
          : rt.skip;
      })
    );
    rt.call(
      run_gate,
      [root, kinds, primary, alt_ic_by_hyp, alt_fa_by_hyp, index, manifest, otp_digests, obs_paths, failed_map],
      {
        repo_supplied: rt.compare("isnot", repo, null),
      }
    );
  }
  return null;
});
norm_cat = rt.fn("norm_cat", (args, kwargs) => {
  let v: unknown;
  v = rt.argument(args, kwargs, 0, "v", undefined);
  return rt.or(
    rt.item(
      rt.method(
        rt.method(
          rt.invoke(
            str,
            rt.or(v, () => "")
          ),
          "lower"
        ),
        "split",
        ":"
      ),
      rt.neg(1)
    ),
    () => null
  );
  return null;
});
run_gate = rt.fn("run_gate", (args, kwargs) => {
  let _: unknown;
  let a: unknown;
  let alt_fa_by_hyp: unknown;
  let alt_ic_by_hyp: unknown;
  let ca: unknown;
  let carries: unknown;
  let cat: unknown;
  let cb: unknown;
  let cf: unknown;
  let chain_files: unknown;
  let closure_ids: unknown;
  let current: unknown;
  let d: unknown;
  let data: unknown;
  let dd: unknown;
  let dh_paths: unknown;
  let dh_rec: unknown;
  let dh_rec_cite: unknown;
  let e: unknown;
  let ex: unknown;
  let fa: unknown;
  let fa_by_icr: unknown;
  let fa_paths_by_icr: unknown;
  let failed_map: unknown;
  let fd: unknown;
  let field: unknown;
  let frac: unknown;
  let h: unknown;
  let hyp: unknown;
  let ic: unknown;
  let ic_by_id: unknown;
  let ic_cat: unknown;
  let ic_key: unknown;
  let ic_paths: unknown;
  let index: unknown;
  let iv: unknown;
  let kinds: unknown;
  let logged: unknown;
  let manifest: unknown;
  let n_indet: unknown;
  let nonirr: unknown;
  let obs_paths: unknown;
  let oid: unknown;
  let oid_claim: unknown;
  let op: unknown;
  let otp_cat: unknown;
  let otp_digests: unknown;
  let ov: unknown;
  let p: unknown;
  let prim_ic_by_hyp: unknown;
  let primary: unknown;
  let r: unknown;
  let ref: unknown;
  let repo_supplied: unknown;
  let rev: unknown;
  let rig: unknown;
  let root: unknown;
  let rows: unknown;
  let s: unknown;
  let supplies: unknown;
  let unanswered: unknown;
  let unlogged: unknown;
  let unres: unknown;
  let verdicts: unknown;
  let w: unknown;
  let want: unknown;
  let x: unknown;
  root = rt.argument(args, kwargs, 0, "root", undefined);
  kinds = rt.argument(args, kwargs, 1, "kinds", undefined);
  primary = rt.argument(args, kwargs, 2, "primary", undefined);
  alt_ic_by_hyp = rt.argument(args, kwargs, 3, "alt_ic_by_hyp", undefined);
  alt_fa_by_hyp = rt.argument(args, kwargs, 4, "alt_fa_by_hyp", undefined);
  index = rt.argument(args, kwargs, 5, "index", undefined);
  manifest = rt.argument(args, kwargs, 6, "manifest", undefined);
  otp_digests = rt.argument(args, kwargs, 7, "otp_digests", undefined);
  obs_paths = rt.argument(args, kwargs, 8, "obs_paths", undefined);
  failed_map = rt.argument(args, kwargs, 9, "failed_map", undefined);
  repo_supplied = rt.argument(args, kwargs, 10, "repo_supplied", undefined);
  if (rt.truth(rt.compare("is", manifest, null))) {
    rt.invoke(err, root, "GATE: no run-manifest.yaml in scan");
  }
  if (
    rt.truth(
      rt.and(manifest, () => rt.compare("is", rt.invoke(get, rt.item(manifest, 1), "repository.pin_waived"), true))
    )
  ) {
    rt.method(
      flags,
      "append",
      rt.op(
        "add",
        [
          rt.format(root, -1, null),
          ": PIN WAIVED: ",
          rt.format(rt.invoke(get, rt.item(manifest, 1), "repository.waiver_reason"), 114, null),
        ].join(""),
        rt.truth(repo_supplied) ? "" : " — fidelity NOT verified (no --repo)"
      )
    );
  }
  if (rt.truth(rt.and(manifest, () => rt.invoke(get, rt.item(manifest, 1), "empty_corpus_reason")))) {
    rt.method(
      flags,
      "append",
      [
        rt.format(root, -1, null),
        ": EMPTY CORPUS declared: ",
        rt.format(rt.invoke(get, rt.item(manifest, 1), "empty_corpus_reason"), 114, null),
      ].join("")
    );
  }
  if (
    rt.truth(
      rt.and(
        !rt.truth(repo_supplied),
        () =>
          !rt.truth(
            rt.and(manifest, () =>
              rt.compare("is", rt.invoke(get, rt.item(manifest, 1), "repository.pin_waived"), true)
            )
          )
      )
    )
  ) {
    rt.invoke(
      err,
      root,
      "GATE: --repo is required at submission (an explicit boolean pin waiver with reason is the only exemption, and it is flagged)"
    );
  }
  current = rt.invoke(latest_reviews, rt.item(kinds, "review"));
  prim_ic_by_hyp = rt.dict(
    rt.comprehend(rt.item(primary, "ic"), (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "hypothesis_ref")), str)))
        ? rt.entry(rt.get(d, "hypothesis_ref"), d)
        : rt.skip;
    })
  );
  ic_by_id = rt.dict(
    rt.comprehend(rt.item(primary, "ic"), (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), d)
        : rt.skip;
    })
  );
  ic_paths = rt.dict(
    rt.comprehend(rt.item(primary, "ic"), (item: unknown) => {
      let p: unknown;
      let d: unknown;
      p = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), p)
        : rt.skip;
    })
  );
  dh_paths = rt.dict(
    rt.comprehend(rt.item(primary, "dh"), (item: unknown) => {
      let p: unknown;
      let d: unknown;
      p = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str)))
        ? rt.entry(rt.get(d, "id"), p)
        : rt.skip;
    })
  );
  fa_by_icr = rt.dict(
    rt.comprehend(rt.item(primary, "fa"), (item: unknown) => {
      let _: unknown;
      let d: unknown;
      _ = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "identity_card_ref")), str)))
        ? rt.entry(rt.get(d, "identity_card_ref"), d)
        : rt.skip;
    })
  );
  fa_paths_by_icr = rt.dict(
    rt.comprehend(rt.item(primary, "fa"), (item: unknown) => {
      let p: unknown;
      let d: unknown;
      p = rt.item(item, 0);
      d = rt.item(item, 1);
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "identity_card_ref")), str)))
        ? rt.entry(rt.get(d, "identity_card_ref"), p)
        : rt.skip;
    })
  );
  verdicts = [];
  for (const loop94 of rt.iter(rt.item(primary, "otp"))) {
    p = rt.item(loop94, 0);
    d = rt.item(loop94, 1);
    oid = rt.item(rt.tuple([rt.invoke(str, rt.get(d, "id")), rt.get(d, "hypothesis_ref")]), 0);
    hyp = rt.item(rt.tuple([rt.invoke(str, rt.get(d, "id")), rt.get(d, "hypothesis_ref")]), 1);
    rev = rt.get(current, oid);
    if (rt.truth(rt.compare("is", rev, null))) {
      rt.invoke(err, p, "GATE: no adversary review disposition targets this proposal");
    } else {
      if (rt.truth(rt.compare("ne", rt.get(rt.item(rev, 1), "target_sha256"), rt.get(otp_digests, oid)))) {
        rt.invoke(
          err,
          p,
          [
            "GATE: latest review ",
            rt.format(rt.item(rev, 0), -1, null),
            " is bound to DIFFERENT proposal bytes — re-review",
          ].join("")
        );
      }
      chain_files = [p];
      for (const loop95 of rt.iter(
        rt.tuple([
          rt.get(ic_paths, rt.invoke(skey, rt.get(d, "identity_card_ref"))),
          rt.get(dh_paths, rt.invoke(skey, hyp)),
          rt.get(fa_paths_by_icr, rt.invoke(skey, rt.get(d, "identity_card_ref"))),
        ])
      )) {
        x = loop95;
        if (rt.truth(x)) {
          rt.method(chain_files, "append", x);
        }
      }
      dh_rec = rt.invoke(
        next,
        rt.comprehend(rt.item(primary, "dh"), (item: unknown) => {
          let _: unknown;
          let dd: unknown;
          _ = rt.item(item, 0);
          dd = rt.item(item, 1);
          return rt.truth(rt.truth(rt.compare("eq", rt.get(dd, "id"), hyp))) ? dd : rt.skip;
        }),
        rt.dict([])
      );
      for (const loop96 of rt.iter(rt.invoke(aslist, rt.get(dh_rec, "observation_refs")))) {
        ref = loop96;
        op = rt.get(obs_paths, rt.invoke(skey, ref));
        if (rt.truth(op)) {
          rt.method(chain_files, "append", op);
        }
      }
      h = rt.method(hashlib, "sha256");
      for (const loop97 of rt.iter(
        rt.call(sorted, [chain_files], {
          key: rt.fn("lambda", (args, kwargs) => {
            let x: unknown;
            x = rt.argument(args, kwargs, 0, "x", undefined);
            return rt.attr(rt.invoke(Path, x), "name");
            return null;
          }),
        })
      )) {
        cf = loop97;
        try {
          data = rt.method(rt.invoke(Path, cf), "read_bytes");
          rt.method(
            h,
            "update",
            rt.method(
              [
                rt.format(rt.attr(rt.invoke(Path, cf), "name"), -1, null),
                "\n",
                rt.format(rt.invoke(len, data), -1, null),
                "\n",
              ].join(""),
              "encode"
            )
          );
          rt.method(h, "update", data);
        } catch (caught) {
          if (rt.catches(caught, Exception)) {
            ex = caught;
            rt.invoke(
              err,
              p,
              [
                "GATE: closure member ",
                rt.format(rt.attr(rt.invoke(Path, cf), "name"), 114, null),
                " cannot be read (",
                rt.format(ex, -1, null),
                ") — a review digest over a TRUNCATED closure binds nothing; submission refused",
              ].join("")
            );
          } else {
            throw caught;
          }
        }
      }
      rt.method(
        h,
        "update",
        rt.method(
          [
            "cq:",
            rt.format(rt.truth(manifest) ? rt.invoke(get, rt.item(manifest, 1), "cq_suite.sha256_12") : "", -1, null),
            "\n",
          ].join(""),
          "encode"
        )
      );
      if (rt.truth(rt.compare("ne", rt.get(rt.item(rev, 1), "chain_sha256"), rt.method(h, "hexdigest")))) {
        rt.invoke(
          err,
          p,
          [
            "GATE: latest review ",
            rt.format(rt.item(rev, 0), -1, null),
            " chain_sha256 does not match the current FULL closure (OTP+IC+FA+DH + every cited SO/PO record + the CQ-suite digest) — something the review stands on changed after review; re-review the revised closure",
          ].join("")
        );
      }
      rt.method(verdicts, "append", rt.get(rt.item(rev, 1), "verdict"));
      if (rt.truth(rt.compare("eq", rt.get(rt.item(rev, 1), "verdict"), "FAIL"))) {
        rt.invoke(err, p, ["GATE: BLOCKED by ", rt.format(rt.item(rev, 0), -1, null), " (FAIL)"].join(""));
      } else {
        unlogged = rt.get(rt.get(failed_map, "prior", rt.dict([])), oid, rt.invoke(set));
        logged = rt.dict([]);
        for (const loop98 of rt.iter(rt.invoke(aslist, rt.get(d, "revision_log")))) {
          e = loop98;
          if (rt.truth(rt.invoke(isinstance, e, dict))) {
            rt.method(
              rt.method(logged, "setdefault", rt.invoke(str, rt.get(e, "from_sha256")), rt.invoke(set)),
              "update",
              rt.comprehend(rt.invoke(aslist, rt.get(e, "addressed")), (item: unknown) => {
                let a: unknown;
                a = item;
                return rt.truth(rt.truth(rt.invoke(isinstance, a, str))) ? rt.invoke(str, a) : rt.skip;
              })
            );
          }
        }
        for (const loop99 of rt.iter(unlogged)) {
          fd = loop99;
          if (rt.truth(rt.compare("notin", fd, logged))) {
            rt.invoke(
              err,
              p,
              [
                "GATE: a FAIL was judged at digest ",
                rt.format(rt.item(fd, rt.slice(undefined, 12, undefined)), -1, null),
                "… and the proposal's revision_log does not cover it — a FAIL is retired only by changed bytes WITH revision_log coverage; an abstention or byte tweak alone does not retire it",
              ].join("")
            );
          } else {
            unanswered = rt.op(
              "sub",
              rt.get(rt.get(failed_map, "rules", rt.dict([])), rt.tuple([oid, fd]), rt.invoke(set)),
              rt.item(logged, fd)
            );
            if (rt.truth(unanswered)) {
              rt.invoke(
                err,
                p,
                [
                  "GATE: revision_log for failed digest ",
                  rt.format(rt.item(fd, rt.slice(undefined, 12, undefined)), -1, null),
                  "… does not address the landed attack rule(s) ",
                  rt.format(rt.invoke(sorted, unanswered), -1, null),
                  " — naming the digest while answering none of its attacks is a guestbook signature, whatever the verdict that follows",
                ].join("")
              );
            }
          }
        }
        if (rt.truth(rt.compare("eq", rt.get(rt.item(rev, 1), "verdict"), "INDETERMINATE"))) {
          rt.method(
            flags,
            "append",
            [
              rt.format(p, -1, null),
              ": submits FLAGGED (INDETERMINATE): ",
              rt.format(rt.get(rt.item(rev, 1), "needed_evidence"), -1, null),
            ].join("")
          );
        }
      }
      if (
        rt.truth(
          rt.and(rt.invoke(aslist, rt.get(d, "parents")), () =>
            rt.compare("ne", rt.invoke(get, rt.item(rev, 1), "surfaces.taxonomy"), "attacked")
          )
        )
      ) {
        rt.invoke(
          err,
          p,
          "GATE: the proposal asserts parent edges but the review left taxonomy unattacked — no_surface is a lie when parents exist"
        );
      }
      if (rt.truth(rt.get(rt.item(rev, 1), "rival_models_still_viable"))) {
        rt.method(
          flags,
          "append",
          [rt.format(p, -1, null), ": DISPUTED — the review lists still-viable rivals"].join("")
        );
      }
    }
    dh_rec_cite = rt.invoke(
      next,
      rt.comprehend(rt.item(primary, "dh"), (item: unknown) => {
        let _: unknown;
        let dd: unknown;
        _ = rt.item(item, 0);
        dd = rt.item(item, 1);
        return rt.truth(rt.truth(rt.compare("eq", rt.get(dd, "id"), hyp))) ? dd : rt.skip;
      }),
      rt.dict([])
    );
    closure_ids = rt.set(
      rt.comprehend(rt.invoke(aslist, rt.get(dh_rec_cite, "observation_refs")), (item: unknown) => {
        let x: unknown;
        x = item;
        return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, x), str))) ? x : rt.skip;
      })
    );
    if (rt.truth(rt.compare("isnot", rev, null))) {
      for (const loop100 of rt.iter(rt.invoke(aslist, rt.get(rt.item(rev, 1), "evidence")))) {
        e = loop100;
        e = rt.invoke(str, e);
        if (
          rt.truth(
            rt.and(rt.method(e, "startswith", rt.tuple(["so:", "po:"])), () => rt.compare("notin", e, closure_ids))
          )
        ) {
          rt.invoke(
            err,
            p,
            [
              "GATE: review evidence ",
              rt.format(rt.item(e, rt.slice(undefined, 24, undefined)), -1, null),
              "… is not among the target hypothesis's observations — evidence outside the reviewed closure is unbound by its digest and cannot ground this verdict",
            ].join("")
          );
        }
      }
    }
    for (const loop101 of rt.iter(rt.invoke(aslist, rt.invoke(get, d, "definition.source")))) {
      s = loop101;
      s = rt.invoke(str, s);
      if (
        rt.truth(
          rt.and(rt.method(s, "startswith", rt.tuple(["so:", "po:"])), () => rt.compare("notin", s, closure_ids))
        )
      ) {
        rt.invoke(
          err,
          p,
          [
            "GATE: definition.source ",
            rt.format(rt.item(s, rt.slice(undefined, 24, undefined)), -1, null),
            "… is not among the proposal's own hypothesis observations",
          ].join("")
        );
      } else {
        if (rt.truth(!rt.truth(rt.method(s, "startswith", rt.tuple(["so:", "po:", "CQ-"]))))) {
          rt.invoke(
            err,
            p,
            ["GATE: definition.source entry ", rt.format(s, 114, null), " is not an observation/CQ id"].join("")
          );
        }
      }
    }
    if (rt.truth(rt.or(rt.compare("notin", hyp, alt_ic_by_hyp), () => rt.compare("notin", hyp, alt_fa_by_hyp)))) {
      rt.invoke(err, p, "GATE: blinded alternative seat must cover this hypothesis with BOTH an ic- and an fa- record");
    } else {
      if (rt.truth(rt.invoke(fa_ran_no_tests, rt.item(alt_fa_by_hyp, hyp)))) {
        rt.invoke(
          err,
          p,
          "GATE: the alternative seat's analysis ran NO tests (all unresolved) — a vacuous second opinion is no coverage"
        );
      }
      ca = rt.invoke(
        norm_cat,
        rt.invoke(get, rt.get(alt_ic_by_hyp, hyp, rt.dict([])), "ufo_analysis.candidate_category")
      );
      cb = rt.invoke(
        norm_cat,
        rt.invoke(
          get,
          rt.or(rt.get(prim_ic_by_hyp, rt.invoke(skey, hyp)), () => rt.dict([])),
          "ufo_analysis.candidate_category"
        )
      );
      if (rt.truth(rt.and(ca, () => rt.and(cb, () => rt.compare("ne", ca, cb))))) {
        rt.method(
          flags,
          "append",
          [
            rt.format(p, -1, null),
            ": DISPUTED — alternative seat says ",
            rt.format(ca, 114, null),
            ", primary says ",
            rt.format(cb, 114, null),
            "; steward chooses",
          ].join("")
        );
      }
    }
    ic = rt.or(rt.get(ic_by_id, rt.get(d, "identity_card_ref")), () => rt.dict([]));
    ic_cat = rt.invoke(norm_cat, rt.invoke(get, ic, "ufo_analysis.candidate_category"));
    otp_cat = rt.invoke(norm_cat, rt.invoke(get, d, "foundational.ufo_category"));
    if (rt.truth(rt.and(otp_cat, () => rt.and(ic_cat, () => rt.compare("ne", otp_cat, ic_cat))))) {
      rt.invoke(
        err,
        p,
        [
          "GATE: the proposal claims category ",
          rt.format(otp_cat, 114, null),
          " but its identity card rules ",
          rt.format(ic_cat, 114, null),
          " — a proposal may not out-claim its analysis",
        ].join("")
      );
    }
    for (const loop102 of rt.iter(
      rt.tuple([rt.tuple(["rigidity", "ontoclean.rigidity"]), rt.tuple(["dependence", "ontoclean.dependence"])])
    )) {
      field = rt.item(loop102, 0);
      ic_key = rt.item(loop102, 1);
      ov = rt.item(
        rt.tuple([rt.invoke(get, d, ["ontoclean.", rt.format(field, -1, null)].join("")), rt.invoke(get, ic, ic_key)]),
        0
      );
      iv = rt.item(
        rt.tuple([rt.invoke(get, d, ["ontoclean.", rt.format(field, -1, null)].join("")), rt.invoke(get, ic, ic_key)]),
        1
      );
      if (rt.truth(rt.and(ov, () => rt.and(iv, () => rt.compare("ne", rt.invoke(str, ov), rt.invoke(str, iv)))))) {
        rt.invoke(
          err,
          p,
          [
            "GATE: the proposal's ontoclean.",
            rt.format(field, -1, null),
            " ",
            rt.format(ov, 114, null),
            " contradicts its identity card's ",
            rt.format(iv, 114, null),
            " — the proposal DERIVES these fields from its analysis; it may not re-decide them",
          ].join("")
        );
      }
    }
    oid_claim = rt.invoke(get, d, "ontoclean.identity");
    supplies = rt.invoke(get, ic, "identity.supplies_identity");
    carries = rt.invoke(get, ic, "ontoclean.carries_identity");
    want = rt.invoke(identity_expectation, supplies, carries);
    if (
      rt.truth(
        rt.and(rt.compare("isnot", want, null), () =>
          rt.and(rt.compare("in", oid_claim, rt.tuple(["supplies", "carries", "none", "unresolved"])), () =>
            rt.compare("ne", oid_claim, want)
          )
        )
      )
    ) {
      rt.invoke(
        err,
        p,
        [
          "GATE: the identity card rules ",
          rt.format(want, 114, null),
          " but the proposal's ontoclean.identity claims ",
          rt.format(oid_claim, 114, null),
          " — the proposal derives this field; it may not re-decide it",
        ].join("")
      );
    }
    cat = rt.or(otp_cat, () => ic_cat);
    rig = rt.invoke(get, ic, "ontoclean.rigidity");
    if (rt.truth(rt.compare("in", cat, rt.tuple(["kind", "subkind"])))) {
      if (rt.truth(rt.compare("ne", rig, "rigid"))) {
        rt.invoke(
          err,
          p,
          [
            "GATE: OntoClean BLOCK — ",
            rt.format(cat, -1, null),
            " requires rigidity: rigid (got ",
            rt.format(rig, 114, null),
            ")",
          ].join("")
        );
      }
      if (
        rt.truth(
          rt.and(
            rt.compare("eq", cat, "kind"),
            () =>
              !rt.truth(
                rt.and(rt.compare("is", rt.invoke(get, ic, "identity.supplies_identity"), true), () =>
                  rt.compare("is", rt.invoke(get, ic, "ontoclean.supplies_identity"), true)
                )
              )
          )
        )
      ) {
        rt.invoke(err, p, "GATE: OntoClean BLOCK — a kind must SUPPLY identity, and BOTH provider fields must say so");
      }
      if (
        rt.truth(
          rt.and(rt.compare("eq", cat, "subkind"), () =>
            rt.compare("isnot", rt.invoke(get, ic, "ontoclean.carries_identity"), true)
          )
        )
      ) {
        rt.invoke(err, p, "GATE: OntoClean BLOCK — a subkind must CARRY (inherit) identity; it need not supply it");
      }
    } else {
      if (rt.truth(rt.compare("eq", cat, "role"))) {
        if (rt.truth(rt.compare("ne", rt.invoke(get, ic, "ontoclean.dependence"), "relational"))) {
          rt.invoke(
            err,
            p,
            "GATE: OntoClean BLOCK — a role is relationally dependent by definition; dependence must be relational"
          );
        }
        if (rt.truth(rt.compare("ne", rig, "anti_rigid"))) {
          rt.invoke(
            err,
            p,
            "GATE: OntoClean BLOCK — a role is anti-rigid by definition (a rigid role is a kind wearing a costume)"
          );
        }
      } else {
        if (rt.truth(rt.and(rt.compare("eq", cat, "phase"), () => rt.compare("ne", rig, "anti_rigid")))) {
          rt.invoke(err, p, "GATE: OntoClean BLOCK — a phase is anti-rigid by definition");
        }
      }
    }
    if (rt.truth(rt.compare("eq", rt.get(d, "foundational_status"), "explicitly_deferred"))) {
      fa = rt.or(rt.get(fa_by_icr, rt.invoke(skey, rt.get(d, "identity_card_ref"))), () => rt.dict([]));
      rt.method(
        flags,
        "append",
        [
          rt.format(p, -1, null),
          ": submits FLAGGED (explicitly_deferred): ",
          rt.format(rt.get(fa, "needed_evidence", "needed_evidence MISSING"), -1, null),
        ].join("")
      );
    }
  }
  n_indet = rt.method(verdicts, "count", "INDETERMINATE");
  if (
    rt.truth(
      rt.and(rt.compare("ge", n_indet, 2), () => rt.compare("ge", rt.op("div", n_indet, rt.invoke(len, verdicts)), 0.5))
    )
  ) {
    rt.invoke(
      err,
      root,
      [
        "GATE: ",
        rt.format(n_indet, -1, null),
        "/",
        rt.format(rt.invoke(len, verdicts), -1, null),
        " verdicts are INDETERMINATE — verdict-flooding (two or more abstentions covering half the proposals is a disengaged adversary; a SINGLE substantive abstention always submits FLAGGED as documented)",
      ].join("")
    );
  }
  if (rt.truth(rt.and(rt.compare("isnot", index, null), () => rt.invoke(isinstance, rt.item(index, 1), list)))) {
    rows = rt.comprehend(rt.item(index, 1), (item: unknown) => {
      let r: unknown;
      r = item;
      return rt.truth(
        rt.truth(
          rt.and(
            rt.invoke(isinstance, r, dict),
            () =>
              !rt.truth(
                rt.and(rt.compare("is", rt.invoke(type, rt.get(r, "carried_from_prior")), bool), () =>
                  rt.get(r, "carried_from_prior")
                )
              )
          )
        )
      )
        ? r
        : rt.skip;
    });
    nonirr = rt.comprehend(rows, (item: unknown) => {
      let r: unknown;
      r = item;
      return rt.truth(rt.truth(rt.compare("ne", rt.get(r, "outcome"), "irrelevant"))) ? r : rt.skip;
    });
    unres = rt.comprehend(nonirr, (item: unknown) => {
      let r: unknown;
      r = item;
      return rt.truth(rt.truth(rt.compare("eq", rt.get(r, "outcome"), "unresolved"))) ? r : rt.skip;
    });
    if (rt.truth(nonirr)) {
      frac = rt.op("div", rt.invoke(len, unres), rt.invoke(len, nonirr));
      rt.invoke(
        print,
        [
          "GATE: unresolved fraction ",
          rt.format(rt.invoke(len, unres), -1, null),
          "/",
          rt.format(rt.invoke(len, nonirr), -1, null),
          " = ",
          rt.format(frac, -1, [".0%"].join("")),
          " (carried rows excluded from arithmetic)",
        ].join("")
      );
      w = rt.truth(manifest) ? rt.invoke(get, rt.item(manifest, 1), "unresolved_fraction_waiver") : null;
      if (rt.truth(rt.compare("gt", frac, 0.5))) {
        if (rt.truth(w)) {
          rt.method(
            flags,
            "append",
            [
              rt.format(rt.item(index, 0), -1, null),
              ": unresolved ",
              rt.format(frac, -1, [".0%"].join("")),
              " WAIVED: ",
              rt.format(w, 114, null),
            ].join("")
          );
        } else {
          rt.invoke(
            err,
            rt.item(index, 0),
            [
              "GATE: ",
              rt.format(frac, -1, [".0%"].join("")),
              " of non-irrelevant observations are unresolved — a parked run",
            ].join("")
          );
        }
      } else {
        if (rt.truth(w)) {
          rt.method(
            flags,
            "append",
            [
              rt.format(rt.item(index, 0), -1, null),
              ": unresolved_fraction_waiver DECLARED but not invoked (fraction ",
              rt.format(frac, -1, [".0%"].join("")),
              "): ",
              rt.format(rt.invoke(safe_text, rt.invoke(str, w)), 114, null),
            ].join("")
          );
        }
      }
    }
  }
  if (rt.truth(rt.item(kinds, "rat"))) {
    rt.invoke(print, "GATE: RATIFICATION SUMMARY (verify each is the steward's own words):");
    for (const loop103 of rt.iter(rt.item(kinds, "rat"))) {
      p = rt.item(loop103, 0);
      d = rt.item(loop103, 1);
      rt.invoke(
        print,
        [
          "  ",
          rt.format(rt.invoke(safe_text, rt.invoke(str, rt.get(d, "proposal_ref"))), -1, null),
          ": ",
          rt.format(rt.invoke(safe_text, rt.invoke(str, rt.get(d, "decision"))), -1, null),
          " by ",
          rt.format(rt.invoke(safe_text, rt.invoke(str, rt.invoke(get, d, "steward.id"))), -1, null),
          ' — "',
          rt.format(rt.invoke(safe_text, rt.invoke(str, rt.get(d, "verbatim_decision"))), -1, null),
          '"',
        ].join("")
      );
    }
  }
  return null;
});
expect_err = rt.fn("expect_err", (args, kwargs) => {
  let fn: unknown;
  let label: unknown;
  let n: unknown;
  label = rt.argument(args, kwargs, 0, "label", undefined);
  fn = rt.argument(args, kwargs, 1, "fn", undefined);
  n = rt.invoke(len, errors);
  rt.invoke(fn, ...rt.iter(args));
  rt.assert(
    rt.compare("gt", rt.invoke(len, errors), n),
    [rt.format(label, -1, null), ": rule failed to fire"].join("")
  );
  rt.deleteItem(errors, rt.slice(n, undefined, undefined));
  return null;
});
expect_out = rt.fn("expect_out", (args, kwargs) => {
  let label: unknown;
  let m: unknown;
  let needle: unknown;
  let out: unknown;
  label = rt.argument(args, kwargs, 0, "label", undefined);
  needle = rt.argument(args, kwargs, 1, "needle", undefined);
  out = rt.argument(args, kwargs, 2, "out", undefined);
  rt.assert(
    rt.invoke(
      any,
      rt.comprehend(out, (item: unknown) => {
        let m: unknown;
        m = item;
        return rt.compare("in", needle, m);
      })
    ),
    [rt.format(label, -1, null), ": rule failed to fire"].join("")
  );
  return null;
});
expect_silent = rt.fn("expect_silent", (args, kwargs) => {
  let label: unknown;
  let out: unknown;
  label = rt.argument(args, kwargs, 0, "label", undefined);
  out = rt.argument(args, kwargs, 1, "out", undefined);
  rt.assert(
    !rt.truth(out),
    [
      rt.format(label, -1, null),
      ": unexpected errors ",
      rt.format(rt.item(out, rt.slice(undefined, 2, undefined)), -1, null),
    ].join("")
  );
  return null;
});
self_test = rt.fn("self_test", (args, kwargs) => {
  let P: unknown;
  let _: unknown;
  let a: unknown;
  let b: unknown;
  let bad: unknown;
  let buf: unknown;
  let cf: unknown;
  let contextlib: unknown;
  let contracts: unknown;
  let copy: unknown;
  let d: unknown;
  let data: unknown;
  let dup_raised: unknown;
  let e: unknown;
  let effort_man: unknown;
  let expect_msg: unknown;
  let fa_def: unknown;
  let fa_int: unknown;
  let fa_ne: unknown;
  let fa_sv: unknown;
  let field: unknown;
  let fmap: unknown;
  let glued: unknown;
  let good: unknown;
  let good_dh: unknown;
  let good_manifest: unknown;
  let good_otp: unknown;
  let hc: unknown;
  let ic_full: unknown;
  let ic_int: unknown;
  let ic_ok: unknown;
  let ic_other: unknown;
  let io: unknown;
  let m: unknown;
  let man: unknown;
  let man2: unknown;
  let man3: unknown;
  let man4: unknown;
  let man5: unknown;
  let man_ad: unknown;
  let man_hex: unknown;
  let man_p: unknown;
  let msgs: unknown;
  let n: unknown;
  let obs_tbl: unknown;
  let otp_split: unknown;
  let out: unknown;
  let overlong: unknown;
  let po_num: unknown;
  let prompt: unknown;
  let rat: unknown;
  let rc: unknown;
  let rej_num: unknown;
  let res: unknown;
  let rev: unknown;
  let revs: unknown;
  let revs10: unknown;
  let revs_split: unknown;
  let role: unknown;
  let shared: unknown;
  let so: unknown;
  let so_l: unknown;
  let td: unknown;
  let tempfile: unknown;
  copy = rt.module("copy");
  expect_msg = rt.fn("expect_msg", (args, kwargs) => {
    let d: unknown;
    let e: unknown;
    let fn: unknown;
    let label: unknown;
    let n: unknown;
    let needle: unknown;
    let path: unknown;
    label = rt.argument(args, kwargs, 0, "label", undefined);
    needle = rt.argument(args, kwargs, 1, "needle", undefined);
    fn = rt.argument(args, kwargs, 2, "fn", undefined);
    d = rt.argument(args, kwargs, 3, "d", undefined);
    path = rt.argument(args, kwargs, 4, "path", undefined);
    n = rt.invoke(len, errors);
    rt.invoke(fn, d, path);
    rt.assert(
      rt.invoke(
        any,
        rt.comprehend(rt.item(errors, rt.slice(n, undefined, undefined)), (item: unknown) => {
          let e: unknown;
          e = item;
          return rt.compare("in", needle, e);
        })
      ),
      [
        rt.format(label, -1, null),
        ": expected ",
        rt.format(needle, 114, null),
        " to fire, got ",
        rt.format(
          rt.item(rt.item(errors, rt.slice(n, undefined, undefined)), rt.slice(undefined, 3, undefined)),
          -1,
          null
        ),
      ].join("")
    );
    rt.deleteItem(errors, rt.slice(n, undefined, undefined));
    return null;
  });
  shared = rt.op("div", rt.attr(SKILL_DIR, "parent"), "_shared");
  good_manifest = rt.invoke(yload, rt.method(rt.op("div", shared, "schemas/run-manifest.schema.yaml"), "read_bytes"));
  rt.method(
    good_manifest,
    "update",
    rt.dict([
      ["run_id", "orun-2026-09-11T00:00:00Z"],
      ["ontology", rt.dict([["name", "x"]])],
      ["first_run", true],
      [
        "scope_doc",
        rt.dict([
          ["path", "docs/scope.md"],
          ["sha256_12", rt.op("mul", "a", 12)],
        ]),
      ],
      [
        "cq_suite",
        rt.dict([
          ["path", "docs/cqs.yaml"],
          ["sha256_12", rt.op("mul", "b", 12)],
          ["cq_count", 1],
        ]),
      ],
      [
        "adapters",
        [
          rt.dict([
            ["id", "a"],
            ["version", "1"],
            ["script", "s"],
            ["script_sha256_12", rt.op("mul", "c", 12)],
            ["golden_fixture", "g"],
          ]),
        ],
      ],
    ])
  );
  for (const loop104 of rt.iter(rt.method(PROMPT_ROLES, "items"))) {
    role = rt.item(loop104, 0);
    prompt = rt.item(loop104, 1);
    rt.method(
      rt.item(rt.item(good_manifest, "agents"), role),
      "update",
      rt.dict([
        ["model", "test-model"],
        ["effort", "medium"],
        ["prompt_sha256_12", rt.invoke(sha12, rt.method(rt.op("div", SKILL_DIR, prompt), "read_bytes"))],
      ])
    );
  }
  contracts = rt.call(
    sorted,
    [
      rt.op(
        "add",
        rt.op(
          "add",
          rt.op(
            "add",
            rt.op(
              "add",
              rt.invoke(list, rt.method(rt.op("div", shared, "schemas"), "glob", "*.yaml")),
              rt.invoke(list, rt.method(shared, "glob", "*.yaml"))
            ),
            rt.invoke(list, rt.method(shared, "glob", "*.md"))
          ),
          rt.invoke(list, rt.method(shared, "glob", "*.json"))
        ),
        rt.invoke(list, rt.method(rt.op("div", SKILL_DIR, "templates"), "glob", "*.yaml"))
      ),
    ],
    {
      key: rt.fn("lambda", (args, kwargs) => {
        let f: unknown;
        f = rt.argument(args, kwargs, 0, "f", undefined);
        return rt.invoke(str, rt.method(f, "relative_to", rt.attr(SKILL_DIR, "parent")));
        return null;
      }),
    }
  );
  hc = rt.method(hashlib, "sha256");
  for (const loop105 of rt.iter(contracts)) {
    cf = loop105;
    data = rt.method(cf, "read_bytes");
    rt.method(
      hc,
      "update",
      rt.method(
        [
          rt.format(rt.method(cf, "relative_to", rt.attr(SKILL_DIR, "parent")), -1, null),
          "\n",
          rt.format(rt.invoke(len, data), -1, null),
          "\n",
        ].join(""),
        "encode"
      )
    );
    rt.method(hc, "update", data);
  }
  rt.setItem(
    good_manifest,
    "engine",
    rt.dict([
      [
        "validator_sha256_12",
        rt.invoke(sha12, rt.method(rt.method(rt.invoke(Path, __file__), "resolve"), "read_bytes")),
      ],
      ["contracts_sha256_12", rt.item(rt.method(hc, "hexdigest"), rt.slice(undefined, 12, undefined))],
    ])
  );
  rt.invoke(check_manifest, rt.method(copy, "deepcopy", good_manifest), "self:good_manifest");
  rt.assert(!rt.truth(errors), ["good manifest should pass: ", rt.format(errors, -1, null)].join(""));
  so = rt.dict([
    ["id", ""],
    ["schema_version", 1],
    [
      "repository",
      rt.dict([
        ["commit", "c1"],
        ["path", "src/a.ts"],
      ]),
    ],
    [
      "source_span",
      rt.dict([
        ["start_line", 1],
        ["end_line", 2],
        ["content_sha256", rt.op("mul", "d", 64)],
      ]),
    ],
    [
      "extractor",
      rt.dict([
        ["id", "e"],
        ["version", "1"],
        ["script", "s"],
        ["parser", "ts"],
      ]),
    ],
    [
      "symbol",
      rt.dict([
        ["lexical_name", "A"],
        ["qualified_name", "src.A"],
        ["syntactic_kind", "class"],
      ]),
    ],
    [
      "observed_facts",
      [
        rt.dict([
          ["predicate", "extends_syntactically"],
          ["object", "P"],
        ]),
      ],
    ],
    ["epistemic_status", "parser_derived"],
  ]);
  rt.setItem(so, "id", rt.invoke(canonical_obs_id, "so", so));
  rt.invoke(check_so, rt.method(copy, "deepcopy", so), "self:good_so");
  rt.assert(!rt.truth(errors), ["good_so should pass: ", rt.format(errors, -1, null)].join(""));
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(b, "id", rt.op("add", "so:sha256:", rt.op("mul", "a", 64)));
  rt.invoke(expect_err, "canonical SO id", check_so, b, "self:handtyped_id_so");
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(rt.item(b, "symbol"), "ontology_interpretation", "ufo:Kind");
  rt.invoke(expect_err, "nested unknown key", check_so, b, "self:nested_so");
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(rt.item(rt.item(b, "observed_facts"), 0), "object", "Requester/role of Person");
  rt.setItem(b, "id", rt.invoke(canonical_obs_id, "so", b));
  rt.invoke(expect_err, "object prose smuggle", check_so, b, "self:prose_so");
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(b, "observed_facts", [
    rt.dict([
      ["predicate", "unrepresentable_construct"],
      ["object", "RoleMixin"],
    ]),
    rt.dict([
      ["predicate", "declares_field"],
      ["object", "id"],
    ]),
  ]);
  rt.setItem(b, "id", rt.invoke(canonical_obs_id, "so", b));
  rt.invoke(expect_err, "mixed unrepresentable", check_so, b, "self:mixed_so");
  good_dh = rt.dict([
    ["id", "dh:x:001"],
    ["observation_refs", [rt.item(so, "id")]],
    ["proposed_referent", rt.dict([["label", "x"]])],
    ["representation_status", "domain_referent"],
    [
      "null_hypothesis",
      rt.dict([
        ["label", "n"],
        ["rejected", true],
        ["rationale", "r"],
        ["discriminator", "the lease lifecycle transitions in state machine code no serialization record could drive"],
      ]),
    ],
    [
      "confidence",
      rt.dict([
        ["value", 0.5],
        ["use_for_acceptance", false],
      ]),
    ],
  ]);
  rt.invoke(check_dh, rt.method(copy, "deepcopy", good_dh), "self:good_dh");
  rt.assert(!rt.truth(errors), ["good_dh should pass: ", rt.format(errors, -1, null)].join(""));
  b = rt.method(copy, "deepcopy", good_dh);
  rt.setItem(rt.item(b, "null_hypothesis"), "discriminator", "it is a named type with an id field padded");
  rt.invoke(expect_err, "discriminator denylist", check_dh, b, "self:denylist_dh");
  good_otp = rt.dict([
    ["id", "otp:Lease:001"],
    ["hypothesis_ref", "dh:x:001"],
    ["identity_card_ref", "ic:x:001"],
    ["foundational_status", "analyzed"],
    [
      "ontoclean",
      rt.dict([
        ["rigidity", "rigid"],
        ["identity", "supplies"],
        ["dependence", "none"],
      ]),
    ],
    [
      "term",
      rt.dict([
        ["local_name", "Lease"],
        ["preferred_label", "lease"],
        ["proposed_iri", "https://ex.test/Lease"],
        ["owl_entity_kind", "class"],
      ]),
    ],
    ["definition", rt.dict([["text", "d"]])],
    ["foundational", rt.dict([["ufo_category", "relator"]])],
    [
      "reuse",
      rt.dict([
        ["searched", true],
        ["exact_reuse_found", false],
      ]),
    ],
    ["operational_warrant", rt.dict([["competency_questions", ["CQ-001"]]])],
    ["status", "proposed"],
  ]);
  rt.invoke(check_otp, rt.method(copy, "deepcopy", good_otp), "self:good_otp");
  rt.assert(!rt.truth(errors), ["good_otp should pass: ", rt.format(errors, -1, null)].join(""));
  b = rt.method(copy, "deepcopy", good_otp);
  rt.deleteItem(b, "foundational");
  rt.invoke(expect_err, "ufo_category required", check_otp, b, "self:nocat_otp");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(b, "revision_log", [
    rt.dict([
      ["from_sha256", rt.op("mul", "a", 64)],
      ["addressed", "x"],
    ]),
  ]);
  rt.invoke(expect_err, "addressed must be a list", check_otp, b, "self:scalar_addressed");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(rt.item(b, "reuse"), "searched", false);
  rt.invoke(expect_err, "searched must be true", check_otp, b, "self:unsearched_otp");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(rt.item(b, "operational_warrant"), "semantic_support_for", ["otp:Other:001"]);
  rt.invoke(expect_err, "warrant XOR", check_otp, b, "self:dualrole_otp");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(b, "parents", [
    rt.dict([
      ["parent", "Person as rigid kind"],
      ["justification", rt.op("mul", "x", 25)],
    ]),
  ]);
  rt.invoke(expect_err, "parents prose", check_otp, b, "self:parents_otp");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(b, "id", "not-an-otp");
  rt.invoke(expect_err, "otp id grammar", check_otp, b, "self:badid_otp");
  rt.invoke(expect_err, "malformed OTP no crash", check_otp, [], "self:list_otp");
  rat = rt.dict([
    ["id", "rat:001"],
    ["proposal_ref", "otp:Lease:001"],
    ["proposal_sha256", rt.op("mul", "f", 64)],
    ["decision", "accept"],
    [
      "steward",
      rt.dict([
        ["id", "steward-1"],
        ["name", "A Steward"],
      ]),
    ],
    ["decided_at", "2026-08-27"],
    ["verbatim_decision", "I accept the Lease proposal."],
  ]);
  rt.invoke(check_rat, rt.method(copy, "deepcopy", rat), "self:good_rat");
  rt.assert(!rt.truth(errors), ["good_rat should pass: ", rt.format(errors, -1, null)].join(""));
  b = rt.method(copy, "deepcopy", rat);
  rt.deleteItem(b, "proposal_sha256");
  rt.invoke(expect_err, "rat content binding", check_rat, b, "self:unbound_rat");
  out = rt.invoke(
    cross_check_rats,
    [rt.tuple(["self:r1", rat])],
    [rt.tuple(["self:otp", good_otp])],
    rt.dict([["otp:Lease:001", rt.op("mul", "0", 64)]])
  );
  rt.invoke(expect_out, "stale rat", "STALE ratification", out);
  out = rt.invoke(
    cross_check_rats,
    [rt.tuple(["self:r1", rat])],
    [rt.tuple(["self:otp", good_otp])],
    rt.dict([["otp:Lease:001", rt.op("mul", "f", 64)]])
  );
  rt.invoke(expect_silent, "fresh rat passes", out);
  rev = rt.dict([
    ["target", "otp:Lease:001"],
    ["target_sha256", rt.op("mul", "e", 64)],
    ["chain_sha256", rt.op("mul", "c", 64)],
    ["seat", "ontoclean-adversary"],
    ["verdict", "PASS"],
    [
      "surfaces",
      rt.dict([
        ["taxonomy", "no_surface"],
        ["identity", "attacked"],
        ["warrant", "attacked"],
        ["null_discriminator", "attacked"],
      ]),
    ],
    ["no_surface_reasons", rt.dict([["taxonomy", "proposal asserts no is-a edge"]])],
    ["evidence", [rt.op("add", "so:sha256:", rt.op("mul", "a", 64)), "CQ-001"]],
    [
      "attacks",
      [
        rt.dict([
          ["surface", "identity"],
          ["rule", "identity-conflict"],
          ["counterexample", "two renewals wrongly identified"],
          ["outcome", "survived"],
        ]),
        rt.dict([
          ["surface", "warrant"],
          ["rule", "listing-cq-warrant"],
          ["counterexample", "CQ answerable without the term"],
          ["outcome", "survived"],
        ]),
        rt.dict([
          ["surface", "null_discriminator"],
          ["rule", "discriminator-true-of-dto"],
          ["counterexample", "a DTO twin makes the fact true anyway"],
          ["outcome", "survived"],
        ]),
      ],
    ],
  ]);
  rt.invoke(check_review, rt.method(copy, "deepcopy", rev), "self:good_review");
  rt.assert(!rt.truth(errors), ["good review should pass: ", rt.format(errors, -1, null)].join(""));
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "target", "edge: Child -> Parent");
  rt.invoke(expect_err, "edge target rejected", check_review, b, "self:edge_review");
  b = rt.method(copy, "deepcopy", rev);
  rt.deleteItem(b, "chain_sha256");
  rt.invoke(expect_err, "chain binding required", check_review, b, "self:nochain_review");
  P = Path;
  revs = [
    rt.tuple([
      rt.invoke(P, "w/otp-x-001.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "a", 64)],
        ["verdict", "FAIL"],
      ]),
    ]),
    rt.tuple([
      rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "a", 64)],
        ["verdict", "INDETERMINATE"],
      ]),
    ]),
    rt.tuple([
      rt.invoke(P, "w/otp-x-001-r3.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "a", 64)],
        ["verdict", "PASS"],
      ]),
    ]),
  ];
  out = rt.item(rt.invoke(cross_check_review_binding, revs, rt.dict([])), 0);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs, rt.dict([])), 1);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs, rt.dict([])), 2);
  rt.invoke(expect_out, "FAIL revived through INDETERMINATE", "PASS on the SAME proposal bytes", out);
  rt.setItem(
    revs,
    2,
    rt.tuple([
      rt.invoke(P, "w/otp-x-001-r3.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "b", 64)],
        ["verdict", "PASS"],
      ]),
    ])
  );
  out = rt.item(rt.invoke(cross_check_review_binding, revs, rt.dict([])), 0);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs, rt.dict([])), 1);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs, rt.dict([])), 2);
  rt.invoke(expect_out, "PASS after FAIL needs revision_log", "PASS after FAIL without a revision_log", out);
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    2
  );
  rt.invoke(expect_out, "round continuity", "non-contiguous", out);
  ic_other = rt.dict([
    ["id", "ic:x:001"],
    ["hypothesis_ref", "dh:OTHER:001"],
  ]);
  out = rt.invoke(
    cross_check_chain,
    [rt.tuple(["self:otp", good_otp])],
    [rt.tuple(["self:dh", good_dh])],
    [rt.tuple(["self:ic", ic_other])],
    [],
    rt.set([rt.item(so, "id")])
  );
  rt.invoke(expect_out, "IC cross-wire", "not this proposal's", out);
  fa_def = rt.dict([
    ["id", "fa:x:001"],
    ["hypothesis_ref", "dh:x:001"],
    ["identity_card_ref", "ic:x:001"],
    ["verdict", "explicitly_deferred"],
  ]);
  ic_ok = rt.dict([
    ["id", "ic:x:001"],
    ["hypothesis_ref", "dh:x:001"],
  ]);
  out = rt.invoke(
    cross_check_chain,
    [rt.tuple(["self:otp", good_otp])],
    [rt.tuple(["self:dh", good_dh])],
    [rt.tuple(["self:ic", ic_ok])],
    [rt.tuple(["self:fa", fa_def])],
    rt.set([rt.item(so, "id")])
  );
  rt.invoke(expect_out, "FA verdict join", "contradicts the analysis verdict", out);
  out = rt.call(
    cross_check_index,
    [
      [
        rt.dict([
          ["observation", rt.op("add", "so:sha256:", rt.op("mul", "9", 64))],
          ["outcome", "proposed"],
          ["ref", "otp:Lease:001"],
          ["carried_from_prior", true],
        ]),
      ],
      "self:idx",
      rt.invoke(set),
      [rt.tuple(["self:otp", good_otp])],
      [rt.tuple(["self:dh", good_dh])],
      rt.invoke(set),
    ],
    { prior_rows: [] }
  );
  rt.invoke(expect_out, "fake carried row", "NOT in the prior index", out);
  rt.invoke(expect_out, "carried cannot be proposed", "cannot be 'proposed'", out);
  out = rt.invoke(
    cross_check_index,
    [
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "8", 64))],
        ["outcome", "proposed"],
        ["ref", "otp:Lease:001"],
      ]),
    ],
    "self:idx",
    rt.set([rt.op("add", "so:sha256:", rt.op("mul", "8", 64))]),
    [rt.tuple(["self:otp", good_otp])],
    [rt.tuple(["self:dh", good_dh])],
    rt.invoke(set)
  );
  rt.invoke(expect_out, "row-evidence join", "does not cite this observation", out);
  out = rt.invoke(
    cross_check_index,
    [
      rt.dict([
        ["observation", rt.item(so, "id")],
        ["outcome", "unresolved"],
        ["needed_evidence", "consult the registrar SME"],
        ["since", "2020-01-01 junk"],
      ]),
    ],
    "self:idx",
    rt.set([rt.item(so, "id")]),
    [],
    [],
    rt.invoke(set)
  );
  rt.invoke(expect_out, "since exact ISO", "EXACTLY YYYY-MM-DD", out);
  out = rt.invoke(
    cross_check_support_graph,
    [
      rt.tuple([
        "self:a",
        rt.dict([
          ["id", "otp:a:001"],
          ["operational_warrant", rt.dict([["semantic_support_for", ["https://ex.test/X"]]])],
        ]),
      ]),
    ],
    [],
    rt.dict([])
  );
  rt.invoke(expect_out, "IRI needs digest-fresh accept", "DIGEST-FRESH", out);
  ic_full = rt.dict([
    ["id", "ic:x:001"],
    ["hypothesis_ref", "dh:x:001"],
    [
      "identity",
      rt.dict([
        ["supplies_identity", true],
        ["identity_criterion", "the identifier assigned by the registrar enrollment office system"],
      ]),
    ],
    [
      "ontoclean",
      rt.dict([
        ["rigidity", "rigid"],
        ["carries_identity", true],
        ["supplies_identity", true],
        ["unity", ""],
        ["dependence", "none"],
      ]),
    ],
    ["ufo_analysis", rt.dict([["candidate_category", "kind"]])],
    [
      "temporality",
      rt.dict([
        ["exists_during_interval", true],
        ["may_change_state_without_losing_identity", true],
      ]),
    ],
    [
      "counterexamples",
      [rt.dict([["description", "a guest auditor enrolled without registration tests the criterion"]])],
    ],
    ["status", "proposed"],
  ]);
  rt.invoke(expect_err, "identifier pad fires at any length", check_ic, ic_full, "self:pad_ic");
  b = rt.method(copy, "deepcopy", ic_full);
  rt.setItem(
    rt.item(b, "identity"),
    "identity_criterion",
    "sameness is the enrollment relationship itself; the identifier field is evidence, never the criterion"
  );
  rt.setItem(rt.item(b, "identity"), "supplies_identity", true);
  rt.invoke(check_ic, b, "self:negation_ic");
  rt.assert(!rt.truth(errors), ["negation-context criterion should pass: ", rt.format(errors, -1, null)].join(""));
  b = rt.method(copy, "deepcopy", b);
  rt.setItem(rt.item(b, "ontoclean"), "supplies_identity", false);
  rt.invoke(expect_err, "provider fields agree", check_ic, b, "self:disagree_ic");
  man = rt.method(copy, "deepcopy", good_manifest);
  rt.setItem(rt.item(man, "repository"), "pin_waived", "no");
  rt.invoke(
    expect_msg,
    "pin_waived must be boolean",
    "repository.pin_waived must be a BOOLEAN",
    check_manifest,
    man,
    "self:strwaive_man"
  );
  rt.assert(!rt.truth(rt.invoke(occurs, "id", "class S { #id: string }")), "#id boundary failed");
  rt.assert(rt.invoke(occurs, "id", "class S { id: string }"), "plain id must occur");
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", '"mode": "strict",\n"level": "safe"')),
    "config pair must reject cross-key pairing"
  );
  rt.assert(
    rt.invoke(config_pair_occurs, "mode", "safe", '"mode": "safe"'),
    "config pair must accept the real pairing"
  );
  b = rt.method(copy, "deepcopy", ic_full);
  rt.setItem(
    rt.item(b, "identity"),
    "identity_criterion",
    "sameness is the enrollment relationship itself, never the number"
  );
  rt.setItem(rt.item(b, "ontoclean"), "supplies_identity", "unresolved");
  rt.invoke(expect_err, "provider boolean-vs-unresolved", check_ic, b, "self:mixed_provider");
  out = rt.call(
    cross_check_index,
    [
      [
        rt.dict([
          ["observation", rt.item(so, "id")],
          ["outcome", "unresolved"],
          ["needed_evidence", "consult the registrar SME"],
          ["since", "2020-01-01"],
          ["carried_from_prior", true],
        ]),
      ],
      "self:idx",
      rt.set([rt.item(so, "id")]),
      [],
      [],
      rt.invoke(set),
    ],
    {
      prior_rows: [
        rt.dict([
          ["observation", rt.item(so, "id")],
          ["outcome", "unresolved"],
          ["needed_evidence", "old evidence text here"],
        ]),
      ],
    }
  );
  rt.invoke(expect_out, "carried on a LIVE observation", "denominator bypass", out);
  rt.assert(
    rt.invoke(
      fa_ran_no_tests,
      rt.dict([
        [
          "tests",
          rt.dict([
            ["spec_vs_execution", "unresolved"],
            ["world_vs_information", "unresolved"],
            ["role_vs_bearer", "unresolved"],
            ["context_reification_needed", false],
          ]),
        ],
      ])
    ),
    "boolean must not defeat the vacuity predicate"
  );
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "listing-cq-warrant"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([
        [
          "otp:x:001",
          rt.tuple([
            rt.invoke(P, "nonexistent"),
            rt.dict([
              [
                "revision_log",
                [
                  rt.dict([
                    ["from_sha256", rt.op("mul", "a", 64)],
                    ["addressed", ["some-other-rule"]],
                  ]),
                ],
              ],
            ]),
          ]),
        ],
      ])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "listing-cq-warrant"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([
        [
          "otp:x:001",
          rt.tuple([
            rt.invoke(P, "nonexistent"),
            rt.dict([
              [
                "revision_log",
                [
                  rt.dict([
                    ["from_sha256", rt.op("mul", "a", 64)],
                    ["addressed", ["some-other-rule"]],
                  ]),
                ],
              ],
            ]),
          ]),
        ],
      ])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "listing-cq-warrant"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([
        [
          "otp:x:001",
          rt.tuple([
            rt.invoke(P, "nonexistent"),
            rt.dict([
              [
                "revision_log",
                [
                  rt.dict([
                    ["from_sha256", rt.op("mul", "a", 64)],
                    ["addressed", ["some-other-rule"]],
                  ]),
                ],
              ],
            ]),
          ]),
        ],
      ])
    ),
    2
  );
  rt.invoke(expect_out, "addressed joined to landed rules", "does not address", out);
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/aaa.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/zzz.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/aaa.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/zzz.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/aaa.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/zzz.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    2
  );
  rt.invoke(expect_out, "duplicate round", "SECOND review at round", out);
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(b, "id", "rat:banana");
  rt.invoke(expect_err, "rat id grammar", check_rat, b, "self:banana_rat");
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(b, "id", "rat:1\n");
  rt.invoke(expect_err, "rat id trailing newline", check_rat, b, "self:newline_rat");
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(b, "decided_at", "definitely-not-a-timestamp");
  rt.invoke(expect_err, "decided_at ISO8601", check_rat, b, "self:badtime_rat");
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(b, "decided_at", "2026-99-99T25:61:61+00:00");
  rt.invoke(expect_err, "decided_at real calendar", check_rat, b, "self:impossible_rat");
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(b, "steward", rt.dict([["id", 7]]));
  rt.invoke(expect_err, "steward typed + named", check_rat, b, "self:numsteward_rat");
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "r1"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "INDETERMINATE"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "r1"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "INDETERMINATE"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "r1"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "INDETERMINATE"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    2
  );
  rt.invoke(expect_out, "FAIL is sticky vs INDET", "abstention does not retire", out);
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "INDETERMINATE"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "identity"],
                  ["rule", "identity-conflict"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "INDETERMINATE"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "identity"],
                  ["rule", "identity-conflict"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "INDETERMINATE"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "identity"],
                  ["rule", "identity-conflict"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    2
  );
  rt.invoke(expect_out, "landed-INDET history", "SAME proposal bytes", out);
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "evidence", ["so:not-an-id"]);
  rt.invoke(expect_err, "evidence full-id form", check_review, b, "self:thin_ev_review");
  fa_sv = rt.dict([
    ["id", "fa:x:001"],
    ["hypothesis_ref", "dh:x:001"],
    ["identity_card_ref", "ic:x:001"],
    [
      "tests",
      rt.dict([
        ["spec_vs_execution", "separated"],
        ["world_vs_information", "separated"],
        ["role_vs_bearer", "separated"],
        ["context_reification_needed", false],
      ]),
    ],
    ["verdict", "analyzed"],
    ["strongest_counterexample", "a serialization twin was tried and failed"],
    [
      "rival_models",
      [
        rt.dict([
          ["label", "role-model"],
          ["still_viable", "true"],
        ]),
      ],
    ],
  ]);
  rt.invoke(expect_err, "still_viable boolean type", check_fa, fa_sv, "self:strviable_fa");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(rt.item(b, "ontoclean"), "identity", "does not supply identity");
  rt.invoke(expect_err, "identity enum closed", check_otp, b, "self:prose_identity_otp");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(
    b,
    "reuse",
    rt.dict([
      ["searched", true],
      ["exact_reuse_found", "true"],
    ])
  );
  rt.invoke(expect_err, "exact_reuse_found boolean", check_otp, b, "self:strreuse_otp");
  fa_int = rt.dict([
    ["id", "fa:x:001"],
    ["hypothesis_ref", "dh:x:001"],
    ["identity_card_ref", "ic:x:001"],
    [
      "tests",
      rt.dict([
        ["spec_vs_execution", "separated"],
        ["world_vs_information", "separated"],
        ["role_vs_bearer", "separated"],
        ["context_reification_needed", false],
      ]),
    ],
    ["verdict", "analyzed"],
    ["strongest_counterexample", "a serialization twin was tried and failed"],
    [
      "rival_models",
      [
        rt.dict([
          ["label", "r"],
          ["still_viable", 0],
        ]),
      ],
    ],
  ]);
  rt.invoke(expect_err, "still_viable exact bool (int 0)", check_fa, fa_int, "self:intviable_fa");
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(rt.item(b, "steward"), "name", 7);
  rt.invoke(expect_err, "steward.name string", check_rat, b, "self:numname_rat");
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", '"mode": "safe;strict"')),
    "value-prefix semicolon bleed"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe strict")),
    "unquoted value-prefix space bleed"
  );
  rt.assert(!rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "database%mode: safe")), "percent key bleed");
  rt.assert(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe  "), "honest trailing-space pairing");
  rt.assert(rt.invoke(config_pair_occurs, "mode", "safe", '<root mode="safe"/>', "a.xml"), "honest xml attr pairing");
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "mode",
        "safe",
        rt.invoke(strip_comments_config, "level=strict ; mode=safe", "a.ini")
      )
    ),
    "inline ini semicolon"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "mode",
        "safe",
        rt.invoke(strip_comments, '<root mode="strict"/>\n<!-- unclosed\nmode="safe"', "a.xml")
      )
    ),
    "unclosed xml comment"
  );
  man3 = rt.method(copy, "deepcopy", good_manifest);
  rt.setItem(man3, "run_id", "orun-999");
  rt.invoke(
    expect_msg,
    "run_id parses as ISO",
    "run_id must match the closed grammar",
    check_manifest,
    man3,
    "self:orun999_man"
  );
  man4 = rt.method(copy, "deepcopy", good_manifest);
  rt.setItem(rt.item(man4, "repository"), "dirty", 0);
  rt.invoke(
    expect_msg,
    "dirty exact bool (int 0)",
    "repository.dirty must be a BOOLEAN",
    check_manifest,
    man4,
    "self:intdirty_man"
  );
  man5 = rt.method(copy, "deepcopy", good_manifest);
  rt.method(
    man5,
    "update",
    rt.dict([
      ["first_run", false],
      ["prior_index", "work/dispositions.index.yaml"],
      ["prior_index_sha256_12", rt.op("mul", "a", 12)],
    ])
  );
  rt.invoke(
    expect_msg,
    "prior archive grammar",
    "must be an ARCHIVED index",
    check_manifest,
    man5,
    "self:selfprior_man"
  );
  rt.setItem(man5, "first_run", true);
  rt.setItem(man5, "prior_index", "runs/orun-2026-08-28T00:00:00Z.index.yaml");
  rt.invoke(
    expect_msg,
    "first run cannot have predecessor",
    "first_run: true with a prior_index",
    check_manifest,
    man5,
    "self:firstprior_man"
  );
  b = rt.method(copy, "deepcopy", good_dh);
  rt.setItem(b, "cq_warrants", "CQ-001");
  rt.invoke(expect_err, "scalar cq_warrants", check_dh, b, "self:scalarcq_dh");
  b = rt.method(copy, "deepcopy", good_dh);
  rt.setItem(rt.item(b, "confidence"), "value", true);
  rt.invoke(expect_err, "confidence.value bool-as-num", check_dh, b, "self:boolconf_dh");
  ic_int = rt.method(copy, "deepcopy", ic_full);
  rt.setItem(
    rt.item(ic_int, "identity"),
    "identity_criterion",
    "sameness is the enrollment relationship itself, never the number"
  );
  rt.setItem(rt.item(ic_int, "temporality"), "exists_during_interval", 1);
  rt.invoke(expect_err, "tri-state int", check_ic, ic_int, "self:triint_ic");
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(b, "observed_facts", [
    rt.dict([
      ["predicate", "declares_field"],
      ["object", 7],
    ]),
  ]);
  rt.setItem(b, "id", rt.invoke(canonical_obs_id, "so", b));
  rt.invoke(expect_err, "integer fact object", check_so, b, "self:intobj_so");
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(b, "schema_version", true);
  rt.invoke(expect_err, "schema_version bool", check_so, b, "self:boolver_so");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(b, "operational_warrant", rt.dict([["semantic_support_for", "otp:Ghost:999"]]));
  rt.invoke(expect_err, "scalar support edge", check_otp, b, "self:scalarsup_otp");
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(rt.item(b, "ontoclean"), "identity", "unresolved");
  rt.invoke(check_otp, b, "self:unresolved_id_otp");
  rt.assert(
    !rt.truth(errors),
    ["unresolved identity should be legal at record level: ", rt.format(errors, -1, null)].join("")
  );
  rt.assert(
    !rt.truth(
      rt.invoke(config_pair_occurs, "mode", "safe", rt.invoke(strip_comments_config, "mode: safe;strict\n", "a.yaml"))
    ),
    "yaml semicolon payload truncation"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "mode",
        "safe",
        rt.invoke(strip_comments_config, "prefix/*c*/mode: safe\nmode: strict\n", "a.yaml")
      )
    ),
    "stripper-created key boundary"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe,strict")),
    "comma is not an unquoted terminator"
  );
  rt.assert(!rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "cmd: run(mode: safe)")), "paren opener removed");
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe\n  extra\n")),
    "multiline plain scalar prefix"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", 'mode="safe"strict')),
    "quoted value needs a post-quote terminator"
  );
  rt.assert(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe\nnext: x\n"), "honest yaml with following key");
  rt.assert(
    rt.invoke(config_pair_occurs, "mode", "safe", '<root mode="safe"/>', "a.xml"),
    "honest xml attr post-quote slash"
  );
  rt.assert(rt.invoke(config_pair_occurs, "mode", "safe", '{"mode": "safe", "x": 1}'), "honest json comma after quote");
  man2 = rt.method(copy, "deepcopy", good_manifest);
  rt.setItem(man2, "run_id", "not-orun");
  rt.invoke(
    expect_msg,
    "run_id grammar",
    "run_id must match the closed grammar",
    check_manifest,
    man2,
    "self:runid_man"
  );
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "verdict", "FAIL");
  for (const loop106 of rt.iter(rt.item(b, "attacks"))) {
    a = loop106;
    rt.setItem(a, "outcome", "survived");
  }
  rt.invoke(expect_err, "FAIL with zero landed", check_review, b, "self:fail_nolanded");
  b = rt.method(copy, "deepcopy", rev);
  rt.method(rt.item(rt.item(b, "attacks"), 0), "pop", "counterexample");
  rt.invoke(expect_err, "attack needs counterexample", check_review, b, "self:noce_review");
  b = rt.method(copy, "deepcopy", rev);
  rt.method(b, "pop", "evidence");
  rt.invoke(expect_err, "review needs evidence", check_review, b, "self:noev_review");
  rt.assert(!rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "foo-mode: safe")), "hyphen key bleed");
  rt.assert(!rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "database.mode: safe")), "dotted key bleed");
  rt.assert(!rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", '"mode": "safe-mode"')), "hyphen value bleed");
  rt.assert(!rt.truth(rt.invoke(config_pair_occurs, "mode", "", '"mode": "strict"')), "empty value fallback");
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "rule-one"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "identity"],
                  ["rule", "rule-two"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r3.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([
        [
          "otp:x:001",
          rt.tuple([
            rt.invoke(P, "nonexistent"),
            rt.dict([
              [
                "revision_log",
                [
                  rt.dict([
                    ["from_sha256", rt.op("mul", "a", 64)],
                    ["addressed", ["rule-two"]],
                  ]),
                ],
              ],
            ]),
          ]),
        ],
      ])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "rule-one"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "identity"],
                  ["rule", "rule-two"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r3.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([
        [
          "otp:x:001",
          rt.tuple([
            rt.invoke(P, "nonexistent"),
            rt.dict([
              [
                "revision_log",
                [
                  rt.dict([
                    ["from_sha256", rt.op("mul", "a", 64)],
                    ["addressed", ["rule-two"]],
                  ]),
                ],
              ],
            ]),
          ]),
        ],
      ])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-x-001.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "warrant"],
                  ["rule", "rule-one"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "FAIL"],
            [
              "attacks",
              [
                rt.dict([
                  ["surface", "identity"],
                  ["rule", "rule-two"],
                  ["outcome", "landed"],
                ]),
              ],
            ],
          ]),
        ]),
        rt.tuple([
          rt.invoke(P, "w/otp-x-001-r3.review.yaml"),
          rt.dict([
            ["target", "otp:x:001"],
            ["target_sha256", rt.op("mul", "b", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([
        [
          "otp:x:001",
          rt.tuple([
            rt.invoke(P, "nonexistent"),
            rt.dict([
              [
                "revision_log",
                [
                  rt.dict([
                    ["from_sha256", rt.op("mul", "a", 64)],
                    ["addressed", ["rule-two"]],
                  ]),
                ],
              ],
            ]),
          ]),
        ],
      ])
    ),
    2
  );
  rt.invoke(expect_out, "landed rules UNION across FAILs", "does not address", out);
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(rt.item(b, "repository"), "path", 123);
  rt.setItem(b, "id", rt.invoke(canonical_obs_id, "so", b));
  rt.invoke(
    expect_msg,
    "SO numeric path",
    "repository.path must be a non-blank STRING",
    check_so,
    b,
    "self:intpath_so"
  );
  po_num = rt.dict([
    ["id", ""],
    ["schema_version", 1],
    [
      "repository",
      rt.dict([
        ["commit", "c1"],
        ["path", 123],
      ]),
    ],
    [
      "source_span",
      rt.dict([
        ["start_line", 1],
        ["end_line", 2],
      ]),
    ],
    ["quote", "a substantive verbatim quotation body"],
    ["epistemic_status", "quoted_prose"],
  ]);
  rt.setItem(po_num, "id", rt.invoke(canonical_obs_id, "po", po_num));
  rt.invoke(
    expect_msg,
    "PO numeric path",
    "repository.path must be a non-blank STRING",
    check_po,
    po_num,
    "self:intpath_po"
  );
  for (const loop107 of rt.iter(rt.tuple(["id", "version", "script", "golden_fixture"]))) {
    field = loop107;
    man_ad = rt.method(copy, "deepcopy", good_manifest);
    rt.setItem(rt.item(rt.item(man_ad, "adapters"), 0), field, 71);
    rt.invoke(
      expect_msg,
      ["manifest numeric adapter ", rt.format(field, -1, null)].join(""),
      ["adapters entry ", rt.format(field, -1, null), " must be a non-blank STRING"].join(""),
      check_manifest,
      man_ad,
      ["self:intadapter_", rt.format(field, -1, null), "_man"].join("")
    );
  }
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(rt.item(b, "term"), "local_name", 777);
  rt.invoke(
    expect_msg,
    "OTP numeric local_name",
    "term.local_name must be a non-blank STRING",
    check_otp,
    b,
    "self:intlocal_otp"
  );
  b = rt.method(copy, "deepcopy", good_dh);
  rt.setItem(rt.item(b, "null_hypothesis"), "discriminator", 4111111111111111111111111111111111111111);
  rt.invoke(expect_msg, "DH numeric discriminator", "discriminator must be a STRING", check_dh, b, "self:intdisc_dh");
  fa_ne = rt.dict([
    ["id", "fa:x:001"],
    ["hypothesis_ref", "dh:x:001"],
    ["identity_card_ref", "ic:x:001"],
    [
      "tests",
      rt.dict([
        ["spec_vs_execution", "separated"],
        ["world_vs_information", "separated"],
        ["role_vs_bearer", "separated"],
        ["context_reification_needed", false],
      ]),
    ],
    ["verdict", "analyzed"],
    ["needed_evidence", 12345],
    ["strongest_counterexample", "a serialization twin was tried and failed"],
  ]);
  rt.invoke(
    expect_msg,
    "FA numeric needed_evidence",
    "needed_evidence must be a STRING",
    check_fa,
    fa_ne,
    "self:intne_fa"
  );
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "verdict", "INDETERMINATE");
  rt.setItem(b, "needed_evidence", 999999999999999);
  rt.invoke(
    expect_msg,
    "review numeric needed_evidence",
    "needed_evidence must be a STRING",
    check_review,
    b,
    "self:intne_review"
  );
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "surfaces", rt.call(dict, [rt.item(b, "surfaces")], { taxonomy: "no_surface" }));
  rt.setItem(b, "no_surface_reasons", rt.dict([["taxonomy", 1234567890123]]));
  rt.invoke(
    expect_msg,
    "review numeric no_surface reason",
    "concrete STRING",
    check_review,
    b,
    "self:intreason_review"
  );
  b = rt.method(copy, "deepcopy", rat);
  rt.setItem(b, "verbatim_decision", 7777777777);
  rt.invoke(
    expect_msg,
    "rat numeric verbatim",
    "verbatim_decision must be a non-blank STRING",
    check_rat,
    b,
    "self:intverb_rat"
  );
  rej_num = rt.dict([
    ["id", "rej:1"],
    ["proposal_ref", "otp:Lease:001"],
    ["rationale", 123456789012345678901234567890],
  ]);
  rt.invoke(
    expect_msg,
    "rej numeric rationale",
    "rationale must be a substantive STRING",
    check_rej,
    rej_num,
    "self:intrat_rej"
  );
  out = rt.invoke(
    cross_check_index,
    [
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "8", 64))],
        ["outcome", "irrelevant"],
        ["reason", 123456789012345],
      ]),
    ],
    "self:idx",
    rt.set([rt.op("add", "so:sha256:", rt.op("mul", "8", 64))]),
    [],
    [],
    rt.invoke(set)
  );
  rt.invoke(expect_out, "index numeric reason", "reason must be a STRING", out);
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(
    b,
    "reuse",
    rt.dict([
      ["searched", true],
      ["exact_reuse_found", false],
      ["mappings", "not-a-list"],
    ])
  );
  rt.invoke(
    expect_msg,
    "reuse.mappings shape on false branch",
    "reuse.mappings must be a list",
    check_otp,
    b,
    "self:mapshape_otp"
  );
  b = rt.method(copy, "deepcopy", good_otp);
  rt.setItem(b, "review", "complete");
  rt.invoke(expect_msg, "inline review block shape", "review must be a MAPPING", check_otp, b, "self:revshape_otp");
  revs10 = [
    rt.tuple([
      rt.invoke(P, "w/otp-x-001.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "a", 64)],
        ["verdict", "FAIL"],
        [
          "attacks",
          [
            rt.dict([
              ["surface", "identity"],
              ["rule", "anti-rigid-superclass"],
              ["outcome", "landed"],
            ]),
          ],
        ],
      ]),
    ]),
    rt.tuple([
      rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "b", 64)],
        ["verdict", "INDETERMINATE"],
      ]),
    ]),
  ];
  _ = rt.item(rt.invoke(cross_check_review_binding, revs10, rt.dict([])), 0);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs10, rt.dict([])), 1);
  fmap = rt.item(rt.invoke(cross_check_review_binding, revs10, rt.dict([])), 2);
  rt.assert(
    rt.compare("eq", rt.get(rt.item(fmap, "prior"), "otp:x:001"), rt.set([rt.op("mul", "a", 64)])),
    "prior-FAIL coverage set must be populated for a governing INDET"
  );
  rt.assert(
    rt.compare(
      "eq",
      rt.get(rt.item(fmap, "rules"), rt.tuple(["otp:x:001", rt.op("mul", "a", 64)])),
      rt.set(["anti-rigid-superclass"])
    ),
    "landed rules must join the prior digest"
  );
  rt.deleteItem(errors, rt.slice(undefined, undefined, undefined));
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-y-001.review.yaml"),
          rt.dict([
            ["target", "otp:y:001"],
            ["target_sha256", rt.op("mul", "c", 64)],
            ["verdict", "INDETERMINATE"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-y-001.review.yaml"),
          rt.dict([
            ["target", "otp:y:001"],
            ["target_sha256", rt.op("mul", "c", 64)],
            ["verdict", "INDETERMINATE"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    1
  );
  fmap = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-y-001.review.yaml"),
          rt.dict([
            ["target", "otp:y:001"],
            ["target_sha256", rt.op("mul", "c", 64)],
            ["verdict", "INDETERMINATE"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    2
  );
  rt.assert(
    !rt.truth(rt.get(rt.item(fmap, "prior"), "otp:y:001")),
    "a first-round landed INDET has no prior digests to cover"
  );
  rt.deleteItem(errors, rt.slice(undefined, undefined, undefined));
  b = rt.method(copy, "deepcopy", ic_full);
  rt.setItem(rt.item(b, "identity"), "supplies_identity", []);
  n = rt.invoke(len, errors);
  rt.invoke(check_ic, b, "self:unhashable_ic");
  rt.assert(rt.compare("gt", rt.invoke(len, errors), n), "unhashable tri-state must be a violation");
  rt.deleteItem(errors, rt.slice(n, undefined, undefined));
  dup_raised = false;
  try {
    rt.invoke(yload, "a: 1\na: 2\n");
  } catch (caught) {
    if (rt.catches(caught, Exception)) {
      dup_raised = true;
    } else {
      throw caught;
    }
  }
  rt.assert(dup_raised, "duplicate YAML keys must refuse to load");
  rt.assert(
    rt.compare(
      "eq",
      rt.invoke(yload, "a: 1\nb: 2\n"),
      rt.dict([
        ["a", 1],
        ["b", 2],
      ])
    ),
    "clean YAML loads"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(config_pair_occurs, "mode", "safe", rt.invoke(strip_comments_config, "mode: safe#prod\n", "a.yaml"))
    ),
    "yaml hash payload must be retained (no ws before #)"
  );
  rt.assert(
    rt.invoke(config_pair_occurs, "mode", "safe", rt.invoke(strip_comments_config, "mode: safe # note\n", "a.yaml")),
    "yaml whitespace-# comment strips"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "mode",
        "safe",
        rt.invoke(strip_comments_config, "mode=safe;prod\n", "a.properties")
      )
    ),
    "properties inline ; is payload"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "mode",
        "safe",
        rt.invoke(strip_comments_config, "mode=safe!prod\n", "a.properties")
      )
    ),
    "properties inline ! is payload"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(config_pair_occurs, "mode", "safe", rt.invoke(strip_comments_config, "; mode=safe\nlevel=x\n", "a.ini"))
    ),
    "ini line-start comment is a mention"
  );
  for (const loop108 of rt.iter(
    rt.tuple([
      "prefix{mode: safe\nmode: strict\n",
      "x,mode: safe\nmode: strict\n",
      'x"mode: safe\nmode: strict\n',
      "x'mode: safe\nmode: strict\n",
    ])
  )) {
    glued = loop108;
    rt.assert(
      !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", glued)),
      [
        "glued opener must not authenticate: ",
        rt.format(rt.item(glued, rt.slice(undefined, 12, undefined)), 114, null),
      ].join("")
    );
  }
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "level=strict ; mode=safe\n")),
    "mid-line bare key with unquoted value is payload"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe\n\n  extra\n")),
    "blank-line continuation"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe\n \n  extra\n")),
    "whitespace-blank-line continuation"
  );
  rt.assert(
    rt.invoke(config_pair_occurs, "mode", "safe", "mode: safe\n\nnext: x\n"),
    "honest blank line before a new key"
  );
  rt.assert(rt.compare("eq", rt.invoke(identity_expectation, "unresolved", true), "unresolved"), undefined);
  rt.assert(rt.compare("eq", rt.invoke(identity_expectation, true, "unresolved"), "unresolved"), undefined);
  rt.assert(rt.compare("eq", rt.invoke(identity_expectation, true, false), "supplies"), undefined);
  rt.assert(rt.compare("eq", rt.invoke(identity_expectation, false, true), "carries"), undefined);
  rt.assert(rt.compare("eq", rt.invoke(identity_expectation, false, false), "none"), undefined);
  tempfile = rt.module("tempfile");
  {
    const context109 = rt.enter(rt.method(tempfile, "TemporaryDirectory"));
    try {
      td = context109.value;
      td = rt.invoke(Path, td);
      rt.method(rt.op("div", td, "real"), "mkdir");
      rt.method(rt.op("div", rt.op("div", td, "real"), "x.yaml"), "write_text", "[]");
      rt.method(rt.op("div", td, "runs"), "symlink_to", rt.op("div", td, "real"));
      rt.assert(
        rt.compare("eq", rt.invoke(lexical_symlink_violations, td, "runs/x.yaml"), ["runs"]),
        "symlinked parent component must be rejected"
      );
      rt.assert(
        rt.compare("eq", rt.invoke(lexical_symlink_violations, td, "real/x.yaml"), []),
        "regular components pass"
      );
    } finally {
      context109.close();
    }
  }
  contextlib = rt.module("contextlib");
  io = rt.module("io");
  {
    const context113 = rt.enter(rt.method(tempfile, "TemporaryDirectory"));
    try {
      td = context113.value;
      td = rt.invoke(Path, td);
      rt.method(rt.op("div", td, "work"), "mkdir");
      man_p = rt.op("div", td, "work/run-manifest.yaml");
      rt.method(
        man_p,
        "write_bytes",
        rt.bytes([
          114, 117, 110, 95, 105, 100, 58, 32, 39, 111, 114, 117, 110, 45, 50, 48, 50, 54, 45, 48, 56, 45, 50, 57, 84,
          48, 48, 58, 48, 48, 58, 48, 48, 90, 39, 13, 10, 102, 105, 114, 115, 116, 95, 114, 117, 110, 58, 32, 116, 114,
          117, 101, 13, 10,
        ])
      );
      buf = rt.method(io, "StringIO");
      {
        const context110 = rt.enter(rt.method(contextlib, "redirect_stdout", buf));
        try {
          rc = rt.invoke(print_run_id, td);
        } finally {
          context110.close();
        }
      }
      rt.assert(
        rt.and(rt.compare("eq", rc, 0), () =>
          rt.compare("eq", rt.method(rt.method(buf, "getvalue"), "strip"), "orun-2026-08-29T00:00:00Z")
        ),
        "print-run-id must parse CRLF + single quotes cleanly"
      );
      rt.method(
        man_p,
        "write_bytes",
        rt.bytes([
          114, 117, 110, 95, 105, 100, 58, 32, 111, 114, 117, 110, 45, 50, 48, 50, 54, 45, 48, 56, 45, 50, 57, 84, 48,
          48, 58, 48, 48, 58, 48, 48, 90, 10, 114, 117, 110, 95, 105, 100, 58, 32, 111, 114, 117, 110, 45, 50, 48, 50,
          55, 45, 48, 49, 45, 48, 49, 84, 48, 48, 58, 48, 48, 58, 48, 48, 90, 10,
        ])
      );
      {
        const context111 = rt.enter(rt.method(contextlib, "redirect_stdout", rt.method(io, "StringIO")));
        try {
          rc = rt.invoke(print_run_id, td);
        } finally {
          context111.close();
        }
      }
      rt.assert(rt.compare("eq", rc, 1), "duplicate run_id must refuse rotation");
      rt.method(
        man_p,
        "write_bytes",
        rt.bytes([
          114, 117, 110, 95, 105, 100, 58, 32, 33, 33, 115, 116, 114, 32, 111, 114, 117, 110, 45, 50, 48, 50, 54, 45,
          48, 56, 45, 50, 57, 84, 48, 48, 58, 48, 48, 58, 48, 48, 90, 10,
        ])
      );
      buf = rt.method(io, "StringIO");
      {
        const context112 = rt.enter(rt.method(contextlib, "redirect_stdout", buf));
        try {
          rc = rt.invoke(print_run_id, td);
        } finally {
          context112.close();
        }
      }
      rt.assert(
        rt.and(rt.compare("eq", rc, 0), () =>
          rt.compare("eq", rt.method(rt.method(buf, "getvalue"), "strip"), "orun-2026-08-29T00:00:00Z")
        ),
        "tagged !!str run_id must parse"
      );
    } finally {
      context113.close();
    }
  }
  rt.assert(rt.invoke(valid_run_id, "orun-2026-08-29T00:00:00Z"), undefined);
  rt.assert(rt.invoke(valid_run_id, "orun-2026-08-29T00:00:00.5+02:00"), undefined);
  rt.assert(!rt.truth(rt.invoke(valid_run_id, "orun-2026-08-29/00:00:00")), "slash separator");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, "orun-2026-08-29 00:00:00")), "space separator");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, "orun-2026-08-29T00:00:00Z\t")), "edge whitespace");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, " orun-2026-08-29T00:00:00Z")), "edge whitespace");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, "orun-2026-08-29T00:00:00Z")), "C1 control");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, "orun-2026-08-29")), "date-only (closed grammar)");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, "orun-2026-99-99T00:00:00")), "shape, not a date");
  rt.assert(!rt.truth(rt.invoke(valid_run_id, 20260829)), "non-string");
  {
    const context115 = rt.enter(rt.method(tempfile, "TemporaryDirectory"));
    try {
      td = context115.value;
      td = rt.invoke(Path, td);
      rt.method(rt.op("div", td, "work"), "mkdir");
      rt.method(
        rt.op("div", td, "work/run-manifest.yaml"),
        "write_bytes",
        rt.bytes([
          114, 117, 110, 95, 105, 100, 58, 32, 34, 111, 114, 117, 110, 45, 50, 48, 50, 54, 45, 48, 56, 45, 50, 57, 84,
          48, 48, 58, 48, 48, 58, 48, 48, 90, 9, 34, 10,
        ])
      );
      {
        const context114 = rt.enter(rt.method(contextlib, "redirect_stdout", rt.method(io, "StringIO")));
        try {
          rt.assert(
            rt.compare("eq", rt.invoke(print_run_id, td), 1),
            "print-run-id must refuse what the gate refuses (no strip)"
          );
        } finally {
          context114.close();
        }
      }
    } finally {
      context115.close();
    }
  }
  man_hex = rt.method(copy, "deepcopy", good_manifest);
  rt.setItem(rt.item(rt.item(man_hex, "adapters"), 0), "script_sha256_12", 449203194793);
  rt.invoke(
    expect_msg,
    "adapter numeric sha12",
    "script_sha256_12 must be a lowercase",
    check_manifest,
    man_hex,
    "self:intsha_man"
  );
  man_hex = rt.method(copy, "deepcopy", good_manifest);
  rt.deleteItem(rt.item(man_hex, "scope_doc"), "sha256_12");
  rt.invoke(
    expect_msg,
    "scope sha12 missing",
    "scope_doc.sha256_12 is required",
    check_manifest,
    man_hex,
    "self:noscope_man"
  );
  b = rt.method(copy, "deepcopy", so);
  rt.setItem(rt.item(b, "source_span"), "content_sha256", rt.invoke(int, rt.op("mul", "9", 64)));
  rt.setItem(b, "id", rt.invoke(canonical_obs_id, "so", b));
  rt.invoke(expect_msg, "SO numeric content sha", "content_sha256 must be a lowercase", check_so, b, "self:intsha_so");
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "target_sha256", rt.invoke(int, rt.op("mul", "8", 64)));
  rt.invoke(expect_msg, "review numeric target sha", "must be 64 hex", check_review, b, "self:intsha_review");
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "alpha_mode", "safe", "alpha_mode\n=safe\n", "a.properties")),
    "cross-line separator (key)"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "alpha_mode", "safe", "alpha_mode=\nsafe\n", "a.properties")),
    "cross-line separator (value)"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "alpha_mode", "safe", 'alpha_mode="safe";prod\n', "a.ini")),
    "ini quoted-value ; is payload"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "alpha_mode", "safe", 'alpha_mode="safe"#prod\n', "a.properties")),
    "properties quoted-value # is payload"
  );
  rt.assert(
    !rt.truth(rt.invoke(config_pair_occurs, "mode", "safe", 'mode="safe"\n', "a.ini")),
    "ini quotes are payload; a bare claimed value cannot match quoted bytes"
  );
  rt.assert(
    rt.invoke(config_pair_occurs, "mode", '"safe"', 'mode="safe"\n', "a.ini"),
    "ini claim WITH quotes matches the raw bytes"
  );
  rt.assert(rt.invoke(config_pair_occurs, "mode", "safe", 'mode="safe"\n', "a.yaml"), "yaml quoted arm unaffected");
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "alpha_mode",
        "safe",
        rt.invoke(strip_comments_config, 'x=1# "alpha_mode"="safe"\nalpha_mode="strict"\n', "a.toml"),
        "a.toml"
      )
    ),
    "toml hash needs no preceding whitespace"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "alpha_mode",
        "safe",
        rt.invoke(strip_comments_config, '﻿# "alpha_mode": "safe"\nalpha_mode: strict\n', "a.yaml"),
        "a.yaml"
      )
    ),
    "BOM cannot shield a first-line comment"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "alpha_mode",
        "safe",
        rt.invoke(strip_comments_config, '\f! "alpha_mode"="safe"\nalpha_mode=strict\n', "a.properties"),
        "a.properties"
      )
    ),
    "form feed is Properties leading whitespace"
  );
  out = rt.invoke(
    cross_check_index,
    [
      rt.dict([
        ["observation", []],
        ["outcome", "proposed"],
        ["ref", "otp:Lease:001"],
      ]),
    ],
    "self:idx",
    rt.invoke(set),
    [],
    [],
    rt.invoke(set)
  );
  rt.invoke(expect_out, "unhashable index observation", "not a STRING id", out);
  out = rt.invoke(
    cross_check_chain,
    [],
    [
      rt.tuple([
        "self:dh",
        rt.dict([
          ["id", "dh:x:001"],
          ["observation_refs", [[]]],
        ]),
      ]),
    ],
    [],
    [],
    rt.invoke(set)
  );
  rt.invoke(expect_out, "unhashable DH ref", "not a STRING", out);
  out = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-ghost-999.review.yaml"),
          rt.dict([
            ["target", "otp:ghost:999"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    0
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-ghost-999.review.yaml"),
          rt.dict([
            ["target", "otp:ghost:999"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    1
  );
  _ = rt.item(
    rt.invoke(
      cross_check_review_binding,
      [
        rt.tuple([
          rt.invoke(P, "w/otp-ghost-999.review.yaml"),
          rt.dict([
            ["target", "otp:ghost:999"],
            ["target_sha256", rt.op("mul", "a", 64)],
            ["verdict", "PASS"],
          ]),
        ]),
      ],
      rt.dict([])
    ),
    2
  );
  rt.invoke(expect_out, "orphan review", "resolves to NO scanned proposal", out);
  out = rt.call(
    cross_check_rejections,
    [
      [],
      [
        rt.tuple([
          "self:rej",
          rt.dict([
            ["id", "rej:1"],
            ["proposal_ref", "otp:ghost:999"],
            ["rationale", rt.op("mul", "x", 30)],
          ]),
        ]),
      ],
    ],
    { otp_ids: rt.invoke(set) }
  );
  rt.invoke(expect_out, "ghost rejection", "no such proposal is in the scan", out);
  rt.invoke(expect_out, "unauthored rejection", "NO decision: reject ratification", out);
  out = rt.call(
    cross_check_rejections,
    [
      [
        rt.tuple([
          "self:rat",
          rt.dict([
            ["decision", "reject"],
            ["proposal_ref", "otp:Lease:001"],
          ]),
        ]),
      ],
      [
        rt.tuple([
          "self:rej1",
          rt.dict([
            ["proposal_ref", "otp:Lease:001"],
            ["rationale", rt.op("mul", "x", 30)],
          ]),
        ]),
        rt.tuple([
          "self:rej2",
          rt.dict([
            ["proposal_ref", "otp:Lease:001"],
            ["rationale", rt.op("mul", "y", 30)],
          ]),
        ]),
      ],
    ],
    { otp_ids: rt.set(["otp:Lease:001"]) }
  );
  rt.invoke(expect_out, "duplicate rejection rows", "DUPLICATE rejection-ledger row", out);
  out = rt.invoke(
    check_prior_rows,
    [
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "1", 64))],
        ["outcome", "unresolved"],
        ["needed_evidence", "registrar SME interview needed"],
        ["since", "2026-08-01"],
      ]),
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "1", 64))],
        ["outcome", "proposed"],
        ["ref", "otp:X:001"],
      ]),
      "scalar-row",
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "2", 64))],
        ["outcome", "not-an-outcome"],
        ["carried_from_prior", "true"],
        ["reason", 123],
      ]),
    ],
    "self:prior"
  );
  rt.invoke(expect_out, "prior duplicate row", "DUPLICATE row", out);
  rt.invoke(expect_out, "prior scalar row", "is not a mapping", out);
  rt.invoke(expect_out, "prior invalid outcome", "invalid/missing outcome", out);
  rt.invoke(expect_out, "prior string carried", "must be a BOOLEAN", out);
  rt.invoke(expect_out, "prior numeric reason", "reason must be a STRING", out);
  {
    const context116 = rt.enter(rt.method(tempfile, "TemporaryDirectory"));
    try {
      td = context116.value;
      td = rt.invoke(Path, td);
      rt.method(rt.op("div", td, "runs"), "symlink_to", rt.op("div", td, "runs"));
      n = rt.invoke(len, errors);
      res = rt.invoke(safe_join, td, "runs/x.yaml", "self:loop");
      rt.assert(
        rt.and(rt.compare("is", res, null), () => rt.compare("gt", rt.invoke(len, errors), n)),
        "symlink loop must be a violation, never a crash"
      );
      rt.deleteItem(errors, rt.slice(n, undefined, undefined));
      n = rt.invoke(len, errors);
      res = rt.invoke(safe_join, td, "nope/missing.yaml", "self:missing");
      rt.assert(
        rt.and(rt.compare("isnot", res, null), () => rt.compare("eq", rt.invoke(len, errors), n)),
        "a merely-missing path must still resolve via the lenient fallback"
      );
    } finally {
      context116.close();
    }
  }
  rt.assert(
    !rt.truth(
      rt.invoke(valid_run_id, rt.op("add", rt.op("add", "orun-2026-08-29T00:00:00.", rt.op("mul", "9", 300)), "Z"))
    ),
    "unbounded fraction is not archive-component-safe"
  );
  rt.assert(rt.invoke(valid_run_id, "orun-2026-08-29T00:00:00.123456789Z"), "9-digit fraction rotates");
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "alpha_mode",
        "safe",
        rt.invoke(strip_comments_config, 'alpha_mode: strict\r# "alpha_mode": "safe"\r', "a.yaml"),
        "a.yaml"
      )
    ),
    "CR-only line breaks cannot shield a comment"
  );
  rt.assert(
    rt.invoke(
      config_pair_occurs,
      "alpha_mode",
      "strict",
      rt.invoke(strip_comments_config, "alpha_mode: strict\r", "a.yaml"),
      "a.yaml"
    ),
    "honest CR-only pairing normalizes"
  );
  rt.assert(
    !rt.truth(
      rt.invoke(
        config_pair_occurs,
        "alpha_mode",
        '"safe',
        rt.invoke(strip_comments_config, 'alpha_mode = "safe#prod"\n', "a.toml"),
        "a.toml"
      )
    ),
    "a stripped half-quote cannot ride the unquoted arm"
  );
  rt.assert(
    rt.invoke(config_pair_occurs, "alpha_mode", '"safe', 'alpha_mode="safe\n', "a.properties"),
    "ini/properties quote-initial claims still match raw payload bytes"
  );
  so_l = rt.method(copy, "deepcopy", so);
  rt.setItem(so_l, "id", []);
  n = rt.invoke(len, errors);
  rt.invoke(check_so, so_l, "self:listid_so");
  rt.deleteItem(errors, rt.slice(n, undefined, undefined));
  obs_tbl = rt.set(
    rt.comprehend([so_l, so], (item: unknown) => {
      let d: unknown;
      d = item;
      return rt.truth(rt.truth(rt.compare("is", rt.invoke(type, rt.get(d, "id")), str))) ? rt.get(d, "id") : rt.skip;
    })
  );
  rt.assert(
    rt.and(rt.compare("in", rt.item(so, "id"), obs_tbl), () => rt.compare("eq", rt.invoke(len, obs_tbl), 1)),
    "filtered join tables drop malformed ids silently after diagnosis"
  );
  rt.assert(
    rt.and(rt.compare("is", rt.invoke(skey, []), null), () => rt.compare("eq", rt.invoke(skey, "x"), "x")),
    "skey filter"
  );
  out = rt.invoke(
    check_prior_rows,
    [
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "3", 64))],
        ["outcome", "unresolved"],
        ["needed_evidence", "registrar SME interview needed"],
        ["since", "2026-99-99"],
      ]),
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "4", 64))],
        ["outcome", "unresolved"],
        ["needed_evidence", "registrar SME interview needed"],
        ["since", "2099-01-01"],
      ]),
      rt.dict([
        ["observation", "not-an-id"],
        ["outcome", "irrelevant"],
        ["reason", "a substantive concrete reason here"],
      ]),
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "5", 64))],
        ["outcome", "irrelevant"],
        ["reason", "out of scope"],
      ]),
      rt.dict([
        ["observation", rt.op("add", "so:sha256:", rt.op("mul", "6", 64))],
        ["outcome", "proposed"],
        ["ref", "otp:X:001"],
        ["carried_from_prior", true],
      ]),
    ],
    "self:prior12"
  );
  rt.invoke(expect_out, "prior impossible date", "not a real date", out);
  rt.invoke(expect_out, "prior future date", "in the future", out);
  rt.invoke(expect_out, "prior id grammar", "does not match the", out);
  rt.invoke(expect_out, "prior trivial reason", "concrete", out);
  rt.invoke(expect_out, "prior carried-proposed", "carried row cannot be", out);
  rt.assert(
    rt.compare("eq", rt.invoke(safe_text, "ok \u001b[2J\nFAKE"), "ok \\x1b[2J\\x0aFAKE"),
    "authority strings render controls as visible escapes"
  );
  {
    const context117 = rt.enter(rt.method(tempfile, "TemporaryDirectory"));
    try {
      td = context117.value;
      td = rt.invoke(Path, td);
      overlong = rt.op("add", rt.op("add", "runs/", rt.op("mul", "x", 4000)), ".yaml");
      n = rt.invoke(len, errors);
      rt.invoke(lexical_symlink_violations, td, overlong);
      rt.invoke(safe_join, td, overlong, "self:enametoolong");
      try {
        rt.method(rt.op("div", td, overlong), "read_bytes");
        rt.assert(false, "overlong path read should fail");
      } catch (caught) {
        if (rt.catches(caught, OSError)) {
        } else {
          throw caught;
        }
      }
      rt.deleteItem(errors, rt.slice(n, undefined, undefined));
    } finally {
      context117.close();
    }
  }
  b = rt.method(copy, "deepcopy", good_dh);
  rt.setItem(b, "proposed_referent", 1);
  n = rt.invoke(len, errors);
  rt.invoke(check_dh, b, "self:scalarref_dh");
  rt.assert(
    rt.invoke(
      any,
      rt.comprehend(rt.item(errors, rt.slice(n, undefined, undefined)), (item: unknown) => {
        let e: unknown;
        e = item;
        return rt.compare("in", "proposed_referent must be a MAPPING", e);
      })
    ),
    undefined
  );
  rt.deleteItem(errors, rt.slice(n, undefined, undefined));
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "revision_requests", "fix it");
  rt.invoke(expect_msg, "revision_requests shape", "must be a LIST", check_review, b, "self:rrshape_review");
  b = rt.method(copy, "deepcopy", rev);
  rt.setItem(b, "revision_requests", ["tighten the identity criterion to enrollment"]);
  n = rt.invoke(len, errors);
  rt.invoke(check_review, b, "self:rrok_review");
  rt.assert(
    !rt.truth(rt.item(errors, rt.slice(n, undefined, undefined))),
    [
      "legal revision_requests must pass: ",
      rt.format(rt.item(errors, rt.slice(n, undefined, undefined)), -1, null),
    ].join("")
  );
  out = rt.call(
    cross_check_rejections,
    [
      [
        rt.tuple([
          "self:rat",
          rt.dict([
            ["decision", "reject"],
            ["proposal_ref", "otp:Lease:001"],
            ["rationale", "the steward's actual stated reason here"],
          ]),
        ]),
      ],
      [
        rt.tuple([
          "self:rej",
          rt.dict([
            ["proposal_ref", "otp:Lease:001"],
            ["rationale", "a different substituted reason nobody gave"],
          ]),
        ]),
      ],
    ],
    { otp_ids: rt.set(["otp:Lease:001"]) }
  );
  rt.invoke(expect_out, "ledger rationale binding", "steward's OWN reason", out);
  revs_split = [
    rt.tuple([
      rt.invoke(P, "w/otp-x-001.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "a", 64)],
        ["verdict", "FAIL"],
        [
          "attacks",
          [
            rt.dict([
              ["surface", "identity"],
              ["rule", "rule-a"],
              ["outcome", "landed"],
            ]),
            rt.dict([
              ["surface", "warrant"],
              ["rule", "rule-b"],
              ["outcome", "landed"],
            ]),
          ],
        ],
      ]),
    ]),
    rt.tuple([
      rt.invoke(P, "w/otp-x-001-r2.review.yaml"),
      rt.dict([
        ["target", "otp:x:001"],
        ["target_sha256", rt.op("mul", "b", 64)],
        ["verdict", "PASS"],
      ]),
    ]),
  ];
  otp_split = rt.dict([
    [
      "otp:x:001",
      rt.tuple([
        "self:otp",
        rt.dict([
          [
            "revision_log",
            [
              rt.dict([
                ["from_sha256", rt.op("mul", "a", 64)],
                ["addressed", ["rule-a"]],
              ]),
              rt.dict([
                ["from_sha256", rt.op("mul", "a", 64)],
                ["addressed", ["rule-b"]],
              ]),
            ],
          ],
        ]),
      ]),
    ],
  ]);
  out = rt.item(rt.invoke(cross_check_review_binding, revs_split, otp_split), 0);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs_split, otp_split), 1);
  _ = rt.item(rt.invoke(cross_check_review_binding, revs_split, otp_split), 2);
  rt.assert(
    !rt.truth(
      rt.invoke(
        any,
        rt.comprehend(out, (item: unknown) => {
          let m: unknown;
          m = item;
          return rt.compare("in", "does not address", m);
        })
      )
    ),
    "split revision_log entries for one digest must UNION, not last-win"
  );
  {
    const context118 = rt.enter(rt.method(tempfile, "TemporaryDirectory"));
    try {
      td = context118.value;
      td = rt.invoke(Path, td);
      rt.call(rt.attr(rt.op("div", td, "runs/orun-r.observations"), "mkdir"), [], { parents: true });
      rt.method(rt.op("div", td, "runs/orun-r.observations/so-poison.yaml"), "write_text", "id: x\n");
      rt.method(rt.op("div", td, "runs/orun-r.index.yaml"), "write_text", "[]\n");
      rt.method(rt.op("div", td, "runs/history"), "mkdir");
      rt.method(rt.op("div", td, "runs/history/ratification.schema.yaml"), "write_text", "a: 1\n");
      n = rt.invoke(len, errors);
      rt.invoke(validate_dir, td);
      msgs = rt.item(errors, rt.slice(n, undefined, undefined));
      rt.assert(
        rt.invoke(
          any,
          rt.comprehend(msgs, (item: unknown) => {
            let m: unknown;
            m = item;
            return rt.and(rt.compare("in", "NOT live evidence", m), () => rt.compare("in", "so-poison", m));
          })
        ),
        "record-prefixed file under runs/ must be a LOUD violation"
      );
      rt.assert(
        !rt.truth(
          rt.invoke(
            any,
            rt.comprehend(msgs, (item: unknown) => {
              let m: unknown;
              m = item;
              return rt.compare("in", "orun-r.index.yaml", m);
            })
          )
        ),
        "rotation-ledger files under runs/ are not live records"
      );
      rt.assert(
        !rt.truth(
          rt.invoke(
            any,
            rt.comprehend(msgs, (item: unknown) => {
              let m: unknown;
              m = item;
              return rt.compare("in", "ratification.schema.yaml", m);
            })
          )
        ),
        "engine-history files under runs/ are not record-prefixed"
      );
      rt.deleteItem(errors, rt.slice(n, undefined, undefined));
    } finally {
      context118.close();
    }
  }
  effort_man = rt.method(copy, "deepcopy", good_manifest);
  for (const loop119 of rt.iter(PROMPT_ROLES)) {
    role = loop119;
    b = rt.method(copy, "deepcopy", effort_man);
    rt.deleteItem(rt.item(rt.item(b, "agents"), role), "effort");
    rt.invoke(
      expect_msg,
      "seat-effort provenance missing",
      ["agents.", rt.format(role, -1, null), ".effort"].join(""),
      check_manifest,
      b,
      "self:missingeffort_man"
    );
    for (const loop120 of rt.iter(rt.tuple(["", " \t\n", 1, true]))) {
      bad = loop120;
      b = rt.method(copy, "deepcopy", effort_man);
      rt.setItem(rt.item(rt.item(b, "agents"), role), "effort", bad);
      rt.invoke(
        expect_msg,
        "seat-effort provenance invalid",
        ["agents.", rt.format(role, -1, null), ".effort"].join(""),
        check_manifest,
        b,
        "self:badeffort_man"
      );
    }
    for (const loop121 of rt.iter(rt.tuple(["max", "xhigh", "medium", "default"]))) {
      good = loop121;
      b = rt.method(copy, "deepcopy", effort_man);
      rt.setItem(rt.item(rt.item(b, "agents"), role), "effort", good);
      n = rt.invoke(len, errors);
      rt.invoke(check_manifest, b, "self:goodeffort_man");
      rt.assert(
        !rt.truth(rt.item(errors, rt.slice(n, undefined, undefined))),
        ["legal seat effort must pass: ", rt.format(rt.item(errors, rt.slice(n, undefined, undefined)), -1, null)].join(
          ""
        )
      );
      rt.deleteItem(errors, rt.slice(n, undefined, undefined));
    }
  }
  rt.invoke(
    print,
    "SELF-TEST PASS (rule families fire: canonical ids, nested closure, object grammar, mixed-unrep, discriminator, searched-true, warrant-XOR, parents grammar, id grammars incl. rat digits, crash-hardening, rat content binding + staleness + freshness, review edge-target/chain/history/continuity/revision_log incl. landed-rule join + duplicate rounds, chain cross-wire + verdict join, carried authentication + live-carried bypass, row-evidence join, since-exact, digest-fresh IRI, identifier pad + negation context + provider agreement incl. boolean-vs-unresolved, boolean pin_waived, ufo_category required, addressed-list shape, #-boundary, config pairing, vacuity-boolean, text exact-type sweep, container shapes, prior-FAIL coverage population, tri-state crash hardening, duplicate-key loader, syntax-aware pairing stripper, glued openers, mid-line bare keys, blank-line continuation, identity precedence, lexical component symlinks, run-id parser, closed shared run-id grammar + rotation parity, exact-hex digest locks, cross-line separator refusal, ini/properties quoted-payload, toml/BOM/form-feed comment boundaries, join quarantine, orphan review/rejection authority, predecessor-local row validation, symlink-loop fail-closed, bounded run-id fractions, CR line-break normalization, half-quote arm refusal, table-filter quarantine, predecessor date/grammar/reason/carried meters, control-escaped authority rendering, unexaminable-path fail-closed, referent-mapping guard, review revision-requests channel, ledger-rationale binding, revision-log digest union, closure-read fail-closed, runs-shelter poison guard, seat-effort provenance)"
  );
  return null;
});
print_run_id = rt.fn("print_run_id", (args, kwargs) => {
  let d: unknown;
  let ex: unknown;
  let man: unknown;
  let ont_root: unknown;
  let rid: unknown;
  ont_root = rt.argument(args, kwargs, 0, "ont_root", undefined);
  man = rt.op("div", rt.invoke(Path, ont_root), "work/run-manifest.yaml");
  try {
    d = rt.invoke(yload, rt.method(man, "read_bytes"));
  } catch (caught) {
    if (rt.catches(caught, Exception)) {
      ex = caught;
      reportUnreadableManifest(rt.format(ex, -1, null), (message, stderr) => {
        rt.call(print, [message], stderr ? { file: rt.attr(sys, "stderr") } : {});
      });
      return 1;
    } else {
      throw caught;
    }
  }
  rid = rt.truth(rt.invoke(isinstance, d, dict)) ? rt.get(d, "run_id") : null;
  if (rt.truth(!rt.truth(rt.invoke(valid_run_id, rid)))) {
    rt.call(
      print,
      [
        [
          "refusing: run_id ",
          rt.format(rid, 114, null),
          " does not match the closed shared grammar orun-YYYY-MM-DDTHH:MM:SS[.f][Z|±HH:MM]",
        ].join(""),
      ],
      { file: rt.attr(sys, "stderr") }
    );
    return 1;
  }
  rt.invoke(print, rid);
  return 0;
  return null;
});
rt.boundary(() => {
  if (import.meta.main) {
    const status = runArgumentBoundary(process.argv.slice(2), __doc__, {
      selfTest: () => {
        rt.invoke(self_test);
      },
      printRunId: (root) => Number(rt.invoke(print_run_id, root)),
      writeUsage: (message, stderr) => {
        rt.call(print, [message], stderr ? { file: rt.attr(sys, "stderr") } : {});
      },
      validate: (root, options) => {
        rt.call(validate_dir, [rt.invoke(Path, root)], options);
      },
    });
    if (status !== undefined) {
      process.exitCode = status;
      return;
    }
    for (const flag of rt.iter(flags)) rt.invoke(print, renderFlag(rt.format(flag, -1, null)));
    if (rt.truth(errors)) {
      rt.invoke(print, `VIOLATIONS (${rt.iter(errors).length}):`);
      for (const error of rt.iter(errors)) rt.invoke(print, renderDiagnostic(rt.format(error, -1, null)));
      process.exitCode = 1;
      return;
    }
    rt.invoke(
      print,
      "ARTIFACTS VALID" + (process.argv.includes("--gate") ? " — GATE PASSED (flags above go to the steward)" : "")
    );
  }
});
export { self_test, validate_dir, print_run_id, rt };
