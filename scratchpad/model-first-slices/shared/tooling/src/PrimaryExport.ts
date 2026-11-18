import * as A from "@beep/utils/Array";
import * as Context from "effect/Context";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";
import { isRejectionClass } from "./RejectionClass.ts";

/**
 * A file that breaks the primary-export law, and how.
 *
 * @category models
 * @since 0.0.0
 */
export const PrimaryExportViolation = S.Struct({ file: S.String, kind: S.String, problem: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type PrimaryExportViolation = typeof PrimaryExportViolation.Type;

type Value = unknown;
const domain = (...kinds: ReadonlyArray<string>) => (value: Value) =>
  P.hasProperty(value, "kind") && A.contains(kinds, String(value.kind));
const isLayer = (value: Value) => Layer.isLayer(value);
const isService = (value: Value) => Context.isKey(value);
const isSchema = (value: Value) => S.isSchema(value);
const isFunction = (value: Value) => P.isFunction(value);
const isObject = (value: Value) => P.isObject(value);

/** How a kind designates its primary export: by name from the noun, or by a rule. */
interface Rule {
  /** The primary's name, from the file's noun; `undefined` to pick the one export `matches` names. */
  readonly name?: (noun: string, exports: Readonly<Record<string, unknown>>) => string;
  /** For a kind without a fixed name: does this export name designate the primary? */
  readonly matches?: (noun: string, exported: string) => boolean;
  /** Is the value of the kind? */
  readonly is: (value: Value) => boolean;
  /** When set, at most one export may be of this kind (the primary): companions are other kinds. */
  readonly onlyOne?: boolean;
  /** Further exports the kind requires. */
  readonly requires?: ReadonlyArray<string>;
}

const noun = (suffix: string) => (n: string) => `${n}${suffix}`;
const apiTo = (suffix: string) => (n: string) => pipe(n, Str.replace(/Api$/, suffix));
const lowerFirst = (n: string) => `${pipe(n, Str.takeLeft(1), Str.toLowerCase)}${pipe(n, Str.slice(1))}`;

/**
 * The law, per role suffix (D8; Astra "Wrong on the merits" 9): each
 * `<Noun>.<kind>.ts` file has one designated primary export of its kind,
 * named from the noun; companions of other kinds (a command file's events
 * and rejections) are allowed.
 *
 * @category rules
 * @since 0.0.0
 */
export const rules: Readonly<Record<string, Rule>> = {
  aggregate: { name: noun(""), is: domain("Aggregate"), onlyOne: true },
  command: { name: noun(""), is: domain("Command"), onlyOne: true },
  event: { name: noun(""), is: domain("Event"), onlyOne: true },
  // A rejection is a tagged error class (`S.TaggedError`), which is what a command's `rejects` takes.
  rejection: { name: noun(""), is: isRejectionClass, onlyOne: true },
  view: { name: noun(""), is: domain("View"), onlyOne: true },
  policy: { name: noun(""), is: domain("Policy"), onlyOne: true },
  saga: { name: noun(""), is: domain("Saga"), onlyOne: true },
  projection: { name: noun(""), is: domain("Projection"), onlyOne: true },
  stream: { name: noun(""), is: domain("Stream"), onlyOne: true },
  query: { name: noun(""), is: domain("Query"), onlyOne: true },
  external: { name: noun(""), is: domain("ExternalSystem"), onlyOne: true },
  api: { name: noun(""), is: domain("Api"), onlyOne: true },
  contract: { name: apiTo("Contract"), is: domain("Api"), onlyOne: true },
  http: { name: apiTo("Http"), is: isObject },
  catalog: { name: noun("Catalog"), is: domain("Model"), onlyOne: true },
  model: { name: noun("Model"), is: domain("Model"), onlyOne: true },
  read: { name: noun("Read"), is: domain("View", "Query"), onlyOne: true },
  // A model's handler is a Layer; a cluster process's may be a Layer factory (`mailboxPollerLive`).
  handler: {
    name: (n, exports) => (R.has(exports, `${n}Live`) ? `${n}Live` : `${lowerFirst(n)}Live`),
    is: (value) => isLayer(value) || isFunction(value),
  },
  handlers: { name: noun("Handlers"), is: isLayer },
  ports: { name: noun("Hosted"), is: isLayer },
  adapter: {
    matches: (n, exported) =>
      Str.endsWith(Str.toLowerCase(n))(Str.toLowerCase(exported)) ||
      Str.endsWith(`${Str.toLowerCase(n)}live`)(Str.toLowerCase(exported)),
    is: (value) => isLayer(value) || isFunction(value),
  },
  store: { name: noun("Store"), is: isService },
  gateway: { matches: (n, exported) => Str.startsWith(n)(exported), is: isService },
  inbox: { name: noun("Inbox"), is: isService },
  context: { name: noun(""), is: isService },
  middleware: { name: noun(""), is: isFunction },
  id: { name: noun("Id"), is: isSchema },
  fact: { name: noun(""), is: (value) => P.hasProperty(value, "versions") },
  capabilities: { name: noun("Capabilities"), is: A.isArray },
  descriptor: { name: noun("Deployment"), is: (value) => P.hasProperty(value, "context") },
  cluster: { name: noun("Cluster"), is: isFunction },
  route: { name: (n) => `${lowerFirst(n)}Route`, is: isObject },
  singleton: { name: noun(""), is: isFunction },
  machine: { name: () => "update", is: isFunction, requires: ["Screen", "Message"] },
  controller: { name: (n) => `make${n}Controller`, is: isFunction },
  screen: { name: noun("Screen"), is: isFunction },
  bindings: { name: noun("Bindings"), is: isObject },
  runtime: { name: (n) => `${lowerFirst(n)}Runtime`, is: isObject },
  // A host's SQL tables, derived from its row models; and the generated record of its committed migrations.
  table: { name: noun("Tables"), is: isObject },
  migrations: { name: noun("Migrations"), is: isObject },
};

/**
 * Kinds with no primary by design, each with why. The checker reports them
 * rather than skipping them silently.
 *
 * @category rules
 * @since 0.0.0
 */
export const exempt: Readonly<Record<string, string>> = {
  rules: "a bag of pure guard functions `decide` composes; no one of them is the file's subject",
  schema: "a host's Drizzle schema module: drizzle-kit reads every table it exports by name, and no one table is the file's subject",
};

/**
 * The violations of one module, given its file name and its exports.
 *
 * **Example** (Two commands in one command file)
 * ```ts
 * import { violationsOf } from "@proto/tooling/PrimaryExport";
 *
 * const found = violationsOf("Foo.command.ts", { Foo: { kind: "Command" }, Bar: { kind: "Command" } });
 * ```
 *
 * @category checks
 * @since 0.0.0
 */
export const violationsOf: {
  (exports: Readonly<Record<string, unknown>>): (file: string) => ReadonlyArray<PrimaryExportViolation>;
  (file: string, exports: Readonly<Record<string, unknown>>): ReadonlyArray<PrimaryExportViolation>;
} = dual(2, (file: string, exports: Readonly<Record<string, unknown>>): ReadonlyArray<PrimaryExportViolation> => {
    const base = pipe(file, Str.split("/"), A.last, O.getOrElse(() => file));
    const parts = pipe(base, Str.split("."));
    if (parts.length < 3) return [];
    const kind = parts[parts.length - 2]!;
    const n = parts[0]!;
    if (R.has(exempt, kind)) return [];
    const violation = (problem: string) => [{ file, kind, problem }];
    const rule = R.get(rules, kind);
    if (O.isNone(rule)) return violation(`unknown kind "${kind}": add a rule or an exemption`);
    const { name, matches, is, onlyOne, requires } = rule.value;
    const names = R.keys(exports);
    const designated =
      name !== undefined ? A.filter(names, (e) => e === name(n, exports)) : A.filter(names, (e) => matches?.(n, e) ?? false);
    const primary = A.filter(designated, (e) => is(exports[e]));
    return [
      ...(primary.length === 1
        ? []
        : violation(
            primary.length === 0
              ? `no primary export ${name !== undefined ? `"${name(n, exports)}"` : "matching the noun"} of kind ${kind}`
              : `${primary.length} exports could be the primary: ${A.join(primary, ", ")}`,
          )),
      ...(onlyOne === true && A.filter(names, (e) => is(exports[e])).length > 1
        ? violation(`more than one export of kind ${kind}: ${A.join(A.filter(names, (e) => is(exports[e])), ", ")}`)
        : []),
      ...A.flatMap(requires ?? [], (required) => (R.has(exports, required) ? [] : violation(`missing required export ${required}`))),
    ];
});
