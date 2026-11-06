Oct 24, 2026

Every Alchemy resource talks to its cloud through
distilled (https://distilled.cloud), our Effect-native SDKs covering
88 providers. Bindings use it too: under the hood, a binding makes HTTP
calls to the cloud’s API, so every Worker or Lambda with a binding
bundles distilled.

That puts distilled’s size in every deploy and every bundle, and until
recently it was heavy: one API call bundled to 57 KB, and importing all
of AWS took 227 MB of memory.

So we hillclimbed it. We built a benchmark for every SDK, put it on a
dashboard, and pointed an agent at it with one job: make every number
go down. It ran the benchmark after every change, kept what helped and
dropped what didn’t. Over 123 commits and 84 benchmark runs, a
single call’s bundle shrank by a third and
importing all of AWS went from 227 MB to 13.9 MB.

Distilled today vs distilled before this work

- −33%bundle size57.1 → 38.3 KB gzip
- −79%added latency per call19.5 → 4.0 µs
- −74%import memory2.15 → 0.57 MB
- 16×less memory to import all of AWS227 → 13.9 MB

These are medians over 98 “programs”: one credentials layer plus one
operation, for every SDK and every wire protocol it uses. Here is how
that compares with the official SDKs today:

Distilled vs the official SDKsofficial SDKdistilled
AWS SDK v36 calls
cloudflareworkers.scripts.list
@google-cloud/storagegetBuckets
Bundle size
Bundle size2.6×smaller
Bundle size2.2×smaller
Bundle size6.0×smaller
Added latency
Added latency5.8×faster
Added latency5.1×faster
Added latency108.9×faster
Import memory
Import memory3.3×less
Import memory23.5×less
Import memory7.5×less
Cold start
Cold start2.0×faster
Cold start3.0×faster
Cold start1.2×faster

Distilled compared with each official SDK, same call on both sides. Hover a cell for the numbers. Cold start is import plus the first call in a fresh process, bundled as deployed.

## How we kept score
Section titled “How we kept score” (#how-we-kept-score)

We can’t make AWS or Cloudflare faster, only the SDK in front of them,
so real API calls would only add noise. Effect helps here: every
distilled request goes through the `HttpClient` service, so the
benchmark swaps in a fake one that answers instantly:

-
```
const MockHttp = Layer.succeed(  HttpClient.HttpClient,  HttpClient.make((request) =>    Effect.succeed(      HttpClientResponse.fromWeb(request, new Response(canned.body, canned)),    ),  ),);
```

    Effect.succeed(      HttpClientResponse.fromWeb(request, new Response(canned.body, canned)),    ),  ),);">

That leaves only distilled’s own cost: bundle size, added latency per
call, import memory and a few more. Each one is measured twice. The
second time turns on strict mode, where distilled checks every
response against the API spec before your code sees it, so a missing
or mistyped field fails right away as a typed error. Strict mode costs
time and bytes, so it gets its own dotted line on the charts.

Of all those numbers, memory mattered most to us. It matters for your
Workers and Lambdas, but it also limits how we build Alchemy itself.
Our resource factory (/blog/2026-07-02-cloudflare-resource-factory)
runs many agents at once, and each one type-checks, imports every
provider and runs live tests. On our machines memory runs out before
CPU does, so halving the heap lets us run about twice as many agents.

Every run lands on a dashboard that lives in the distilled repo, one
dot per commit, so each chart reads like a loss curve. The benchmarks
now run on every distilled PR too, so a regression shows up before it
merges.

The whole project came down to one dashboard and one chat thread. With
every change on a chart, we could follow the work without reading a
single diff. Our job became checking in every 30 minutes or so: is it
still on track, and are the changes extreme enough? They often
weren’t. The rest of this post climbs from the fixes any reviewer
would approve to the ones that only happened because we kept telling
the agent to get weirder.

How we said it mattered. The louder and stranger our messages got,
the bolder the ideas the agent came back with. Each section below
opens with a real message from the thread, typos included.

