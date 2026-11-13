import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Formatter from "effect/Formatter";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AttachmentMetadata,
  AttachmentReference,
  AttachmentUpload,
  Filename,
  MediaType,
  SizeBytes,
} from "../src/Attachment/index.ts";
import {
  CipherChannelRid,
  CipherChannelStrategy,
  CipherText,
  DecryptionResult,
  EncryptionRequest,
  EncryptionResult,
  Plaintext,
} from "../src/CipherText/index.ts";
import {
  AttachmentRid,
  MarkingId,
  MediaItemRid,
  MediaSetRid,
  MediaSetViewRid,
} from "../src/Identifier/Identifier.model.ts";
import {
  MediaItemLocator,
  MediaItemReadToken,
  MediaReference,
  MediaSetViewItem,
  MediaUploadRequest,
} from "../src/Media/index.ts";
import {
  ConjunctiveMarkings,
  DisjunctiveMarkings,
  ErrorComputingSecurity,
  PropertyMarkings,
  PropertySecurities,
  PropertySecurity,
  SecuredValue,
  UnsupportedPolicy,
} from "../src/Security/index.ts";

// ---------------------------------------------------------------------------
// Shared laws: (a) generated values satisfy the guard, (b) encode then decode is equivalent
// ---------------------------------------------------------------------------

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const arbitrary = Arbitrary.schema(schema);
  const is = S.is(schema);
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [arbitrary], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalence(decoded, value));
    }),
    { arbitrary: fcRuns(50) }
  );
};

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

const attachmentRid = "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f";

describe("Attachment", () => {
  lawful("Filename", Filename);
  lawful("MediaType", MediaType);
  lawful("SizeBytes", SizeBytes);
  lawful("AttachmentReference", AttachmentReference);
  lawful("AttachmentMetadata", AttachmentMetadata);
  lawful("AttachmentUpload", AttachmentUpload);

  it.effect(
    "decodes the attachment property value and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof AttachmentReference.Encoded = { rid: attachmentRid };
      const decoded = yield* S.decodeEffect(AttachmentReference)(wire);
      const expected = AttachmentReference.make({ rid: AttachmentRid.make(attachmentRid) });
      assertTrue(S.toEquivalence(AttachmentReference)(decoded, expected));
      const encoded = yield* S.encodeEffect(AttachmentReference)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes attachment metadata, turning the size string into a bigint, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof AttachmentMetadata.Encoded = {
        rid: attachmentRid,
        filename: "my-file.txt",
        sizeBytes: "393469",
        mediaType: "application/pdf",
      };
      const decoded = yield* S.decodeEffect(AttachmentMetadata)(wire);
      const expected = AttachmentMetadata.make({
        rid: AttachmentRid.make(attachmentRid),
        filename: Filename.make("my-file.txt"),
        sizeBytes: SizeBytes.make(BigInt(393469)),
        mediaType: MediaType.make("application/pdf"),
      });
      assertTrue(S.toEquivalence(AttachmentMetadata)(decoded, expected));
      strictEqual(decoded.sizeBytes, SizeBytes.make(BigInt(393469)));
      const encoded = yield* S.encodeEffect(AttachmentMetadata)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "keeps every digit of a size beyond the safe integer range",
    Effect.fnUntraced(function* () {
      const wire = "9007199254740993";
      const decoded = yield* S.decodeEffect(SizeBytes)(wire);
      strictEqual(decoded, SizeBytes.make(BigInt(wire)));
      const encoded = yield* S.encodeEffect(SizeBytes)(decoded);
      strictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects sizes that are negative, fractional or not numbers, and empty descriptors",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(SizeBytes)("-1"),
        rejects(SizeBytes)("12.5"),
        rejects(SizeBytes)("large"),
        rejects(SizeBytes)(393469),
        rejects(Filename)(""),
        rejects(MediaType)(""),
        rejects(AttachmentReference)({ rid: "" }),
        rejects(AttachmentReference)(attachmentRid),
        rejects(AttachmentMetadata)({ rid: attachmentRid, filename: "a.txt", sizeBytes: 1, mediaType: "text/plain" }),
        rejects(AttachmentUpload)({ name: "a.txt" }),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true, true, true, true, true, true, true]);
    })
  );

  it.effect(
    "accepts a zero-byte file",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(SizeBytes)("0");
      strictEqual(decoded, SizeBytes.make(BigInt(0)));
    })
  );

  it("constructs upload metadata from a file name", () => {
    const upload = AttachmentUpload.make({ filename: Filename.make("report.pdf") });
    strictEqual(upload.filename, Filename.make("report.pdf"));
  });
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const mediaSetRid = "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642";
const mediaSetViewRid = "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b";
const mediaItemRid = "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225";

