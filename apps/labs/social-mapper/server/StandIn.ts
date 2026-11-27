/**
 * A local stand-in for OnlyFans: three posts behind a cookie sign-in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

const html = (script: string, text = "") =>
  HttpServerResponse.html(
    `<body style="margin:0;font-family:sans-serif"><p style="padding:24px">${text}</p><div id="feed" style="min-height:3000px"></div><script>${script}</script></body>`
  );

const cookie = (name: string) =>
  HttpServerResponse.jsonUnsafe({ ok: true }, { headers: { "set-cookie": `${name}=1; Max-Age=86400; Path=/` } });

const profilePage = `(async () => {
  const owner = await (await fetch('/api2/v2/users/example')).json()
  await fetch('/api2/v2/users/' + owner.id + '/posts?pinned=1')
  let page = 0, busy = false, more = true
  const load = async () => {
    if (busy || !more) return
    busy = true
    const answer = await (await fetch('/api2/v2/users/' + owner.id + '/posts?page=' + page++)).json()
    more = answer.hasMore
    document.getElementById('feed').style.minHeight = (3000 * (page + 1)) + 'px'
    busy = false
  }
  await load()
  addEventListener('scroll', load)
})()`;

const wire = (origin: string) => ({
  301: {
    id: 301,
    author: { id: 7 },
    postedAt: "2026-01-01T00:00:00+00:00",
    media: [{ id: 9301, type: "photo", canView: false }],
  },
  302: {
    id: 302,
    author: { id: 7 },
    postedAt: "2026-01-02T00:00:00+00:00",
    rawText: "second",
    media: [
      {
        id: 9302,
        type: "photo",
        canView: true,
        files: { full: { url: `${origin}/files/302.jpg`, width: 800, height: 600 } },
      },
    ],
  },
  303: {
    id: 303,
    author: { id: 7 },
    postedAt: "2026-01-03T00:00:00+00:00",
    media: [{ id: 9303, type: "video", canView: true }],
  },
});

/**
 * Answers one request the way the stand-in site would.
 *
 * **Example** (Serve the stand-in)
 *
 * ```ts
 * import * as HttpServer from "effect/http/HttpServer"
 * import { site } from "./StandIn.ts"
 *
 * const served = HttpServer.serveEffect(site)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const site = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const origin = `http://${O.getOrElse(Headers.get(request.headers, "host"), () => "fixture")}`;
  const { pathname, searchParams } = new URL(request.url, origin);
  const posts = wire(origin);
  const signedIn = O.exists(Headers.get(request.headers, "cookie"), Str.includes("sess=1"));
  const routes: Record<string, () => HttpServerResponse.HttpServerResponse> = {
    "/signin": () =>
      html(
        "fetch('/api2/v2/session/sess').then(() => fetch('/api2/v2/session/auth_id')).then(() => { document.querySelector('p').textContent = 'Signed in to the stand-in. Close this window.' })",
        "Signing in to the stand-in."
      ),
    "/api2/v2/session/sess": () => cookie("sess"),
    "/api2/v2/session/auth_id": () => cookie("auth_id"),
    "/example": () => html(profilePage),
    "/302/example": () => html("fetch('/api2/v2/posts/302')"),
    "/303/example": () => html("fetch('/api2/v2/posts/303')"),
    "/api2/v2/users/example": () =>
      signedIn
        ? HttpServerResponse.jsonUnsafe({ id: 7, username: "example", name: "Example", isVerified: true })
        : HttpServerResponse.empty({ status: 401 }),
    "/api2/v2/users/7/posts": () =>
      HttpServerResponse.jsonUnsafe(
        searchParams.get("pinned") === "1"
          ? { list: [posts[303]], hasMore: false }
          : searchParams.get("page") === "0"
            ? { list: [posts[303], posts[302]], hasMore: true }
            : { list: [posts[301]], hasMore: false }
      ),
    "/api2/v2/posts/302": () => HttpServerResponse.jsonUnsafe(posts[302]),
    "/api2/v2/posts/303": () => HttpServerResponse.jsonUnsafe(posts[303]),
    "/files/302.jpg": () => HttpServerResponse.text("not really a jpeg", { contentType: "image/jpeg" }),
  };
  return O.match(R.get(routes, pathname), {
    onNone: () => HttpServerResponse.empty({ status: 404 }),
    onSome: (respond) => respond(),
  });
});
