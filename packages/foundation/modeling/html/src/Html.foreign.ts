/**
 * Browser fixed-point checks for opaque SVG and MathML nodes.
 *
 * The HTML tokenizer lowercases foreign tag and attribute names before the
 * tree builder applies the generated WHATWG adjustment tables. Canonical
 * serialization therefore accepts exactly the names that survive that
 * round-trip unchanged.
 *
 * @packageDocumentation \@beep/html/Html.foreign
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import * as Str from "effect/String";
import {
  MATHML_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ELEMENT_NAME_ADJUSTMENTS,
  XML_FOREIGN_ATTRIBUTE_NAMES,
} from "./Html.meta.ts";
import type { ForeignNamespace } from "./Html.model.ts";

const browserAdjustedName = (name: string, adjustments: Readonly<Record<string, string>>): string => {
  const lowercase = Str.toLowerCase(name);
  return adjustments[lowercase] ?? lowercase;
};

/**
 * Tests whether an opaque foreign element name is unchanged by HTML parsing.
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isForeignElementNameFixedPoint = (namespace: ForeignNamespace, name: string): boolean =>
  name === browserAdjustedName(name, namespace === "svg" ? SVG_ELEMENT_NAME_ADJUSTMENTS : {});

/**
 * Tests whether an opaque foreign attribute name is unchanged by HTML parsing.
 *
 * Qualified XML, XMLNS, and XLink names are restricted to the WHATWG
 * adjustment registry because the AST does not separately store namespace
 * metadata for arbitrary colon-prefixed attributes.
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isForeignAttributeNameFixedPoint = (namespace: ForeignNamespace, name: string): boolean => {
  const lowercase = Str.toLowerCase(name);
  if (Str.includes(":")(name) || lowercase === "xmlns") {
    return name === lowercase && A.contains(XML_FOREIGN_ATTRIBUTE_NAMES, lowercase);
  }
  const adjustments = namespace === "svg" ? SVG_ATTRIBUTE_NAME_ADJUSTMENTS : MATHML_ATTRIBUTE_NAME_ADJUSTMENTS;
  return name === browserAdjustedName(name, adjustments);
};
