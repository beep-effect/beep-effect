import { Ajv } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats.js";
import * as A from "effect/Array";
import BOM_SCHEMA from "../fixtures/bom-1.6.SNAPSHOT.schema.json" with { type: "json" };
import JSF_SCHEMA from "../fixtures/jsf-0.82.SNAPSHOT.schema.json" with { type: "json" };
import SPDX_SCHEMA from "../fixtures/spdx.SNAPSHOT.schema.json" with { type: "json" };

const unimplementedFormatsAcceptAll = { "idn-email": true, "iri-reference": true } as const;
const spdxUriTheBomRefResolvesTo = "http://cyclonedx.org/schema/spdx.SNAPSHOT.schema.json";
const jsfUriTheBomRefResolvesTo = "http://cyclonedx.org/schema/jsf-0.82.SNAPSHOT.schema.json";

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  formats: { ...fullFormats, ...unimplementedFormatsAcceptAll },
});
ajv.addSchema(SPDX_SCHEMA, spdxUriTheBomRefResolvesTo);
ajv.addSchema(JSF_SCHEMA, jsfUriTheBomRefResolvesTo);
const validate = ajv.compile(BOM_SCHEMA);

// decision: conformance-against-the-vendored-schema
/** The full-schema violations of one emitted document, as `<instancePath> <keyword>` lines; empty when valid. */
export const cycloneDxViolations = (document: unknown): ReadonlyArray<string> =>
  validate(document) ? [] : A.map(validate.errors ?? [], (error) => `${error.instancePath} ${error.keyword}`);
