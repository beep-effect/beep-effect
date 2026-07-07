export const expandCurie = (curie: string): string | null => {
  const parts = curie.split(":");

  if (parts.length !== 2) {
    return null;
  }

  const [prefix, localName] = parts;

  if (prefix === "" || localName === "") {
    return null;
  }

  return `https://ns.beep.sh/${prefix}/${localName}`;
};
