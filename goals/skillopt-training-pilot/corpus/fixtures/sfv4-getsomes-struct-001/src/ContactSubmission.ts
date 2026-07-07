import * as O from "effect/Option";
import * as R from "effect/Record";

export interface ContactSubmissionDraft {
  readonly email?: string;
  readonly message?: string;
  readonly name?: string;
}

export type ContactSubmissionRaw = {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly message?: string | null;
};

export const contactSubmissionPayloadInputFromRecord = (raw: ContactSubmissionRaw): Partial<ContactSubmissionDraft> =>
  R.getSomes({
    name: O.fromNullishOr(raw.name),
    email: O.fromNullishOr(raw.email),
    message: O.fromNullishOr(raw.message),
  }) as Partial<ContactSubmissionDraft>;