Runtime memory · median per program · lower is betterImport heap: V8 heapUsed after importing the SDK modules, minus before (fresh Node, Effect preloaded).
- normal
- strict
this work →← before
- 0 B
- 1.00 MB
- 2.00 MB
- 3.00 MBstrict 575.3 KB#6 751b30b7f feat(celld): add generated v0.6.0 SDK (#621): 2.56 MB#7 1f4a62973 fix(aws,cloudflare): type Workers preview conflict and Deadline UpdateQueue conflict (#683): 2.16 MB#15 f7bf885c1 perf(core): read the retry hint cap without effect/Config: 1.95 MB#17 9e6000975 perf(core): share operation methods through one prototype: 1.85 MB#18 be75448c1 chore: apply the nested PURE markers to every generated service: 1.77 MB#20 b2297ea0a perf(core): build Array and Record schemas lazily too: 1.71 MB#21 b5b1c83e8 chore: apply the Latin-1 pass to every generated service: 1.55 MB#22 c5ca2e97c perf: keep hand-written shipped sources Latin-1 only: 1.43 MB#27 329034941 perf: strip JSDoc from compiled JavaScript: 1.33 MB#28 1bc789950 chore: privatize schemas in every generated service: 1.15 MB#30 d2d5f33cd chore: table private schemas in every generated service: 936.0 KB#32 c0e8b9d81 perf: mark top-level calls in hand-written sources PURE: 816.7 KB#34 1eae38c6d chore: regenerate every SDK with the full codegen pipeline: 829.9 KB#37 42e9e3a33 bench: measure import time and first call in a sequential cold-start pass: 840.3 KB#38 03057c503 perf: patch effect so bundlers can drop HttpClientErrorSchema: 813.6 KB#39 ffb890825 build: rolldown 1.2.8; drop the effect HttpClientErrorSchema patch: 862.6 KB#40 f96685623 Merge branch 'exp/data-tables' into perf/sdk-footprint: 727.9 KB#41 565b4b0e2 chore: remove scratch bundle output committed by mistake: 631.9 KB#46 f6019b376 perf(build): lazy stubs write each export name once and import one package helper: 567.3 KB2.66 MB567.3 KB5358d6614d9302751b30be02e9d4d6ae0c8cced62abe830142298266be75448b2297eac5ca2e9bf8b544954ca6b1bc7899d2d5f33c0e8b9d1eae38c3a4309503057c5f9668561247e0554eeddef6019b3

