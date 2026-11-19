import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { Name } from "@proto/kernel/Measure";
import { pipe } from "effect/Function";
import * as Headers from "effect/http/Headers";
import * as Match from "effect/Match";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";

/**
 * Who a request says it is: a human, an agent run, or a process acting for a
 * human (a poller, a webhook). A process is named as a policy or handler is,
 * so the header it is sent in reads back as the same credential.
 *
 * **Gotchas**
 *
 * FIXTURE ONLY. The scheme is an unsigned header, so anyone may claim any
 * principal or run. It stands where a real host verifies a session cookie,
 * a bearer token or a workload identity; nothing else in the boundary
 * changes when that verification replaces it.
 *
 * @category models
 * @since 0.0.0
 */
export const Credential = S.TaggedUnion({
  Human: { principal: PrincipalId },
  Agent: { run: RunId },
  Process: { process: Name, principal: PrincipalId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Credential = typeof Credential.Type;

const FIXTURE = /^Fixture (human|agent|process):([^@\s]+)(?:@(\S+))?$/;

const decode = S.decodeUnknownOption(Credential);

// Each part is decoded, so a malformed id or process name reads as no credential, never a defect.
const parse = (value: string): O.Option<Credential> =>
  pipe(
    O.fromNullishOr(FIXTURE.exec(value)),
    O.flatMap(([, kind, subject = "", principal]) =>
      Match.value(kind).pipe(
        Match.withReturnType<O.Option<Credential>>(),
        Match.when("human", () => decode({principal: subject })),
        Match.when("agent", () => decode({ run: subject })),
        Match.when("process", () =>
          O.flatMap(O.fromNullishOr(principal), (on) => decode({ process: subject, principal: on })),
        ),
        Match.orElse(O.none<Credential>),
      ),
    ),
  );

/**
 * The credential a request's `authorization` header carries, if it is a
 * well-formed fixture credential.
 *
 * @category getters
 * @since 0.0.0
 */
export const read = (headers: Headers.Headers): O.Option<Credential> =>
  O.flatMap(Headers.get(headers, "authorization"), parse);

/**
 * The headers a caller sends to present a fixture credential.
 *
 * **Example** (A reviewer's headers)
 * ```ts
 * import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
 * import { PrincipalId } from "@proto/kernel/Ids";
 *
 * const headers = headersFor(Credential.cases.Human.make({ principal: PrincipalId.make("p_rev") }));
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const headersFor = (credential: Credential): { readonly authorization: string } => ({
  authorization: Credential.match(credential, {
    Human: ({ principal }) => `Fixture human:${principal}`,
    Agent: ({ run }) => `Fixture agent:${run}`,
    Process: ({ process, principal }) => `Fixture process:${process}@${principal}`,
  }),
});
