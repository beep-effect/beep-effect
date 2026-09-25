# Bounded html-link baseline probe

Run the following TypeScript through `bun run -` on stdin from the repository root.
This records current behavior; it does not verify an implemented replacement.
Link probe imports were normalized from private absolute paths; logic is unchanged.

```ts
import { inspectConformance } from './packages/foundation/modeling/html/src/Html.conformance.ts';
import { Link } from './packages/foundation/modeling/html/src/Html.model.ts';
import * as O from 'effect/Option';
const srcsets = [undefined, 'small.png 400w', 'small.png 1x', 'bad%url 1x'];
const sizes = [undefined, '100vw', 'auto', '10%'];
const rows = [];
for (const imagesrcset of srcsets) for (const imagesizes of sizes) for (const icon of [false, true]) {
 const issues = inspectConformance(Link.make({ as: O.some('image'), rel: O.some('preload'), href: O.some('/fallback.png'), imagesrcset: O.fromUndefinedOr(imagesrcset), imagesizes: O.fromUndefinedOr(imagesizes), sizes: icon ? O.some('any') : O.none() }));
 const expected = [];
 if (imagesizes === undefined && imagesrcset === 'small.png 400w') expected.push('<link imagesrcset> using width descriptors requires imagesizes');
 if (imagesizes !== undefined && imagesizes !== '10%' && (imagesrcset === undefined || imagesrcset === 'small.png 1x')) expected.push('<link imagesizes> requires a width-descriptor imagesrcset');
 if(icon) expected.push('<link sizes> requires an icon link relation');
 const actual = issues.filter(x => ['<link imagesrcset> using width descriptors requires imagesizes', '<link imagesizes> requires a width-descriptor imagesrcset', '<link sizes> requires an icon link relation'].includes(x.message)).map(x => x.message);
 if(JSON.stringify(actual)!==JSON.stringify(expected)) throw Error(JSON.stringify({imagesrcset,imagesizes,icon,actual,expected}));
 if (imagesizes === '10%' && !issues.some(x => x.message === '<link imagesizes> is not a valid source-size-list')) throw Error('Missing syntax issue');
 rows.push({imagesrcset: imagesrcset ?? null,imagesizes: imagesizes ?? null,icon,issues});
}
console.log(JSON.stringify({count: rows.length, rows}, null,2));
```
