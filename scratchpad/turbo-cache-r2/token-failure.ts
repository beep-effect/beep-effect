import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { TokenHandoffError } from "./token.js";

const SourceFailure = S.Struct({
  _tag: S.optionalKey(S.String),
  message: S.String,
  name: S.optionalKey(S.String),
});

export const stateReadFailure = (cause: Cause.Cause<unknown>) => {
  const source = cause.pipe(Cause.squash, S.decodeUnknownOption(SourceFailure));

  const detail = O.isSome(source)
    ? `${source.value._tag ?? source.value.name ?? "UnknownFailure"}: ${source.value.message}`
    : "UnknownFailure: No tagged source message is available.";

  const fix =
    O.isSome(source) && P.isTagged(source.value, "CredentialsUnavailable")
      ? "inject `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` with the operator's secret tool, then retry `alchemy-turbo-cache-token`"
      : "verify the configured state store and stage; use the approved deployment workflow for any bootstrap or upgrade";

  return TokenHandoffError.make({
    message: `The token handoff failed before sending a credential. ${detail} State provisioning remains disabled. Fix: ${fix}.`,
  });
};
