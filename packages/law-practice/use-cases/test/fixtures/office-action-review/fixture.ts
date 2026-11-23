import * as A from "effect/Array";

export const text =
  "Synthetic Office Action\nClaim: A vessel with a handle.\nReference: Jones.\nDistinction: An insulated handle.\n";
export const modelOutput =
  '{"extractions":[{"label":"office_action","text":"Synthetic Office Action"},{"label":"claim","text":"A vessel with a handle."},{"label":"rejection_reference","text":"Jones"},{"label":"distinction","text":"an insulated handle"}]}';
export const missingOutput =
  '{"extractions":[{"label":"office_action","text":"Synthetic Office Action"},{"label":"claim","text":"A vessel with a handle."},{"label":"rejection_reference","text":"Jones"}]}';
export const unalignedOutput =
  '{"extractions":[{"label":"office_action","text":"Synthetic Office Action"},{"label":"claim","text":"A vessel with a handle."},{"label":"rejection_reference","text":"Jones"},{"label":"distinction","text":"Invisible insulation"}]}';
export const overCapOutput = `{"extractions":[${A.join(
  [
    '{"label":"office_action","text":"Synthetic Office Action"}',
    '{"label":"rejection_reference","text":"Jones"}',
    ...A.replicate('{"label":"claim","text":"A vessel with a handle."}', 254),
    '{"label":"distinction","text":"an insulated handle"}',
  ],
  ","
)}]}`;
