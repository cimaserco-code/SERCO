const spanishLocale = "es-MX";

function capitalizeNamePart(part) {
  const lowerPart = part.toLocaleLowerCase(spanishLocale);
  const firstLetterIndex = lowerPart.search(/\p{L}/u);

  if (firstLetterIndex === -1) return lowerPart;

  return `${lowerPart.slice(0, firstLetterIndex)}${lowerPart[firstLetterIndex].toLocaleUpperCase(spanishLocale)}${lowerPart.slice(firstLetterIndex + 1)}`;
}

export function formatUserDisplayName(name, role) {
  const value = String(name || "").trim();
  if (!value) return value;

  if (String(role || "").trim().toLocaleLowerCase(spanishLocale) === "monitorista") {
    return value.toLocaleUpperCase(spanishLocale);
  }

  return formatPersonName(value);
}

export function formatPersonName(name) {
  const value = String(name || "").trim();
  if (!value) return value;

  return value
    .split(/\s+/)
    .map((word) => word.split(/([-'])/).map(capitalizeNamePart).join(""))
    .join(" ");
}