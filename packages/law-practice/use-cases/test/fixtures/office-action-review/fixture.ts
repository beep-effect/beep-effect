export const text =
  "Synthetic Office Action\nClaim: A vessel with a handle.\nReference: Jones.\nDistinction: An insulated handle.\n";
export const modelOutput =
  '{"extractions":[{"label":"office_action","text":"Synthetic Office Action"},{"label":"claim","text":"A vessel with a handle."},{"label":"rejection_reference","text":"Jones"},{"label":"distinction","text":"an insulated handle"}]}';
export const missingOutput =
  '{"extractions":[{"label":"office_action","text":"Synthetic Office Action"},{"label":"claim","text":"A vessel with a handle."},{"label":"rejection_reference","text":"Jones"}]}';
export const unalignedOutput =
  '{"extractions":[{"label":"office_action","text":"Synthetic Office Action"},{"label":"claim","text":"A vessel with a handle."},{"label":"rejection_reference","text":"Jones"},{"label":"distinction","text":"Invisible insulation"}]}';
