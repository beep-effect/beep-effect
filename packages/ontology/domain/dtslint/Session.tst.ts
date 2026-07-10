import { expect } from "tstyche";
import type { ChangeOperation, Session } from "@beep/ontology-domain/aggregates/Session";

declare const session: Session;
declare const change: ChangeOperation;

expect(session.changeLog).type.toBe<ReadonlyArray<ChangeOperation>>();
expect(change.kind).type.toBe<"addQuad" | "removeQuad">();
