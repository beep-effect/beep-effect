export const summaryFromComment = (comment: string): string | undefined => {
  const marker = "Summary:";
  const markerIndex = comment.indexOf(marker);

  if (markerIndex === -1) {
    return undefined;
  }

  const summary = comment.slice(markerIndex + marker.length).trim();

  if (summary === "") {
    return undefined;
  }

  return summary;
};