const mediaReferenceWire: typeof MediaReference.Encoded = {
  mimeType: "application/pdf",
  reference: {
    type: "mediaSetViewItem",
    mediaSetViewItem: { mediaSetRid, mediaSetViewRid, mediaItemRid },
  },
};

const mediaItem = MediaSetViewItem.make({
  mediaSetRid: MediaSetRid.make(mediaSetRid),
  mediaSetViewRid: MediaSetViewRid.make(mediaSetViewRid),
  mediaItemRid: MediaItemRid.make(mediaItemRid),
});

describe("Media", () => {
  lawful("MediaItemReadToken", MediaItemReadToken);
  lawful("MediaSetViewItem", MediaSetViewItem);
  lawful("MediaItemLocator", MediaItemLocator);
  lawful("MediaReference", MediaReference);
  lawful("MediaUploadRequest", MediaUploadRequest);

  it.effect(
    "decodes the media reference property value, flattening the wrapper, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(MediaReference)(mediaReferenceWire);
      const expected = MediaReference.make({ mimeType: MediaType.make("application/pdf"), reference: mediaItem });
      assertTrue(S.toEquivalence(MediaReference)(decoded, expected));
      strictEqual(decoded.reference.type, "mediaSetViewItem");
      strictEqual(decoded.reference.mediaSetRid, MediaSetRid.make(mediaSetRid));
      strictEqual(decoded.reference.mediaSetViewRid, MediaSetViewRid.make(mediaSetViewRid));
      strictEqual(decoded.reference.mediaItemRid, MediaItemRid.make(mediaItemRid));
      assertNone(decoded.reference.token);
      const encoded = yield* S.encodeEffect(MediaReference)(decoded);
      deepStrictEqual(encoded, mediaReferenceWire);
    })
  );

  it.effect(
    "decodes a signed reference into a redacted token and encodes the token back",
    Effect.fnUntraced(function* () {
      const wire: typeof MediaSetViewItem.Encoded = {
        type: "mediaSetViewItem",
        mediaSetViewItem: { mediaSetRid, mediaSetViewRid, mediaItemRid, token: "eyJhbGciOiJFUzI1NiJ9.read" },
      };
      const decoded = yield* S.decodeEffect(MediaSetViewItem)(wire);
      assertSome(O.map(decoded.token, Redacted.value), "eyJhbGciOiJFUzI1NiJ9.read");
      assertFalse(Str.includes("eyJhbGciOiJFUzI1NiJ9")(Formatter.format(decoded)));
      const encoded = yield* S.encodeEffect(MediaSetViewItem)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it("defaults the tag and the token when constructing a locator", () => {
    strictEqual(mediaItem.type, "mediaSetViewItem");
    assertNone(mediaItem.token);
  });

  it("constructs the only locator case, exercises its guard and the exhaustive matcher", () => {
    const viaCase = MediaItemLocator.cases.mediaSetViewItem.make({
      mediaSetRid: MediaSetRid.make(mediaSetRid),
      mediaSetViewRid: MediaSetViewRid.make(mediaSetViewRid),
      mediaItemRid: MediaItemRid.make(mediaItemRid),
      token: O.some(Redacted.make("read-token")),
    });
    assertTrue(MediaItemLocator.guards.mediaSetViewItem(viaCase));
    assertTrue(MediaItemLocator.isAnyOf(["mediaSetViewItem"])(viaCase));
    const describeLocator = MediaItemLocator.match({
      mediaSetViewItem: ({ mediaItemRid: item, token }) => `${item}:${O.isSome(token)}`,
    });
    deepStrictEqual(A.map([viaCase, mediaItem], describeLocator), [`${mediaItemRid}:true`, `${mediaItemRid}:false`]);
    deepStrictEqual(MediaItemLocator.discriminants, ["mediaSetViewItem"]);
  });

  it.effect(
    "rejects the flattened shape on the wire, unknown locator kinds, empty identifiers and empty tokens",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(MediaSetViewItem)({ type: "mediaSetViewItem", mediaSetRid, mediaSetViewRid, mediaItemRid }),
        rejects(MediaItemLocator)({ type: "mediaItem", mediaItem: { mediaItemRid } }),
        rejects(MediaSetViewItem)({
          type: "mediaSetViewItem",
          mediaSetViewItem: { mediaSetRid: "", mediaSetViewRid, mediaItemRid },
        }),
        rejects(MediaSetViewItem)({
          type: "mediaSetViewItem",
          mediaSetViewItem: { mediaSetRid, mediaSetViewRid, mediaItemRid, token: "" },
        }),
        rejects(MediaSetViewItem)({ type: "mediaSetViewItem", mediaSetViewItem: { mediaSetRid, mediaSetViewRid } }),
        rejects(MediaReference)({ mimeType: "", reference: mediaReferenceWire.reference }),
        rejects(MediaReference)({ mimeType: "application/pdf" }),
        rejects(MediaItemReadToken)(""),
        rejects(MediaUploadRequest)({ fileName: "scan.png" }),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true, true, true, true, true, true]);
    })
  );

  it("does not accept a bare string where a redacted token is expected", () => {
    const isReadToken = S.is(MediaItemReadToken);
    const redacted = Redacted.make("read-token");
    const verdicts = [isReadToken("read-token"), isReadToken(redacted)];
    deepStrictEqual(verdicts, [false, true]);
  });
});

