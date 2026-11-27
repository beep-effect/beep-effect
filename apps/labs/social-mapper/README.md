# @beep/social-mapper

Maps, keeps and downloads social profiles through a signed-in browser.

A desktop window (Tauri, React) drives a local server (Bun, Effect RPC over
loopback HTTP). The server owns one Chromium profile for each account, reads a
profile's listing by watching what the site's own pages fetch, keeps the result
on disk and saves the media of mapped posts.

## Layout

- `src/core`: the data model, the mapper and reader contracts, the library,
  sessions, downloads and the RPC protocol. `src/core/sites` holds one rule for
  each platform; only OnlyFans has one so far.
- `src/client`: the window's atoms and view model.
- `server`: the RPC server, its loopback guard, and a stand-in site.
- `src-tauri`: the desktop shell.

## Run

```bash
bun run dev:tauri
```

That starts the server, the window's dev server and the desktop window.
`bun run dev:all` starts the first two without the window; open
`http://social-mapper.labs.beep.localhost:1355` in a browser.

Press **Sign in**, sign in to the site in the window that opens, then close it
or press **Finish sign-in**. Paste a profile address and press **Map profile**.

Data lives in `~/.local/share/beep-social-mapper` (`SOCIAL_MAPPER_DATA`
overrides it): `sessions` holds the browser profiles, with their sign-in
cookies, `store` the mapped listings and `files` the downloads.

`SOCIAL_MAPPER_CHROMIUM` names the Chromium to drive; without it the one
Playwright installed is used.

The server starts under `xvfb-run`, and mapping and downloading open their
browser windows on that virtual display, so they never appear on your screen;
only the sign-in window does. `SOCIAL_MAPPER_WINDOW=screen` puts them on your
screen to watch, and `headless` runs them with no window at all. A mapping
run gives up after 45 seconds without a posts answer.

**Download** saves a listing's files one at a time; **Stop saving** ends it
after the files already written, and **Download** carries on from there.

## Try it without an account

```bash
bun run standin
```

```bash
SOCIAL_MAPPER_ONLYFANS_ORIGIN=http://127.0.0.1:3942 SOCIAL_MAPPER_ONLYFANS_ENTRY=/signin SOCIAL_MAPPER_ONLYFANS_MEDIA=127.0.0.1:3942 SOCIAL_MAPPER_DATA=/tmp/social-mapper-standin bun run dev:tauri
```

The stand-in serves three posts behind a cookie sign-in. Map
`https://onlyfans.com/example`.

## Who may call the server

The server opens browser windows and writes files, so it answers only requests
that carry the token made for the launch and that no page of another site
sent. `dev:all` makes the token; the window's dev server adds it to `/rpc`
requests, so the page never holds it.

## Not built yet

- A packaged build: the shell does not start the server outside `tauri dev`.
- Removing a listing or a sign-in from the window.
- Platforms other than OnlyFans.

## Development

```bash
bun run check
bun run test
bun run lint
```

This workspace is a runtime app, not a public TypeScript package. Keep app internals behind `@/*`; promote reusable contracts and domain code to slice or shared packages.

## License

MIT
