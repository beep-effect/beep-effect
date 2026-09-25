# Bounded html-img baseline probe

Run the following TypeScript through `bun run -` on stdin from the repository root.
This records current behavior; it does not verify an implemented replacement.
Link probe imports were normalized from private absolute paths; logic is unchanged.

```ts
import { inspectConformance } from "./packages/foundation/modeling/html/src/Html.conformance.ts";
import { inspectSrcset } from "./packages/foundation/modeling/html/src/Html.srcset.ts";
import { inspectSourceSizeList } from "./packages/foundation/modeling/html/src/Html.source-size.ts";
import { Img, Picture, Source, Fragment } from "./packages/foundation/modeling/html/src/Html.model.ts";
import { htmlAttributeValue, hasHtmlAttribute } from "./packages/foundation/modeling/html/src/internal/conformance/Html.conformance-contracts.ts";
import { toAsciiLowerCase } from "./packages/foundation/modeling/html/src/Html.foreign.ts";
import * as O from "effect/Option"; import * as R from "effect/Result";
const srcsets=[undefined,"a.png 1x, b.png 1x","a.png 1x","a.png 400w"];
const sizess=[undefined,"10%","100vw","AUTO","auto, 100vw"];
const missing="<img srcset> using width descriptors requires sizes";
const incompatible="<img sizes> requires a width-descriptor srcset, except for loading=lazy with sizes=auto";
const image=(fields)=>Img.make({alt:O.some("image"),src:O.some("/fallback.png"),...fields});
const rows=[];const tuples=new Set();
for(const srcset of srcsets)for(const sizes of sizess)for(const lazy of [false,true]) {
 const src=O.fromUndefinedOr(srcset),sz=O.fromUndefinedOr(sizes);
 // The four witness URL strings are well formed; callback is not a general URL-validation proof.
 const p=srcset===undefined?O.none():inspectSrcset(srcset,()=>true);
 const a=sizes===undefined?O.none():R.match(inspectSourceSizeList(sizes),{onFailure:O.none,onSuccess:O.some});
 const hasSrcset=hasHtmlAttribute(src),hasSizes=hasHtmlAttribute(sz),exact=sizes!==undefined&&toAsciiLowerCase(sizes)==="auto";
 const miss=O.contains(p,"width")&&!hasSizes;
 const inc=O.exists(a,v=>!hasSrcset?(!lazy||!exact):O.contains(p,"density")?true:O.contains(p,"width")&&v.usesAuto&&!lazy);
 const bits=[hasSrcset,hasSizes,lazy,exact,miss,inc].map(Number).join("");tuples.add(bits);
 const disposition=!hasSizes?(O.contains(p,"width")?"absent-missing":"absent-ok"):O.isNone(a)?"present-ok":!hasSrcset?(lazy&&exact?"present-ok":"present-incompatible"):O.contains(p,"density")?"present-incompatible":O.contains(p,"width")&&a.value.usesAuto&&!lazy?"present-incompatible":"present-ok";
 const issues=inspectConformance(image({srcset:src,sizes:sz,loading:O.some(lazy?"lazy":"eager")}));
 const relation=issues.filter(i=>i.message===missing||i.message===incompatible);
 const expected=miss?[missing]:inc?[incompatible]:[];
 if(JSON.stringify(relation.map(i=>i.message))!==JSON.stringify(expected))throw Error("public mismatch");
 if((disposition==="absent-missing")!==miss||(disposition==="present-incompatible")!==inc)throw Error("disposition mismatch");
 rows.push({srcset:srcset??null,sizes:sizes??null,lazy,bits,disposition,issues});
}
const extras=[" auto","auto ","auto/*comment*/,100vw","auto, 100vw","AUTO"].map(sizes=>({sizes,issues:inspectConformance(image({loading:O.some("lazy"),sizes:O.some(sizes)}))}));
const presence=[undefined,null,false,0,"",O.none(),O.some(undefined),O.some(null)].map((value,index)=>({index,present:hasHtmlAttribute(value),string:O.exists(htmlAttributeValue(value),v=>typeof v==="string")}));
const pictures=["AUTO","auto, 100vw","auto ","100vw"].map(sizes=>({sizes,issues:inspectConformance(Picture.make({children:[Source.make({srcset:O.some("wide.png 800w"),type:O.some("image/webp")}),image({loading:O.some("lazy"),sizes:O.some(sizes),srcset:O.some("a.png 400w")})]}))}));
const nested=inspectConformance(Fragment.make({children:[image({sizes:O.some("100vw"),srcset:O.some("a.png 1x")})]}));
console.log(JSON.stringify({count:rows.length,tupleCount:tuples.size,tuples:[...tuples].sort(),rows,extras,presence,pictures,nested},null,2));
```
