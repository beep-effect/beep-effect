# Select grammar bounded probe

Source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Executed as Bun eval from the repository root; exit 0. This compares a proposed derivation on bounded sequences and captures current public AST diagnostics, not an implemented refactor or exhaustive AST validation. Results: [JSON](./html-select-behavior-probe-2026-09-22.json).

```ts
import { inspectConformance } from "./packages/foundation/modeling/html/src/Html.conformance.ts";
import * as M from "./packages/foundation/modeling/html/src/Html.model.ts";
import { Text, Comment } from "./packages/foundation/modeling/html/src/Html.nodes.ts";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
const G=LiteralKit(["traditional","customizable","invalid"]);
const classify=(tags)=>A.every(tags,t=>t==="option"||t==="optgroup"||t==="hr")?G.Enum.traditional:tags[0]==="button"&&A.every(A.drop(tags,1),t=>t==="option"||t==="optgroup"||t==="hr"||t==="div")?G.Enum.customizable:G.Enum.invalid;
let count=0; const pairs=new Set(); const alphabet=["option","optgroup","hr","button","div","span"];
function check(tags){ const t=A.every(tags,x=>x==="option"||x==="optgroup"||x==="hr"); const c=tags[0]==="button"&&A.every(A.drop(tags,1),x=>x==="option"||x==="optgroup"||x==="hr"||x==="div"); const next=classify(tags); pairs.add(`${t}/${c}`); if ((t||c)!==(next!=="invalid")) throw new Error("mismatch"); count++;if(tags.length<5) for(const tag of alphabet)check([...tags,tag]); }
check([]);
const node=(tag)=>tag==="text"?Text.fromValue("significant"):tag==="space"?Text.fromValue(" "):tag==="comment"?Comment.fromValue("note"):tag==="foreign"?M.ForeignElement.make({namespace:"svg",name:"svg",children:[]}):tag==="hr"?M.Hr.make({}):tag==="script"?M.Script.make({content:""}):({option:M.Option,optgroup:M.Optgroup,button:M.Button,div:M.Div,span:M.Span,template:M.Template}[tag]).make({children:[]});
const cases=[[],["option"],["optgroup"],["hr"],["button"],["div"],["button","div"],["button","option"],["button","optgroup"],["button","hr"],["button","span"],["button","button"],["option","button"],["script","template"],["script","button","template","div"],["text"],["foreign"],["space","comment"],["button","text","div"],["button","foreign","div"],["text","span"]];
const results=cases.map(tags=>({tags,grammar:classify(tags.filter(t=>!["script","template","text","space","comment","foreign"].includes(t))),issues:inspectConformance(M.Select.make({children:tags.map(node)}))}));
console.log(JSON.stringify({abstractCount:count,abstractMaxLength:5,pairs:[...pairs],publicCases:results},null,2));
```
