/** Bounded canonical ownership evidence for explicit never-enrolled expiry. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { hashPublicTextSha256 } from "../privacy.ts";

const $I = $RepoAiMetricsId.create("internal/unenrolled-evidence");
/** Summary of canonical native identities that never entered the delivery ledger. */
export class CanonicalOwnershipSummary extends S.Opaque<CanonicalOwnershipSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    count: S.Natural.check(S.isLessThanOrEqualTo(4096)),
    digest: Sha256Hex,
  }).pipe(
    $I.annoteSchema("CanonicalOwnershipSummary", {
      description: "Count and checksum of a domain-separated canonical identity set owned by one receipt.",
    })
  )
) {}
const OwnershipRow = S.Struct({
  eventId: Sha256Hex,
  payloadHash: Sha256Hex,
  spanIndex: S.Natural,
  enrolledHash: S.NullOr(Sha256Hex),
}).pipe(
  $I.annoteSchema("OwnershipRow", { description: "Bounded native canonical index joined with delivery membership." })
);
const encodeOwnershipRowsJson = OwnershipRow.pipe(S.Array, S.fromJsonString, S.encodeEffect);
const decodeOwnershipRowRows = S.decodeUnknownEffect(S.Array(OwnershipRow).check(S.isMaxLength(4096)));

/** Caller must validate retained payload against this index before disposing it. */
export const readUnenrolledNativeOwnership = Effect.fn("AiMetrics.readUnenrolledNativeOwnership")(function* (
  receiptId: Sha256Hex
) {
  const sql = yield* SqlClient.SqlClient;
  const rows =
    yield* sql`SELECT n.event_id AS "eventId",n.payload_hash AS "payloadHash",n.span_index AS "spanIndex",e.payload_hash AS "enrolledHash" FROM observation_native_events n LEFT JOIN observation_delivery_events e ON e.event_id=n.event_id WHERE n.receipt_id=${receiptId} ORDER BY n.event_id LIMIT 4097`.pipe(
      Effect.flatMap(decodeOwnershipRowRows)
    );
  if (A.some(rows, (row) => row.enrolledHash !== null && row.enrolledHash !== row.payloadHash))
    return yield* Effect.fail("native-membership-conflict");
  const missing = A.filter(rows, (row) => row.enrolledHash === null);
  const payload = yield* encodeOwnershipRowsJson(missing);
  return CanonicalOwnershipSummary.make({
    count: missing.length,
    digest: yield* hashPublicTextSha256(`unenrolled-native/v1:${receiptId}:${payload}`),
  });
});

const EnrolledOwnershipRow = S.Struct({ eventId: Sha256Hex, payloadHash: Sha256Hex }).pipe(
  $I.annoteSchema("EnrolledOwnershipRow", { description: "Canonical enrolled identity and metadata hash." })
);
const encodeEnrolledOwnershipRowsJson = EnrolledOwnershipRow.pipe(S.Array, S.fromJsonString, S.encodeEffect);
const decodeEnrolledOwnershipRowRows = S.decodeUnknownEffect(S.Array(EnrolledOwnershipRow).check(S.isMaxLength(4096)));

/** Canonical enrolled ownership; references owned by another receipt are excluded. */
export const readEnrolledOwnership = Effect.fn("AiMetrics.readEnrolledOwnership")(function* (receiptId: Sha256Hex) {
  const sql = yield* SqlClient.SqlClient;
  const rows =
    yield* sql`SELECT event_id AS "eventId",payload_hash AS "payloadHash" FROM observation_delivery_events WHERE receipt_id=${receiptId} ORDER BY event_id LIMIT 4097`.pipe(
      Effect.flatMap(decodeEnrolledOwnershipRowRows)
    );
  const payload = yield* encodeEnrolledOwnershipRowsJson(rows);
  return CanonicalOwnershipSummary.make({
    count: rows.length,
    digest: yield* hashPublicTextSha256(`enrolled-ownership/v1:${receiptId}:${payload}`),
  });
});
