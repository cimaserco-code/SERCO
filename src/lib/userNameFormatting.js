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

export function parseExistingNombre(item) {
  if (!item) return { nombres: "", apellido_paterno: "", apellido_materno: "" };
  if (item.nombres || item.apellido_paterno) {
    return {
      nombres: item.nombres || "",
      apellido_paterno: item.apellido_paterno || "",
      apellido_materno: item.apellido_materno || "",
    };
  }
  const full = (item.nombre_completo || "").trim();
  if (!full) return { nombres: "", apellido_paterno: "", apellido_materno: "" };

  const parts = full.split(/\s+/);
  if (parts.length === 1) {
    return { nombres: parts[0], apellido_paterno: "", apellido_materno: "" };
  } else if (parts.length === 2) {
    return { apellido_paterno: parts[0], nombres: parts[1], apellido_materno: "" };
  } else if (parts.length === 3) {
    return { apellido_paterno: parts[0], apellido_materno: parts[1], nombres: parts[2] };
  } else {
    return {
      apellido_paterno: parts[0],
      apellido_materno: parts[1],
      nombres: parts.slice(2).join(" "),
    };
  }
}

/**
 * Retorna el nombre en formato: primero el nombre, luego apellido paterno y luego materno
 */
export function formatNombreNatural(item) {
  if (!item) return "";
  if (typeof item === "string") {
    const parsed = parseExistingNombre({ nombre_completo: item });
    const formatted = [parsed.nombres, parsed.apellido_paterno, parsed.apellido_materno].filter(Boolean).join(" ");
    return formatPersonName(formatted || item);
  }
  const { nombres, apellido_paterno, apellido_materno } = parseExistingNombre(item);
  const formatted = [nombres, apellido_paterno, apellido_materno].filter(Boolean).join(" ");
  return formatPersonName(formatted || item.nombre_completo || "");
}