// Schema-derived arbitraries fill free-text `S.String` fields with any UTF-16,
// unpaired surrogates included. Since goal canonical-digest-owner slice C,
// PacketCore's `canonicalJsonText` is the RFC 8785 owner, which refuses an
// unpaired surrogate by throwing its typed error. A property about the digest
// or byte stability of such a value therefore holds on well-formed text only;
// the refusal itself is pinned in `canonical-digest-owner-differential.test.ts`
// and `canonical-digest-owner-replay.test.ts`.

import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

/** True when every string in the value, member keys included, is well-formed UTF-16. */
export const holdsOnlyWellFormedText = (value: unknown): boolean => {
  if (P.isString(value)) {
    return value.isWellFormed();
  }
  if (A.isArray(value)) {
    return A.every(value, holdsOnlyWellFormedText);
  }
  return (
    !P.isObject(value) ||
    A.every(R.toEntries(value), ([key, entry]) => key.isWellFormed() && holdsOnlyWellFormedText(entry))
  );
};
