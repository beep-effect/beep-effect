/**
 * A fake HttpClient that records every request and answers from a router, so
 * the live layers run their real SDK serialization with no network.
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

export interface RecordedRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: URL;
}

export interface FakeAnswer {
  readonly body: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly status?: number;
}

const textDecoder = new TextDecoder();

export class FakeHttp {
  requests: Array<RecordedRequest> = [];
  readonly route: (request: RecordedRequest) => O.Option<FakeAnswer>;

  constructor(route: (request: RecordedRequest) => O.Option<FakeAnswer>) {
    this.route = route;
  }

  get layer(): Layer.Layer<HttpClient.HttpClient> {
    return Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request, url) =>
        Effect.sync(() => {
          const body = request.body;
          const recorded: RecordedRequest = {
            method: request.method,
            url,
            headers: request.headers,
            body:
              body._tag === "Uint8Array" ? textDecoder.decode(body.body) : body._tag === "Raw" ? String(body.body) : "",
          };
          this.requests.push(recorded);
          const answer = O.getOrElse(this.route(recorded), (): FakeAnswer => ({ status: 404, body: "no route" }));
          return HttpClientResponse.fromWeb(
            request,
            new Response(answer.status === 204 ? null : answer.body, {
              status: answer.status ?? 200,
              headers: answer.headers ?? {},
            })
          );
        })
      )
    );
  }

  matching(predicate: (request: RecordedRequest) => boolean): ReadonlyArray<RecordedRequest> {
    return A.filter(this.requests, predicate);
  }
}
