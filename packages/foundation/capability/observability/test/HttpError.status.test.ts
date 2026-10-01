import { ClientHttpError, ServerHttpError } from "@beep/observability";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const ClientStatus = ClientHttpError.fields.status;
const ServerStatus = ServerHttpError.fields.status;
const decodeClientStatus = S.decodeUnknownOption(ClientStatus);
const encodeClientStatus = S.encodeUnknownOption(ClientStatus);
const decodeServerStatus = S.decodeUnknownOption(ServerStatus);
const encodeServerStatus = S.encodeUnknownOption(ServerStatus);
const isClientStatus = S.is(ClientStatus);
const isServerStatus = S.is(ServerStatus);

describe("HttpError status wire form", () => {
  it("encodes a client error status as its name and decodes the name to its code", () => {
    assertSome(encodeClientStatus(404), "NotFound");
    assertSome(decodeClientStatus("ImATeapot"), 418);
    assertNone(decodeClientStatus(404));
  });

  it("encodes a server error status as its name and decodes the name to its code", () => {
    assertSome(encodeServerStatus(503), "ServiceUnavailable");
    assertSome(decodeServerStatus("NetworkAuthenticationRequired"), 511);
  });

  it("rejects unnamed codes inside the class range", () => {
    assertFalse(isClientStatus(419));
    assertNone(encodeClientStatus(419));
    assertFalse(isServerStatus(599));
    assertTrue(isClientStatus(451));
  });

  it.prop(
    "round-trips every client error status through its name",
    [Arbitrary.schema(ClientStatus)],
    ([status]) => {
      assertSome(O.flatMap(encodeClientStatus(status), decodeClientStatus), status);
      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips every server error status through its name",
    [Arbitrary.schema(ServerStatus)],
    ([status]) => {
      assertSome(O.flatMap(encodeServerStatus(status), decodeServerStatus), status);
      return true;
    },
    { arbitrary: fcRuns(50) }
  );
});
