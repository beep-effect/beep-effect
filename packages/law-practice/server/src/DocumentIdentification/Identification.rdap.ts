/**
 * Organisation-only RDAP adapter.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  DomainRegistrantLookup,
  DomainRegistrantLookupShape,
  IdentificationError,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import { HttpClient } from "effect/http";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const RdapResponse = S.Struct({
  entities: S.Unknown.pipe(S.Array, S.optionalKey),
  redacted: S.Unknown.pipe(S.Array, S.optionalKey),
});
const RdapEntity = S.Struct({
  roles: S.String.pipe(S.Array, S.optionalKey),
  entities: S.Unknown.pipe(S.Array, S.optionalKey),
  vcardArray: S.optionalKey(S.Tuple([S.String, S.Array(S.Tuple([S.String, S.Unknown, S.String, S.Unknown]))])),
});
const invalid = () => IdentificationError.make({ operation: "rdap-decode", reason: "invalid-input" });
const redactedName = /redact|privacy|withheld|not disclosed|data protected/iu;
const registrantNames = (entity: typeof RdapEntity.Type): ReadonlyArray<string> => {
  if (!A.contains(entity.roles ?? [], "registrant")) return [];
  const rows = entity.vcardArray?.[1] ?? [];
  const values = (key: string) =>
    A.getSomes(
      A.map(
        A.filter(rows, (r) => r[0] === key),
        (r) => (P.isString(r[3]) ? O.some(r[3]) : O.none())
      )
    );
  const corporateName = A.contains(values("kind"), "org") ? values("fn") : [];
  return A.filter(A.map([...values("org"), ...corporateName], Str.trim), (s) => s.length > 0 && !redactedName.test(s));
};
const orgs = Effect.fn("Identification.rdapEntities")(function* (
  entities: ReadonlyArray<unknown>
): Effect.fn.Return<ReadonlyArray<string>, IdentificationError> {
  const results: Array<string> = [];
  for (const value of entities) {
    const entity = yield* S.decodeUnknownEffect(RdapEntity)(value).pipe(Effect.mapError(invalid));
    results.push(...registrantNames(entity), ...(yield* orgs(entity.entities ?? [])));
  }
  return results;
});
/**
 * Decodes an RDAP response to an organisation registrant, returning None for redacted or personal data.
 * **Example** (Ignore a redacted registration)
 *
 * ```ts
 * import { registrantFromRdap } from "@beep/law-practice-server/DocumentIdentification"
 * import { Effect, Option } from "effect"
 * console.log(Option.isNone(Effect.runSync(registrantFromRdap({ entities: [] })))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const registrantFromRdap = Effect.fn("Identification.registrantFromRdap")(function* (input: unknown) {
  const response = yield* S.decodeUnknownEffect(RdapResponse)(input).pipe(Effect.mapError(invalid));
  if ((response.redacted?.length ?? 0) > 0) return O.none<string>();
  const names = A.dedupe(yield* orgs(response.entities ?? []));
  return names.length === 1 ? A.head(names) : O.none<string>();
});
const makeDomainRegistrantLookupLive = Effect.fn("DocumentIdentification.Identification.rdap.make")(function* () {
  const http = yield* HttpClient.HttpClient;
  return DomainRegistrantLookupShape.make({
    registrant: Effect.fn("Identification.registrant")(function* (domain: string) {
      const d = Str.toLowerCase(Str.trim(domain));
      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(d))
        return yield* IdentificationError.make({ operation: "rdap-query", reason: "invalid-input" });
      const response = yield* http
        .get(`https://rdap.org/domain/${d}`)
        .pipe(Effect.mapError(() => IdentificationError.make({ operation: "rdap-query", reason: "unavailable" })));
      if (response.status === 404) return O.none<string>();
      if (response.status < 200 || response.status >= 300)
        return yield* IdentificationError.make({ operation: "rdap-query", reason: "unavailable" });
      return yield* registrantFromRdap(yield* response.json.pipe(Effect.mapError(invalid)));
    }),
  });
});

/**
 * Queries rdap.org for an explicitly supplied organisation domain; no document content is sent.
 * Registration answers remain opt-in and are never default resolver evidence.
 * **Example** (Inspect the RDAP layer)
 *
 * ```ts
 * import { DomainRegistrantLookupLive } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(DomainRegistrantLookupLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DomainRegistrantLookupLive = Layer.effect(DomainRegistrantLookup, makeDomainRegistrantLookupLive());
