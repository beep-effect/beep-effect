import { DescendError, UnreadableDirectory } from "@beep/walker/Descend";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Getter from "effect/SchemaGetter";

// instanceOf has no built-in generator. These generation-only links retain
// the public schemas' encoders, decoders and equivalence for every assertion.
const ReasonSample = S.Literals(["PermissionDenied", "Unknown", "NotFound"]);

/** Unreadable-directory fields with an arbitrary for the original filesystem cause. */
export const unreadableDirectorySample = UnreadableDirectory.mapFields((fields) => ({
  ...fields,
  cause: fields.cause.annotate({
    toCodecArbitrary: () =>
      S.link<PlatformError.PlatformError>()(ReasonSample, {
        decode: Getter.transform((reason) =>
          PlatformError.systemError({
            _tag: reason,
            module: "FileSystem",
            method: "readDirectory",
            pathOrDescriptor: "/generated",
          })
        ),
        encode: Getter.forbiddenEncoding,
      }),
  }),
}));

const descendErrorFields = DescendError.mapFields((fields) => ({
  ...fields,
  cause: S.optionalKey(unreadableDirectorySample.fields.cause),
}));

/** Generates actual DescendError instances, including optional filesystem causes, in nested unions. */
export const descendErrorSample = S.declare(S.is(DescendError), {
  toCodecArbitrary: () =>
    S.link<DescendError>()(descendErrorFields, {
      decode: Getter.transform((fields) => DescendError.make(fields)),
      encode: Getter.forbiddenEncoding,
    }),
});
