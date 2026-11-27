import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@beep/ui/components/card";
import { Input } from "@beep/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@beep/ui/components/table";
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { chosen, download, draft, listings, platforms, run, signIn, stop } from "@/client/Library.atoms";
import { Listing, status } from "@/client/Listing";
import { Entry, Inventory, Standing } from "@/core/inventory";
import type { Row } from "@/client/Listing";
import type { Installed } from "@/core/catalog";

const day = DateTime.formatIsoDateUtc;

const failed = <A, E>(result: AsyncResult.AsyncResult<A, E>): O.Option<string> =>
  AsyncResult.isFailure(result) && !Cause.hasInterruptsOnly(result.cause)
    ? result.cause.pipe(Cause.pretty, O.some)
    : O.none();

function Trouble({ text }: { readonly text: O.Option<string> }) {
  return O.match(text, {
    onNone: () => null,
    onSome: (message) => (
      <p role="alert" className="text-destructive text-sm">
        {message}
      </p>
    ),
  });
}

function SignIn({ installed }: { readonly installed: Installed }) {
  const [state, open] = useAtom(signIn(installed.platform));
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">{installed.platform}</Badge>
      {state.waiting ? (
        <Button size="sm" variant="secondary" onClick={() => open(Atom.Interrupt)}>
          Finish sign-in
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => open(installed.entry)}>
          Sign in
        </Button>
      )}
      <Trouble text={failed(state)} />
    </div>
  );
}

function Accounts() {
  const installed = useAtomValue(platforms);
  return (
    <div className="flex flex-wrap items-center gap-4">
      {A.map(AsyncResult.getOrElse(installed, A.empty<Installed>), (entry) => (
        <SignIn key={entry.platform} installed={entry} />
      ))}
    </div>
  );
}

function Add() {
  const [address, setAddress] = useAtom(draft);
  const [state, map] = useAtom(run("fresh"));
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        map(address);
      }}
    >
      <div className="flex gap-2">
        <Input
          aria-label="Profile address"
          placeholder="https://onlyfans.com/name"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Button type="submit" disabled={state.waiting}>
          Map profile
        </Button>
      </div>
      <Trouble text={failed(state)} />
    </form>
  );
}

function Actions({ listing }: { readonly listing: Listing }) {
  const update = useAtomSet(run("incremental"));
  const resume = useAtomSet(run("resume"));
  const remap = useAtomSet(run("fresh"));
  const halt = useAtomSet(stop);
  const [saving, save] = useAtom(download(listing.address));
  const owed = Listing.owed(listing);
  const { standing } = listing.inventory;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {Inventory.mapping(listing.inventory) ? (
          <Button size="sm" variant="destructive" onClick={() => halt(listing.address)}>
            Stop
          </Button>
        ) : (
          <>
            {Standing.guards.complete(standing) ? (
              <Button size="sm" variant="outline" onClick={() => update(listing.address)}>
                Update
              </Button>
            ) : null}
            {Standing.guards.partial(standing) ? (
              <Button size="sm" variant="outline" onClick={() => resume(listing.address)}>
                Resume
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => remap(listing.address)}>
              Map again
            </Button>
          </>
        )}
        <Button size="sm" disabled={owed === 0 || saving.waiting} onClick={() => save()}>
          {saving.waiting ? "Saving" : `Download ${owed}`}
        </Button>
      </div>
      <Trouble text={failed(saving)} />
    </div>
  );
}

function Summary({ listing }: { readonly listing: Listing }) {
  const [open, choose] = useAtom(chosen);
  const { label, tone } = status(listing.inventory.standing);
  const shown = O.contains(open, listing.address);
  return (
    <TableRow data-state={shown ? "selected" : undefined}>
      <TableCell>
        <Button variant="link" onClick={() => choose(shown ? O.none() : O.some(listing.address))}>
          {listing.address}
        </Button>
      </TableCell>
      <TableCell>
        <Badge variant={tone}>{label}</Badge>
      </TableCell>
      <TableCell>{A.length(listing.rows)}</TableCell>
      <TableCell>{Listing.saved(listing)}</TableCell>
      <TableCell>
        <Actions listing={listing} />
      </TableCell>
    </TableRow>
  );
}

function Post({ row }: { readonly row: Row }) {
  const { files, item } = row.entry;
  return (
    <TableRow>
      <TableCell>
        <a className="underline-offset-4 hover:underline" href={row.address} target="_blank" rel="noreferrer">
          {row.address}
        </a>
      </TableCell>
      <TableCell>{O.getOrElse(O.map(item.publishedAt, day), () => "")}</TableCell>
      <TableCell>{item.images}</TableCell>
      <TableCell>{item.videos}</TableCell>
      <TableCell>{item.locked}</TableCell>
      <TableCell>{item.pinned ? "pinned" : ""}</TableCell>
      <TableCell>
        {A.length(files)} of {A.length(files) + Entry.pending(row.entry)}
        {A.map(files, (file) => (
          <div key={file.path} className="text-muted-foreground font-mono text-xs">
            {file.path}
          </div>
        ))}
      </TableCell>
    </TableRow>
  );
}

function Posts({ listing }: { readonly listing: Listing }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{listing.address}</CardTitle>
        <CardDescription>
          {A.length(listing.rows)} posts over {listing.inventory.pages} pages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Images</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Locked</TableHead>
              <TableHead />
              <TableHead>Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {A.map(listing.rows, (row) => (
              <Post key={row.address} row={row} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Kept() {
  const result = useAtomValue(listings);
  const open = useAtomValue(chosen);
  const kept = AsyncResult.getOrElse(result, A.empty<Listing>);
  const shown = O.flatMap(open, (address) => A.findFirst(kept, (listing) => listing.address === address));
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
          <CardDescription>
            {A.isReadonlyArrayNonEmpty(kept) ? `${A.length(kept)} kept` : "Nothing mapped yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Trouble text={failed(result)} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Standing</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead>Files</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {A.map(kept, (listing) => (
                <Summary key={listing.address} listing={listing} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {O.match(shown, { onNone: () => null, onSome: (listing) => <Posts listing={listing} /> })}
    </>
  );
}

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl">Social mapper</h1>
        <Accounts />
      </header>
      <Add />
      <Kept />
    </main>
  );
}
