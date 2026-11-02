// Readers for the workflow and action YAML the CI policy tests inspect. The
// files are parsed with `effect/encoding/Yaml` (the reader the repo-cli
// workflow sites use), and values are read by path the way a document `getIn`
// would: an absent key or index reads as `undefined`.

import * as A from "effect/Array";
import * as Yaml from "effect/encoding/Yaml";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";

/** Parse one YAML document into its plain value. Malformed YAML throws, failing the case. */
export const parseWorkflowYaml = (text: string): unknown => Yaml.parse(text);

/** The value at `path` inside a parsed document, or `undefined` when any segment is absent. */
export const yamlAt: {
  (path: ReadonlyArray<string | number>): (value: unknown) => unknown;
  (value: unknown, path: ReadonlyArray<string | number>): unknown;
} = dual(2, (value: unknown, path: ReadonlyArray<string | number>): unknown =>
  A.reduce(path, value, (node, segment) => (P.isObjectOrArray(node) ? Reflect.get(node, segment) : undefined))
);
