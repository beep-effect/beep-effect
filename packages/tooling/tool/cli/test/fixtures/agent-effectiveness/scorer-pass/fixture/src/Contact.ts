import * as S from "effect/Schema";

export class ContactPayload extends S.Class<ContactPayload>("ContactPayload")({
  name: S.String,
}) {}