// ---------------------------------------------------------------------------
// CipherText
// ---------------------------------------------------------------------------

const cipherChannelRid = "ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a";
const cipherEnvelope = `CIPHER::${cipherChannelRid}::AAAAkdB7Zm9vYmFy::CIPHER`;

describe("CipherText", () => {
  lawful("CipherChannelRid", CipherChannelRid);
  lawful("CipherChannelStrategy", CipherChannelStrategy);
  lawful("CipherText", CipherText);
  lawful("Plaintext", Plaintext);
  lawful("EncryptionRequest", EncryptionRequest);
  lawful("EncryptionResult", EncryptionResult);
  lawful("DecryptionResult", DecryptionResult);

  it.effect(
    "decodes the envelope into its channel and payload and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(CipherText)(cipherEnvelope);
      const expected = CipherText.make({
        channel: CipherChannelRid.make(cipherChannelRid),
        ciphertext: "AAAAkdB7Zm9vYmFy",
      });
      assertTrue(S.toEquivalence(CipherText)(decoded, expected));
      strictEqual(decoded.channel, CipherChannelRid.make(cipherChannelRid));
      strictEqual(decoded.ciphertext, "AAAAkdB7Zm9vYmFy");
      const encoded = yield* S.encodeEffect(CipherText)(decoded);
      strictEqual(encoded, cipherEnvelope);
    })
  );

  it.effect(
    "keeps a payload that itself contains the separator or the suffix",
    Effect.fnUntraced(function* () {
      const wire = "CIPHER::ri.bellaso.main.cipher-channel.a:::ab::cd::CIPHER::CIPHER";
      const decoded = yield* S.decodeEffect(CipherText)(wire);
      strictEqual(decoded.channel, CipherChannelRid.make("ri.bellaso.main.cipher-channel.a"));
      strictEqual(decoded.ciphertext, ":ab::cd::CIPHER");
      const encoded = yield* S.encodeEffect(CipherText)(decoded);
      strictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects strings that are not an envelope, an empty channel, an empty payload and a channel with a colon",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(CipherText)("AAAAkdB7Zm9vYmFy"),
        rejects(CipherText)(`CIPHER::${cipherChannelRid}::AAAAkdB7`),
        rejects(CipherText)(`${cipherChannelRid}::AAAAkdB7::CIPHER`),
        rejects(CipherText)("CIPHER::::AAAAkdB7::CIPHER"),
        rejects(CipherText)(`CIPHER::${cipherChannelRid}::::CIPHER`),
        rejects(CipherText)(`cipher::${cipherChannelRid}::AAAAkdB7::cipher`),
        rejects(CipherText)({ channel: cipherChannelRid, ciphertext: "AAAAkdB7" }),
        rejects(CipherChannelRid)(""),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true, true, true, true, true]);
      assertFalse(S.is(CipherText)({ channel: "ri.bellaso:main", ciphertext: "AAAAkdB7" }));
      assertFalse(S.is(CipherText)({ channel: cipherChannelRid, ciphertext: "" }));
      assertTrue(S.is(CipherText)({ channel: cipherChannelRid, ciphertext: "AAAAkdB7" }));
    })
  );

  it.effect(
    "decodes every channel strategy from its wire literal and encodes it back",
    Effect.fnUntraced(function* () {
      const wire: ReadonlyArray<typeof CipherChannelStrategy.Encoded> = [
        "PREFER_EXISTING",
        "PREFER_DEFAULT",
        "EXISTING_ONLY",
        "DEFAULT_ONLY",
      ];
      const decoded = yield* S.decodeEffect(S.Array(CipherChannelStrategy))(wire);
      deepStrictEqual(decoded, ["preferExisting", "preferDefault", "existingOnly", "defaultOnly"]);
      const encoded = yield* S.encodeEffect(S.Array(CipherChannelStrategy))(decoded);
      deepStrictEqual(encoded, wire);
      const requiresOneChannel = CipherChannelStrategy.To.match({
        preferExisting: () => false,
        preferDefault: () => false,
        existingOnly: () => true,
        defaultOnly: () => true,
      });
      deepStrictEqual(A.map(decoded, requiresOneChannel), [false, false, true, true]);
      const unknownStrategy = yield* rejects(CipherChannelStrategy)("preferExisting");
      assertTrue(unknownStrategy);
    })
  );

  it.effect(
    "carries plaintext redacted through the encryption request and the decryption result",
    Effect.fnUntraced(function* () {
      const requestWire: typeof EncryptionRequest.Encoded = { plaintext: "555-01-0199" };
      const request = yield* S.decodeEffect(EncryptionRequest)(requestWire);
      strictEqual(Redacted.value(request.plaintext), "555-01-0199");
      assertFalse(Str.includes("555-01-0199")(Formatter.format(request)));
      const requestEncoded = yield* S.encodeEffect(EncryptionRequest)(request);
      deepStrictEqual(requestEncoded, requestWire);

      const resultWire: typeof DecryptionResult.Encoded = { plaintext: "" };
      const result = yield* S.decodeEffect(DecryptionResult)(resultWire);
      strictEqual(Redacted.value(result.plaintext), "");
      const resultEncoded = yield* S.encodeEffect(DecryptionResult)(result);
      deepStrictEqual(resultEncoded, resultWire);

      const missingPlaintext = yield* rejects(DecryptionResult)({});
      assertTrue(missingPlaintext);
    })
  );

  it.effect(
    "decodes an encryption result into parsed cipher text and encodes the envelope back",
    Effect.fnUntraced(function* () {
      const wire: typeof EncryptionResult.Encoded = { ciphertext: cipherEnvelope };
      const decoded = yield* S.decodeEffect(EncryptionResult)(wire);
      strictEqual(decoded.ciphertext.channel, CipherChannelRid.make(cipherChannelRid));
      const encoded = yield* S.encodeEffect(EncryptionResult)(decoded);
      deepStrictEqual(encoded, wire);
      const bareCiphertext = yield* rejects(EncryptionResult)({ ciphertext: "AAAAkdB7Zm9vYmFy" });
      assertTrue(bareCiphertext);
    })
  );
});

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