## The sane fixes
Section titled “The sane fixes” (#the-sane-fixes)

hillclimb optimizing bundle size and memory footprint; be ambitious,
dont be afraid to boil the ocean

This part you can get by just telling an agent to optimize. It follows
the worst number on the dashboard back to its cause, fixes it, runs the
benchmark again, and repeats. That loop never stopped. It kept running
in the main thread the whole time, even while other agents went off to
try much stranger ideas, which we’ll get to.

### Small imports with big bills
Section titled “Small imports with big bills” (#small-imports-with-big-bills)

The single worst line was in a tiny file:

```
import { Effect, Predicate } from "effect";
```

In a bundler that’s fine. In Node, importing from the `effect` package
root loads every Effect module, and that line cost 3.3 MB and 36 ms on
every import of every SDK. Importing `effect/Effect` and
`effect/Predicate` directly fixed it. That’s how the Effect team
recommends importing anyway, and the Effect language service has a
rule for it (`importFromBarrel`). We just don’t run it on generated
code. The same pattern hid in smaller
places: `effect/Config` for a few environment variables, `Schedule`
for retries, `Stream.flatMap` for pagination. Each now has a small
replacement in core, and your own `ConfigProvider` or `Schedule` still
works.

```

```
Heap this line adds0 KB

Modules loaded0
Import time0 ms

effect · 138 modules

needed not needed↻ Replay

### One /*@__PURE__*/ does not cover its arguments
Section titled “One /*@__PURE__*/ does not cover its arguments” (#one-__pure__-does-not-cover-its-arguments)

A bundle with only EC2’s `describeRegions` still kept 1,695 schemas.
The generator marked each top-level call `/*@__PURE__*/`, but that
marker only covers the outer call. The calls in its arguments still
count as side effects, so the bundler keeps everything they reference:

```
// Foo is never used, so the bundler tries to drop it.const Foo = /*@__PURE__*/ S.Struct({ // dropped: marked pure  items: S.Array(Big.pipe(S.optional)), // unused, but kept: not marked});
```

The generator now marks every nested call too, so the whole thing
goes:

```
const Foo = /*@__PURE__*/ S.Struct({  items: /*@__PURE__*/ S.Array(/*@__PURE__*/ Big.pipe(S.optional)),});
```

The EC2 bundle dropped from 137 KB to 75 KB.

### A tree-shaking bug in rolldown
Section titled “A tree-shaking bug in rolldown” (#a-tree-shaking-bug-in-rolldown)

Every program that made an HTTP call kept about 15 KB gzip of Effect
Schema, even ones that never validated anything, because of one rarely used class in
Effect’s HTTP client. Rolldown 1.2.5 and 1.2.6 failed to tree-shake
it, and 1.2.7 fixed that. That one upgrade is the cliff in this chart:

Bundle size · median per program · lower is betterMinified rolldown bundle of a program that sets up auth and calls 1 operation, gzip -9.
- normal
- strict
this work →← before
- 0 B
- 20.0 KB
- 40.0 KB
- 60.0 KB
- 80.0 KBstrict 39.9 KB#2 5358d6602 fix: upgrade Effect to 4.0.0-rc.117 (#637): 55.8 KB#4 14d9302b7 fix(gcp): type HTTP 501 on Agent Engine sandboxes and workerPools.list (#656): 56.1 KB#7 1f4a62973 fix(aws,cloudflare): type Workers preview conflict and Deadline UpdateQueue conflict (#683): 56.6 KB#8 e02e9d405 chore(release): 1.0.0-rc.13: 56.8 KB#15 f7bf885c1 perf(core): read the retry hint cap without effect/Config: 55.6 KB#17 9e6000975 perf(core): share operation methods through one prototype: 56.1 KB#18 be75448c1 chore: apply the nested PURE markers to every generated service: 55.6 KB#19 0083c76af perf(core): build suspended schema ASTs on first use: 55.9 KB#23 589790ecb perf(core): build generated error classes on first use: 56.4 KB#29 d77bcaf0e chore: chunk schema builders in every generated service: 60.6 KB#30 d2d5f33cd chore: table private schemas in every generated service: 66.3 KB#31 cd90cb29e bench: add the Notion SDK target: 60.3 KB#32 c0e8b9d81 perf: mark top-level calls in hand-written sources PURE: 54.1 KB#34 1eae38c6d chore: regenerate every SDK with the full codegen pipeline: 52.6 KB#38 03057c503 perf: patch effect so bundlers can drop HttpClientErrorSchema: 37.2 KB#39 ffb890825 build: rolldown 1.2.8; drop the effect HttpClientErrorSchema patch: 37.0 KB#40 f96685623 Merge branch 'exp/data-tables' into perf/sdk-footprint: 38.3 KB54.8 KB38.3 KB5358d6614d9302751b30be02e9d4d6ae0c8cced62abe830142298266be75448b2297eac5ca2e9bf8b544954ca6b1bc7899d2d5f33c0e8b9d1eae38c3a4309503057c5f9668561247e0554eeddef6019b3
At this point the agent said the numbers looked good and suggested
stopping. Every agent does this. It finds the safe wins, reports them,
and waits.

## Stranger, but defensible
Section titled “Stranger, but defensible” (#stranger-but-defensible)

Okay can you keep improving, we want all of these wayyyy wayyyy lower.
Do insane stuff, hillclimb the f*** out of this

The sane fixes left the numbers better, but still far from where we
wanted them. So every time the agent reported progress, we asked for
something bigger and stranger, and fed it hunches we couldn’t prove
yet: that the specs were full of duplicate shapes, and that schemas
were most of the cost. The agent measured each hunch first, then
turned the ones that held up into code.

### One em dash doubles a module’s memory
Section titled “One em dash doubles a module’s memory” (#one-em-dash-doubles-a-modules-memory)

V8 keeps every module’s source text in memory. If one character is
outside Latin-1, it stores the whole file at two bytes per character.
Escaping three characters in S3’s module cut its import memory from
2,240 KB to 1,570 KB. Shipped code is now Latin-1 only, and a test
enforces it.

### The same schema, thousands of times
Section titled “The same schema, thousands of times” (#the-same-schema-thousands-of-times)

API specs are repetitive. Stripe alone has 12,529 named shapes, and
most of them are copies: dozens of enums that are all just “a string”,
empty response objects, and the same struct redeclared on every
endpoint. Each copy became its own object at import.

The generator now keeps one of each. Comparing shapes field by field
breaks down when shapes refer to themselves, so it uses the algorithm
compilers use to shrink state machines,
partition refinement (https://en.wikipedia.org/wiki/DFA_minimization#Moore's_algorithm):
assume everything of the same kind is the same, then keep splitting
groups until every member of a group points at the same groups. A
split can make the shapes that point at it split in the next round,
so changes ripple up one level at a time. Shapes that only point at
themselves never split, so recursion just works.
Stripe went from 12,529 shapes to 2,720, and its import memory from
9.9 MB to 0.86 MB.

15 schemas❚❚ Pause

Stripe 12,529 → 2,720Cloudflare Workers 2,643 → 491EC2 3,851 → 2,553
Made-up schemas above · real services below

### Faster calls
Section titled “Faster calls” (#faster-calls)

Every call used to run as a generator, with one `yield*` per step:

```
Effect.gen(function* () {  const protocol = yield* Protocol;  const client = yield* HttpClient.HttpClient;  const request = yield* protocol.encode({ input, inputAst, config });  const response = yield* client.execute(request);  return yield* protocol.decode({ response, outputAst, errors, config });});
```

Each `yield*` is a trip through Effect’s runtime, and encode and decode
were generators too. Now, on the first call of an operation, the
protocol compiles a plan for its schemas: which fields go in the path,
the query and the body. Every later call builds the request from that
plan with plain JavaScript, sends it, and decodes the same way. The
only effect left in the middle is the HTTP request.

This is added latency per call across the whole project. The strict
line took longer to come down, for reasons the next section explains.

Runtime speed · median per program · lower is betterAdded latency: p50 of a call against a mocked HTTP response minus p50 of a bare mocked round trip.
- normal
- strict
this work →← before
- 0.0 µs
- 10.0 µs
- 20.0 µs
- 30.0 µsstrict 5.3 µs#4 14d9302b7 fix(gcp): type HTTP 501 on Agent Engine sandboxes and workerPools.list (#656): 29.2 µs#5 6b83c9643 fix(gcp): no environment variables for the default region (#669): 17.7 µs#7 1f4a62973 fix(aws,cloudflare): type Workers preview conflict and Deadline UpdateQueue conflict (#683): 19.1 µs#8 e02e9d405 chore(release): 1.0.0-rc.13: 18.3 µs#10 d6ae0c898 feat(aws/auto-scaling): type InvalidIamInstanceProfile on create/updateAutoScalingGroup (#764): 17.4 µs#13 40a9500a7 feat(notion): add the Notion SDK (#855): 19.5 µs#14 be83014bb perf(core): build pagination streams without Stream.flatMap: 17.6 µs#22 c5ca2e97c perf: keep hand-written shipped sources Latin-1 only: 25.1 µs#25 59c556594 chore: apply schema dedupe to every generated service: 17.2 µs#26 954ca6b3f perf(aws): sign with synchronous node:crypto where available: 18.0 µs#27 329034941 perf: strip JSDoc from compiled JavaScript: 10.5 µs#32 c0e8b9d81 perf: mark top-level calls in hand-written sources PURE: 10.7 µs#33 bf15d2f3a bench: imports suite and object counts; strict variant of every program: 9.5 µs#34 1eae38c6d chore: regenerate every SDK with the full codegen pipeline: 10.2 µs#35 d9d273817 perf: Stripe and Cloudflare encode/decode without generators: 6.9 µs#36 3a430953b bench: pin AWS SDK internals past the minimum release age: 8.7 µs#37 42e9e3a33 bench: measure import time and first call in a sequential cold-start pass: 7.6 µs#40 f96685623 Merge branch 'exp/data-tables' into perf/sdk-footprint: 4.2 µs26.1 µs4.0 µs5358d6614d9302751b30be02e9d4d6ae0c8cced62abe830142298266be75448b2297eac5ca2e9bf8b544954ca6b1bc7899d2d5f33c0e8b9d1eae38c3a4309503057c5f9668561247e0554eeddef6019b3

### Faster, smaller AWS signing
Section titled “Faster, smaller AWS signing” (#faster-smaller-aws-signing)

AWS also signs every request, and signing was the single most
expensive part of an AWS call. SigV4 used to take six async WebCrypto
steps, each one a promise round trip. Switching to synchronous hashing
with `node:crypto` alone took S3 `listBuckets` from 352 µs to 149 µs
of added latency, DynamoDB `listTables` from 218 µs to 103 µs and STS
`getCallerIdentity` from 282 µs to 125 µs. Preparing keys once and
building the canonical request without parsing URLs took the rest.
S3 `listBuckets` now adds 19.4 µs. A side-by-side check of 33,798 cases
across 24 AWS services gave identical requests and results.

Synchronous hashing has a trade-off: it blocks the event loop while it
runs. For a request, that’s a few microseconds of hashing, less than
one async round trip, which also costs a trip through the event loop
and evicts whatever was in the CPU cache. A huge request body is where
blocking would start to matter. The hashing goes through a swappable
`Crypto` service, so runtimes without Node use WebCrypto, and you can
plug in your own.

We also pulled the signer out into its own small package,
`@distilled.cloud/aws4signer`. Cloudflare R2 speaks the S3 API and
needs SigV4 signing too, so code that signs R2 requests no longer
pulls in the rest of the AWS SDK.

### Where that left us
Section titled “Where that left us” (#where-that-left-us)

Before the big rewrites started, the numbers already looked like a
finished project. Compared with where we began, added latency per
call was down from 17.3 µs to 10.7 µs, and import memory from 2.10 MB
to 0.84 MB. Most people would stop here.

The bundle barely moved, though: 57.0 KB to 54.0 KB. Every program
still carried Effect Schema, whether it validated anything or not. To
fix that, we had to stop tuning distilled and start replacing parts of
it.

## Experiments, and our own schema library
Section titled “Experiments, and our own schema library” (#experiments-and-our-own-schema-library)

experiments should be radical shifts boiling the ocean; ambitious
sh*t; agents are phenomenal and can do extreme things

The biggest wins came from ideas that might not work, and trying one
can take a long time. If the one agent doing the work stops to try it,
everything else stops too. So we told it to keep the main thread on
the slowest number and hand radical ideas to new agents. That split
the work into three roles that run at the same time:

- The main thread hillclimbs. It runs the benchmark after every
change, picks the worst number, and fixes it with small, safe
commits. Along the way it writes down the wild ideas it doesn’t
have time for.

- Subagents chase the wild ideas. Each one gets its own worktree
and one idea: lazy error classes, bundling each SDK into a few
files, rewriting the AWS call path, Node-only service stubs. It
builds the idea for real and benchmarks it as an experiment
against the current head. The dashboard keeps experiments off the
timeline and shows each one next to its baseline.

- The main thread merges what worked. An experiment that beats
its baseline without regressing anything else gets merged. One that
doesn’t stays behind as a data point, so nobody tries it again.

An experiment is just a benchmark run with a name:

Terminal window
```
pnpm bench -- --experiment "schema-free generated code"
```

It stays off the commit timeline and shows up on every chart as a flat
dashed line, so we could see at a glance whether an idea beat the
branch:

Bundle size · median over the 96 programs every experiment ran · lower is betterEach experiment is a flat line across the commit timeline.
- normal
- strict
- E2
- E3
- E4
this work →← before
- 0 B
- 20.0 KB
- 40.0 KB
- 60.0 KB
- 80.0 KB
- E4 · 37.0 KBE4 schema-free generated code (lite) + Effect patch
- E3 · 52.6 KBE3 schema-free generated code (lite)
- E2 · 56.3 KBE2 PR #671 (schema-free descriptors)strict 39.8 KB#2 5358d6602 fix: upgrade Effect to 4.0.0-rc.117 (#637): 55.8 KB#4 14d9302b7 fix(gcp): type HTTP 501 on Agent Engine sandboxes and workerPools.list (#656): 56.1 KB#7 1f4a62973 fix(aws,cloudflare): type Workers preview conflict and Deadline UpdateQueue conflict (#683): 56.6 KB#8 e02e9d405 chore(release): 1.0.0-rc.13: 56.8 KB#15 f7bf885c1 perf(core): read the retry hint cap without effect/Config: 55.4 KB#17 9e6000975 perf(core): share operation methods through one prototype: 56.0 KB#18 be75448c1 chore: apply the nested PURE markers to every generated service: 55.6 KB#19 0083c76af perf(core): build suspended schema ASTs on first use: 55.8 KB#23 589790ecb perf(core): build generated error classes on first use: 56.3 KB#29 d77bcaf0e chore: chunk schema builders in every generated service: 60.6 KB#30 d2d5f33cd chore: table private schemas in every generated service: 66.9 KB#31 cd90cb29e bench: add the Notion SDK target: 60.3 KB#32 c0e8b9d81 perf: mark top-level calls in hand-written sources PURE: 54.1 KB#34 1eae38c6d chore: regenerate every SDK with the full codegen pipeline: 52.6 KB#38 03057c503 perf: patch effect so bundlers can drop HttpClientErrorSchema: 37.2 KB#39 ffb890825 build: rolldown 1.2.8; drop the effect HttpClientErrorSchema patch: 37.0 KB#40 f96685623 Merge branch 'exp/data-tables' into perf/sdk-footprint: 38.3 KB54.8 KB38.3 KB5358d6614d9302751b30be02e9d4d6ae0c8cced62abe830142298266be75448b2297eac5ca2e9bf8b544954ca6b1bc7899d2d5f33c0e8b9d1eae38c3a4309503057c5f9668561247e0554eeddef6019b3
While a subagent worked on a big bet, the main thread kept landing
small wins. 38 of our 84 benchmark runs were experiments. Some ideas
took three or four experiments to try different implementations, and
we kept the best one. The biggest experiment was replacing Effect Schema, and the dashed line
at the bottom of the chart above is the version that won.

### Why Effect Schema had to go
Section titled “Why Effect Schema had to go” (#why-effect-schema-had-to-go)

Every generated schema was a real Effect Schema object. That put about
37 KB gzip of Schema code into every bundle, and built thousands of
schema objects at import. Most of that was never used. Encoding a
request and reading a response only need the schema’s structure:
field names, which field goes in the path or a header, how a timestamp
is formatted, and so on. Effect Schema’s parser only matters when you turn on
strict validation.

We didn’t set out to write a schema library. The agent tried
everything else first, on real shapes from EC2, S3, DynamoDB, Stripe
and Cloudflare Workers. Stripe, after dedupe:

|
Option | Import memory | First-use memory | µs per validation | 1-op bundle gz

|
Effect Schema (lazy) | 0.86 MB | 11.3 MB | 24 | 27.5 KB

|
valibot | 20 MB | 0.2 MB | 25 | 6.0 KB

|
zod/mini (before dedupe) | 114 MB | 0.7 MB | 40 | 9.3 KB

|
TypeBox (before dedupe) | 14 MB | 1.9 MB | 206 | 27.9 KB

|
schema-lite (ours) | 2.3 MB | 0.17 MB | 13 | 4.6 KB

Every library lost on at least one axis we cared about. Effect’s own
compilers didn’t help either: the ahead-of-time compiler can’t compile
through recursive shapes, so it generated 4.6 MB of code for EC2, and
the JIT mode doubled first-use memory. An earlier attempt,
PR #671 (https://github.com/alchemy-run/distilled/pull/671), replaced
schemas with descriptors that only carry wire metadata. It was small,
but it couldn’t validate, so strict mode broke.

### Our problem is smaller
Section titled “Our problem is smaller” (#our-problem-is-smaller)

A general schema library has to handle any schema a user can write:
transformations, refinements, defaults, branded types, async checks,
self-referencing structures in full generality, and detailed error
reports for all of it. That machinery costs bytes and memory.

Distilled needs almost none of it. Every schema is generated from an
API spec and fixed at build time. They use about a dozen node kinds:
strings, numbers, booleans, literals, structs, arrays, records, unions
and optional fields. A recursive shape is just a named reference to
another generated shape. And there is only one question to answer:
does this decoded JSON match the shape the spec promised? So we wrote
`@distilled.cloud/core/schema-lite`: plain data, plus one small
validator.

### Same API, plain objects
Section titled “Same API, plain objects” (#same-api-plain-objects)

schema-lite is a small subset of Effect Schema. It exports the
functions generated code already calls (`Struct`, `Array`, `optional`,
`Union`, `suspend` and so on) with the same names and types, so the
switch was one import line in every generated file:

```
import * as S from "@distilled.cloud/core/schema";import * as S from "@distilled.cloud/core/schema-lite";
```

If you know Effect Schema, you can read distilled’s generated code.
What changed is what each call returns: a plain object with the same
fields as an Effect Schema AST node, and nothing else.

```
S.Struct({ id: S.String, tags: S.optional(S.Array(S.String)) });
// builds this, and only this:{  _tag: "Objects",  propertySignatures: [    { name: "id", type: { _tag: "String" } },    {      name: "tags",      type: {        _tag: "Union",        context: { isOptional: true },        types: [          { _tag: "Arrays", elements: [], rest: [{ _tag: "String" }] },          { _tag: "Undefined" },        ],      },    },  ],}
```

### Protocols run unchanged
Section titled “Protocols run unchanged” (#protocols-run-unchanged)

Distilled’s protocol code (REST and AWS’s six wire protocols) already
worked by walking the AST: `_tag`, `propertySignatures`,
`annotations`. A lite node has exactly those fields, so the protocols
didn’t need to know anything changed. AWS also needs to turn
timestamps and base64 blobs into wire values, and lite nodes carry
that in an `encoding` field with the same shape Effect uses. We
checked the switch by encoding 1,516 requests and decoding 426
responses through both implementations. The bytes were identical.

### Strict mode, and still faster than the official SDKs
Section titled “Strict mode, and still faster than the official SDKs” (#strict-mode-and-still-faster-than-the-official-sdks)

Official SDKs trust the API. Providers change their APIs without
warning, smaller ones especially (cough Cloudflare cough). The
request still succeeds, so bad data flows into your app until
something breaks far from the cause. Strict mode turns that into a
controlled failure: a typed `ParseError` with the path to the bad
field, right at the call. It’s one line:

```
program.pipe(Effect.provide(ResponseValidation.strict));
```

Under schema-lite, each node compiles once into a small checker, and
the compiler itself only loads if you turn strict mode on. A test
checks that it accepts and rejects exactly what Effect Schema does.

Distilled also types every error, so each operation ships the full
union of errors it can fail with. We kept both, and compared them with
the official AWS SDK v3, `cloudflare` and `@google-cloud/storage`
packages, each imported the way its users would:

Bundle size of one call (gzip)
- official SDK
- distilled
- distilled, strict
S3 ListBuckets2.5× smaller157.0 KB61.0 KB62.3 KBDynamoDB2.6× smaller144.8 KB53.8 KB55.2 KBKMS2.5× smaller134.1 KB53.2 KB54.5 KBSTS2.3× smaller130.1 KB55.2 KB56.6 KBEC24.7× smaller265.2 KB55.1 KB56.5 KBLambda2.5× smaller141.3 KB55.0 KB56.4 KBCloudflare Workers2.2× smaller124.5 KB55.8 KB57.4 KBGCP Storage5.8× smaller239.1 KB39.7 KB41.3 KB
- The ratio compares the official SDK with distilled in strict mode.

Latency each SDK adds to one call (p50)
- official SDK
- distilled
- distilled, strict
S3 ListBuckets6.4× faster140.2 µs19.4 µs22.0 µsDynamoDB5.6× faster87.3 µs14.3 µs15.5 µsKMS5.1× faster83.0 µs14.4 µs16.4 µsSTS5.6× faster93.2 µs16.1 µs16.6 µsEC25.3× faster97.3 µs16.1 µs18.4 µsLambda4.9× faster79.3 µs15.3 µs16.1 µsCloudflare Workers5.1× faster15.5 µs3.0 µs1.0 µsGCP Storage96× faster673.9 µs6.2 µs7.0 µs
- GCP's official bar is cut to fit. The ratio compares the official SDK with the slower of distilled's two modes. Differences of a microsecond or two, like Cloudflare's strict bar, are within run-to-run noise.

Distilled with strict mode on is still 5 to 96 times faster per call
than official SDKs that check nothing.

Per call isn’t the whole story for a CLI or a Lambda function. What
they wait for is the cold start: import the SDK, set up a client and
make the first call, in a fresh process. Bundled the way Alchemy
deploys to Lambda and Workers, distilled starts 2.0× faster than the
official SDK on AWS, 3.0× on Cloudflare and 1.2× on GCP. We measured
this with a separate local harness that isn’t part of the benchmark
suite yet.

Unbundled, in plain `node_modules` like a CLI, distilled is slower on
AWS (107.5 ms against 42.8 ms) and GCP (96.0 ms against 67.2 ms), and
still faster on Cloudflare (94.3 ms against 156.2 ms), because Node
spends about 77 ms loading Effect’s ~150 separate modules, which a
bundle turns into one file.

The first call on its own is about 1.5 ms slower in distilled on
Cloudflare. The official SDK is a thin wrapper around `fetch`, and
about 0.9 ms of the gap is the tracing span Effect opens for every
request.

## Meta tree shaking
Section titled “Meta tree shaking” (#meta-tree-shaking)

SURELY we can’t be at the limit yet! KEEP GOING, like ride this crazy
wave all the way into the volcano mannnnnnnn! kawabunga!

That is the most unhinged message we sent the whole time, and it
produced the most unhinged idea. Importing all of AWS still took
35 MB, and the agent had told us that was close to the floor. After
the volcano message, it came back with this: do a bundler’s tree
shaking at run time, inside Node, on code that was never bundled.

### Operations as data
Section titled “Operations as data” (#operations-as-data)

Importing a service used to build every operation in it. EC2 has
hundreds of operations and AWS about 19,500. Now each operation waits
until someone calls it. We call this meta tree shaking. In spirit, the
published JavaScript looks like this:

```
let built;export const getDomain = (input) => {  // First call: build the real operation, then remember it.  built ??= API.make(() => ({    input: GetDomainRequest,    output: Domain,    errors: [UnknownResendError],    protocol: ResendProtocol,  }));  return built(input);};
```

 {  // First call: build the real operation, then remember it.  built ??= API.make(() => ({    input: GetDomainRequest,    output: Domain,    errors: [UnknownResendError],    protocol: ResendProtocol,  }));  return built(input);};">

The real output stores the description as a short string instead of
code, because a string takes less memory than the code that builds
the same object. Error classes work the same way, so a call that
succeeds never builds one.

### Tree shaking at run time
Section titled “Tree shaking at run time” (#tree-shaking-at-run-time)

A bundler drops unused code before you deploy. The Alchemy CLI doesn’t
bundle, so we do the same cut at run time instead. Every service ships
as two files: a tiny stub that Node loads, and the full module,
which stays on disk with an index at the end saying where each
operation’s bytes are and what it needs. This is the real start of the
stub for Fly.io’s `machines` service, exactly as it ships:

```
import{$L}from"../_bundle/lazy.js";const{o:$o,e:$e,E:$E}=/*@__PURE__*/$L("../services.full/machines.js","ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",55605,7533);
```

Yes, that’s 99 `o`s, one empty placeholder per operation. No human
would write this, and no human has to read it. The two numbers say
where the index is. The index looks like this:

```
#    name           bytes          needs44   getMachine     19123..19407   13 sdk.js helpers, __d660   listMachines   25842..26325   16 sdk.js helpers, __d6110  __d6           48375..48982   8 sdk.js helpers, __d3, __d5, __d4, __d22
```

That’s the dependency graph a bundler builds, written down for Node.
The first call to a placeholder reads just that operation’s bytes, then
follows `needs` the same way. Helpers in `sdk.js` are already loaded
with the stub, so they cost nothing.

### No eval, ever
Section titled “No eval, ever” (#no-eval-ever)

Reading part of a JavaScript file and running it sounds like it needs
`eval` or `new Function`. That would ruin the whole idea. Every `eval`
makes V8 parse and compile new code, which costs the time and memory
we were trying to save. It also means running bytes read from disk as
code, which security tools flag and many runtimes block outright.

So the full module never stores operations as code. It stores them as
data. This is the real entry for `getMachine`:

```
{input:#1,output:#9:4,errors:[$10,$11],protocol:$12,retry:$13}
```

`#1` is another entry in the same operation, and `#9:4` is an entry in
the shared holder for `Machine`. `$10` to `$13` are values already in
memory: the two error classes, the protocol and the retry policy. The
loader is a small interpreter for this format. It reads the bytes,
follows the references and calls the same schema-lite functions the
code would have called, so the result is identical. Nothing it reads
from disk is ever run as code, and V8 never compiles a single extra
line.

Step through a real traced run that calls `getMachine`, then
`listMachines`, then `getMachine` again. If you want to see how
unhinged it really is, tick the box under the figure for the shipped
code:

Your program

In memory · what it has loaded

in memory0 B

on disk63.2
KB

On disk · the full module, by byte offset

◀ Back
I can handle the truthNext ▶

Three calls read 13,629 of the file’s 63,178 bytes, and 7,533 of those
are the index.

Don’t worry: none of this touches your code unless you ask for it.
Stubs load only when Node resolves with the `distilled-lazy` export
condition (`node --conditions=distilled-lazy`). Plain Node and every
bundler get the normal full module.

### Importing a whole provider
Section titled “Importing a whole provider” (#importing-a-whole-provider)

Programs that import a whole provider are where meta tree shaking pays
off most. AWS went from 227 MB to 13.9 MB.

Memory to import every service of a provider
- before
- after
AWS (438)16× less227.0 MB13.9 MBGCP (318)12× less111.0 MB9.4 MBAzure (224)14× less112.0 MB8.0 MBCloudflare (129)24× less76.0 MB3.2 MB
- Import time fell too: AWS from 1.61 s to 0.14 s, Cloudflare from 0.63 s to 0.05 s.

Heap, provider imported · total over all providers · lower is betterRetained V8 heap after importing every service module of each provider in a fresh Node process.this work →← before
- 0 B
- 250.0 MB
- 500.0 MB
- 750.0 MB
- 1000.0 MB#40 Merge branch 'exp/data-tables' into perf/sdk-footprint: 219.6 MB#41 chore: remove scratch bundle output committed by mistake: 192.0 MB#44 Merge branch 'exp/lazy-errors' into perf/sdk-footprint: 165.9 MB#46 perf(build): lazy stubs write each export name once and import one package helper: 94.4 MB924.1 MB94.4 MB5358d6614d9302751b30be02e9d4d6ae0c8cced62abe830142298266be75448b2297eac5ca2e9bf8b544954ca6b1bc7899d2d5f33c0e8b9d1eae38c3a4309503057c5f9668561247e0554eeddef6019b3
The same metric summed over every provider: 924 MB at the start of the
branch, 94 MB at the end.

Most of what’s left for AWS is V8 itself. Every module Node loads
costs about 4.8 KB, and every named export about 325 bytes, even if
nothing reads it. All of AWS is 438 modules and tens of thousands of
exports, which comes to about 10 MB before any distilled code runs.
The only way below that is to export fewer names, which is an API
change.

## Breaking changes
Section titled “Breaking changes” (#breaking-changes)

Caution

These shipped in `@distilled.cloud/*` `1.0.0-rc.16`.

- Schema values are no longer exported. Use `op.input` and
`op.output`.

- Error classes do not validate their fields on construction.
`ParseError.cause` is a `SchemaMismatch` with a path.

- `SigV4.SigningKeyCache` is a plain store.

- `lib/` is bundled, minified, generated output.

`instanceof`, `_tag`, `Effect.catchTag` and the TypeScript types for
errors work as before.

## Try meta tree shaking in Alchemy
Section titled “Try meta tree shaking in Alchemy” (#try-meta-tree-shaking-in-alchemy)

The Alchemy CLI ships with meta tree shaking turned off. To opt in,
pass `--fast-distilled`, or set `ALCHEMY_FAST_DISTILLED=1`:

Terminal window
```
alchemy deploy --fast-distilled
```

The flag makes the CLI load distilled with the `distilled-lazy`
condition, so every provider your app imports starts as a stub. It
applies under Node. Under Bun it has no effect.

2.0.0-beta.85 - Effect 4.1, Domain Replay & DynamoDB State (/blog/2026-11-01-beta-85/)
2.0.0-beta.84 - Monorepo, Domain & Faster Distilled (/blog/2026-10-22-beta-84/)
