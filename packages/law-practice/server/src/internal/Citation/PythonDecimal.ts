/** Frozen Python Unicode 14 decimal values shared by resolver and metadata.
 * Observed facts from the pinned CPython oracle; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Tuple from "effect/Tuple";
import { citationPythonTextData } from "./PythonTextData.ts";

/** Source decimal code points in their independently captured value order.
 * @internal @category constants @since 0.0.0
 */
export const citationPythonDecimalValues = HashMap.fromIterable(
  A.map(A.fromIterable(citationPythonTextData.decimalDigits), (char, index) => Tuple.make(char, index % 10))
);