const SecuredCount = SecuredValue("SecuredCount", S.Finite);
const SecuredAttachment = SecuredValue(AttachmentReference)("SecuredAttachment");

const [secret, usOnly, euOnly, projectAlpha] = [
  MarkingId.make("secret"),
  MarkingId.make("us-only"),
  MarkingId.make("eu-only"),
  MarkingId.make("project-alpha"),
];

describe("Security", () => {
  lawful("ConjunctiveMarkings", ConjunctiveMarkings);
  lawful("DisjunctiveMarkings", DisjunctiveMarkings);
  lawful("PropertyMarkings", PropertyMarkings);
  lawful("UnsupportedPolicy", UnsupportedPolicy);
  lawful("ErrorComputingSecurity", ErrorComputingSecurity);
  lawful("PropertySecurity", PropertySecurity);
  lawful("PropertySecurities", PropertySecurities);
  lawful("SecuredValue(Finite)", SecuredCount);
  lawful("SecuredValue(AttachmentReference)", SecuredAttachment);

  it.effect(
    "decodes a full marking summary beside its tag and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof PropertySecurity.Encoded = {
        type: "propertyMarkingSummary",
        conjunctive: ["secret"],
        disjunctive: [["us-only", "eu-only"]],
        containerConjunctive: ["project-alpha"],
        containerDisjunctive: [["us-only"], ["secret", "eu-only"]],
      };
      const decoded = yield* S.decodeEffect(PropertySecurity)(wire);
      const expected = PropertyMarkings.make({
        conjunctive: O.some([secret]),
        disjunctive: O.some([[usOnly, euOnly]]),
        containerConjunctive: O.some([projectAlpha]),
        containerDisjunctive: O.some([[usOnly], [secret, euOnly]]),
      });
      assertTrue(S.toEquivalence(PropertySecurity)(decoded, expected));
      const encoded = yield* S.encodeEffect(PropertySecurity)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes absent marking summaries to None and encodes them back as absent keys",
    Effect.fnUntraced(function* () {
      const wire: typeof PropertyMarkings.Encoded = { type: "propertyMarkingSummary" };
      const decoded = yield* S.decodeEffect(PropertyMarkings)(wire);
      assertNone(decoded.conjunctive);
      assertNone(decoded.disjunctive);
      assertNone(decoded.containerConjunctive);
      assertNone(decoded.containerDisjunctive);
      assertTrue(S.toEquivalence(PropertyMarkings)(decoded, PropertyMarkings.make({})));
      const encoded = yield* S.encodeEffect(PropertyMarkings)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes a security table entry of all three outcomes and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof PropertySecurities.Encoded = {
        disjunction: [
          { type: "propertyMarkingSummary", conjunctive: ["secret"] },
          { type: "unsupportedPolicy" },
          { type: "errorComputingSecurity" },
        ],
      };
      const decoded = yield* S.decodeEffect(PropertySecurities)(wire);
      const expected = PropertySecurities.make({
        disjunction: [
          PropertyMarkings.make({ conjunctive: O.some([secret]) }),
          UnsupportedPolicy.make({}),
          ErrorComputingSecurity.make({}),
        ],
      });
      assertTrue(S.toEquivalence(PropertySecurities)(decoded, expected));
      const encoded = yield* S.encodeEffect(PropertySecurities)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it("constructs every outcome through its case, exercises every guard and the exhaustive matcher", () => {
    const markings = PropertySecurity.cases.propertyMarkingSummary.make({ conjunctive: O.some([secret, usOnly]) });
    const unsupported = PropertySecurity.cases.unsupportedPolicy.make({});
    const failed = PropertySecurity.cases.errorComputingSecurity.make({});
    assertTrue(PropertySecurity.guards.propertyMarkingSummary(markings));
    assertTrue(PropertySecurity.guards.unsupportedPolicy(unsupported));
    assertTrue(PropertySecurity.guards.errorComputingSecurity(failed));
    assertFalse(PropertySecurity.guards.propertyMarkingSummary(unsupported));
    assertTrue(PropertySecurity.isAnyOf(["unsupportedPolicy", "errorComputingSecurity"])(failed));
    assertFalse(PropertySecurity.isAnyOf(["unsupportedPolicy", "errorComputingSecurity"])(markings));
    const describeOutcome = PropertySecurity.match({
      propertyMarkingSummary: ({ conjunctive }) => `markings:${A.length(O.getOrElse(conjunctive, A.empty))}`,
      unsupportedPolicy: () => "unsupported",
      errorComputingSecurity: () => "error",
    });
    deepStrictEqual(A.map([markings, unsupported, failed], describeOutcome), ["markings:2", "unsupported", "error"]);
    deepStrictEqual(PropertySecurity.discriminants, [
      "propertyMarkingSummary",
      "unsupportedPolicy",
      "errorComputingSecurity",
    ]);
  });

  it.effect(
    "rejects the generated client's renamed tag, a nested summary, unknown outcomes and malformed markings",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(PropertySecurity)({ type: "propertyMarkings", conjunctive: ["secret"] }),
        rejects(PropertySecurity)({ type: "allowed" }),
        rejects(PropertySecurity)({ conjunctive: ["secret"] }),
        rejects(PropertyMarkings)({ type: "propertyMarkingSummary", conjunctive: [""] }),
        rejects(PropertyMarkings)({ type: "propertyMarkingSummary", conjunctive: [["secret"]] }),
        rejects(PropertyMarkings)({ type: "propertyMarkingSummary", disjunctive: ["secret"] }),
        rejects(PropertySecurities)({ disjunction: { type: "unsupportedPolicy" } }),
        rejects(PropertySecurities)({}),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true, true, true, true, true]);
    })
  );

  it("requires every conjunctive marking and one marking of every disjunctive set, for value and container", () => {
    const markings = PropertyMarkings.make({
      conjunctive: O.some([secret]),
      disjunctive: O.some([[usOnly, euOnly]]),
      containerConjunctive: O.some([projectAlpha]),
    });
    const verdicts = A.map(
      [
        HashSet.make(secret, usOnly, projectAlpha),
        HashSet.make(secret, euOnly, projectAlpha),
        HashSet.make(usOnly, euOnly, projectAlpha),
        HashSet.make(secret, projectAlpha),
        HashSet.make(secret, usOnly),
        HashSet.empty<MarkingId>(),
      ],
      (held) => PropertyMarkings.isSatisfiedBy(markings, held)
    );
    deepStrictEqual(verdicts, [true, true, false, false, false, false]);
  });

  it("treats absent requirements as met, an empty conjunction as met and an empty disjunctive set as unmeetable", () => {
    const everything = HashSet.make(secret, usOnly, euOnly, projectAlpha);
    assertTrue(PropertyMarkings.isSatisfiedBy(PropertyMarkings.make({}), HashSet.empty()));
    assertTrue(PropertyMarkings.isSatisfiedBy(PropertyMarkings.make({ conjunctive: O.some([]) }), HashSet.empty()));
    assertTrue(PropertyMarkings.isSatisfiedBy(PropertyMarkings.make({ disjunctive: O.some([]) }), HashSet.empty()));
    assertFalse(PropertyMarkings.isSatisfiedBy(PropertyMarkings.make({ disjunctive: O.some([[]]) }), everything));
    assertFalse(
      PropertyMarkings.isSatisfiedBy(
        PropertyMarkings.make({ containerDisjunctive: O.some([[usOnly], []]) }),
        everything
      )
    );
    const heldBySomeone = PropertyMarkings.isSatisfiedBy(HashSet.make(secret));
    assertTrue(heldBySomeone(PropertyMarkings.make({ conjunctive: O.some([secret]) })));
    assertFalse(heldBySomeone(PropertyMarkings.make({ conjunctive: O.some([secret, usOnly]) })));
  });

  it.effect(
    "decodes the secured value envelope and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof SecuredCount.Encoded = { value: 10, propertySecurityIndex: 5 };
      const decoded = yield* S.decodeEffect(SecuredCount)(wire);
      assertSome(decoded.value, 10);
      assertSome(decoded.propertySecurityIndex, 5);
      const encoded = yield* S.encodeEffect(SecuredCount)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes an empty envelope to two absent fields and encodes it back as an empty object",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(SecuredCount)({});
      assertNone(decoded.value);
      assertNone(decoded.propertySecurityIndex);
      assertTrue(S.toEquivalence(SecuredCount)(decoded, SecuredCount.make({})));
      const encoded = yield* S.encodeEffect(SecuredCount)(decoded);
      deepStrictEqual(encoded, {});
    })
  );

  it.effect(
    "wraps a structured value with its own codec",
    Effect.fnUntraced(function* () {
      const wire: typeof SecuredAttachment.Encoded = { value: { rid: attachmentRid }, propertySecurityIndex: 0 };
      const decoded = yield* S.decodeEffect(SecuredAttachment)(wire);
      assertSome(
        O.map(decoded.value, (reference) => reference.rid),
        AttachmentRid.make(attachmentRid)
      );
      const encoded = yield* S.encodeEffect(SecuredAttachment)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "rejects an index that is negative or fractional and a value its codec rejects",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(SecuredCount)({ value: 10, propertySecurityIndex: -1 }),
        rejects(SecuredCount)({ value: 10, propertySecurityIndex: 1.5 }),
        rejects(SecuredCount)({ value: "10", propertySecurityIndex: 5 }),
        rejects(SecuredAttachment)({ value: { rid: "" }, propertySecurityIndex: 5 }),
      ]);
      deepStrictEqual(verdicts, [true, true, true, true]);
    })
  );

  it("gives every envelope the identity it was named with", () => {
    const identifiers = A.map([SecuredCount, SecuredAttachment], (schema) => S.resolveAnnotations(schema)?.identifier);
    deepStrictEqual(identifiers, [
      "@beep/scratchpad/osdk/Security/Security.model/SecuredCount",
      "@beep/scratchpad/osdk/Security/Security.model/SecuredAttachment",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Fields that hold another class
// ---------------------------------------------------------------------------

type SameType<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

describe("fields that hold another class", () => {
  // Law: a field whose schema is a class is typed as that class, so its value can be handed to anything that asks
  // for the class. Annotating the key of a class would silently type the field as the class's un-branded record.
  it("are typed as the class and never as its un-branded record", () => {
    const facts: readonly [
      SameType<EncryptionResult["ciphertext"], CipherText>,
    ] = [true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
