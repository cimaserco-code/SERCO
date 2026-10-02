import { jsPDF } from "jspdf";
import { formatNombreNatural } from "@/lib/userNameFormatting";
import { supabase } from "@/lib/supabaseClient";

/**
 * Extracts Supabase Storage bucket and path if it's a supabase storage URL
 */
function parseSupabaseStorageUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const u = new URL(url);
      const publicPrefix = "/storage/v1/object/public/";
      const signPrefix = "/storage/v1/object/sign/";
      let pathPart = "";
      if (u.pathname.includes(publicPrefix)) {
        pathPart = u.pathname.slice(u.pathname.indexOf(publicPrefix) + publicPrefix.length);
      } else if (u.pathname.includes(signPrefix)) {
        pathPart = u.pathname.slice(u.pathname.indexOf(signPrefix) + signPrefix.length);
      }
      if (pathPart) {
        const decoded = decodeURIComponent(pathPart);
        const slashIdx = decoded.indexOf("/");
        if (slashIdx !== -1) {
          return {
            bucket: decoded.slice(0, slashIdx),
            path: decoded.slice(slashIdx + 1),
          };
        }
      }
    } else {
      if (url.startsWith("fotos_empleados/")) {
        return { bucket: "fotos_empleados", path: url.replace("fotos_empleados/", "") };
      }
      if (url.startsWith("fotos/")) {
        return { bucket: "documentos", path: url };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Converts a Blob to a base64 Data URL
 */
function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Safely resolves any photo URL (base64 Data URL, Supabase Storage URL, or web URL)
 * into a base64 Data URL that is non-tainted and safe for canvas / jsPDF export.
 */
async function resolveImageToDataUrl(src) {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  // 1. Already a data URL
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  // 2. Supabase storage URL: download binary blob directly with client (bypasses CORS)
  const sbInfo = parseSupabaseStorageUrl(trimmed);
  if (sbInfo) {
    try {
      const { data, error } = await supabase.storage.from(sbInfo.bucket).download(sbInfo.path);
      if (!error && data) {
        const dataUrl = await blobToDataUrl(data);
        if (dataUrl) return dataUrl;
      }
    } catch (e) {
      console.warn("Storage download failed, attempting fetch:", e);
    }
  }

  // 3. Direct fetch
  try {
    const res = await fetch(trimmed);
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) return dataUrl;
    }
  } catch (e) {
    console.warn("Fetch failed, will fallback to raw URL:", e);
  }

  return trimmed;
}

/**
 * Loads an HTMLImageElement safely.
 * Never sets crossOrigin on data: or blob: URIs to avoid browser security rejections.
 */
function loadImageSafe(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      img.crossOrigin = "Anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (img.crossOrigin) {
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.onerror = () => resolve(null);
        fallback.src = src;
      } else {
        resolve(null);
      }
    };
    img.src = src;
  });
}

/**
 * Crops and rounds the image to exact dimensions with cover centering,
 * returning a clean PNG Data URL suitable for jsPDF.
 */
function createRoundedImage(img, width, height, radius = 6) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    const nw = img.naturalWidth || img.width || width;
    const nh = img.naturalHeight || img.height || height;
    const imgRatio = nw / nh;
    const targetRatio = width / height;

    let sx = 0, sy = 0, sw = nw, sh = nh;
    if (imgRatio > targetRatio) {
      sw = nh * targetRatio;
      sx = (nw - sw) / 2;
    } else {
      sh = nw / targetRatio;
      sy = (nh - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Error rounding image:", e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GAFETE MONTERREY (CR80: 54mm x 86mm)
// ═════════════════════════════════════════════════════════════════════════════
export async function generateGafeteMonterreyPDF(emp, params = {}, options = {}) {
  const isLetterSheet = options.layout === "hoja_carta";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: isLetterSheet ? "letter" : [54, 86],
  });

  const photoRawUrl = params.foto_url || emp.foto_url;
  const [logoImg, photoDataUrl] = await Promise.all([
    loadImageSafe("/gafete/logo_serco.png"),
    resolveImageToDataUrl(photoRawUrl),
  ]);

  const photoImg = photoDataUrl ? await loadImageSafe(photoDataUrl) : null;

  const drawCardFront = (startX, startY) => {
    // Fondo y borde
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 210, 215);
    doc.roundedRect(startX, startY, 54, 86, 3, 3, "FD");

    // Header superior
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    doc.text("CIMA-SERCO", startX + 27, startY + 6, { align: "center" });

    doc.setFontSize(4.2);
    doc.setTextColor(100, 100, 105);
    doc.text("SEGURIDAD PRIVADA Y CONFIABILIDAD S.A. DE C.V.", startX + 27, startY + 8.5, { align: "center" });

    // Logo SERCO
    if (logoImg) {
      doc.addImage(logoImg, "PNG", startX + 20, startY + 10, 14, 14);
    }

    // Fotografía
    const photoX = startX + 15;
    const photoY = startY + 25.5;
    const photoW = 24;
    const photoH = 28;

    if (photoImg) {
      const roundedPhoto = createRoundedImage(photoImg, 300, 350, 16);
      if (roundedPhoto) {
        doc.addImage(roundedPhoto, "PNG", photoX, photoY, photoW, photoH);
      } else if (photoDataUrl) {
        doc.addImage(photoDataUrl, "JPEG", photoX, photoY, photoW, photoH);
      }
      doc.setDrawColor(180, 150, 80);
      doc.setLineWidth(0.4);
      doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, "D");
    } else {
      // Placeholder
      doc.setFillColor(240, 240, 245);
      doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 145);
      doc.text("SIN FOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
    }

    // Nombre del empleado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);
    const nombre = (formatNombreNatural(emp) || emp.nombre_completo || "EMPLEADO").toUpperCase();
    const nameLines = doc.splitTextToSize(nombre, 48);
    let curY = startY + 57;
    nameLines.forEach((line) => {
      doc.text(line, startX + 27, curY, { align: "center" });
      curY += 3.2;
    });

    // Puesto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(170, 130, 45); // Tono dorado institucional
    const puesto = (emp.puesto || "GUARDIA DE SEGURIDAD").toUpperCase();
    doc.text(puesto, startX + 27, Math.max(curY + 0.5, startY + 61), { align: "center" });

    // Línea divisoria fina
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(startX + 5, startY + 63.5, startX + 49, startY + 63.5);

    // Datos: Teléfono, CURP, RFC
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(40, 40, 40);

    const dataY = startY + 66.5;
    doc.text(`Teléfono: ${emp.telefono || "—"}`, startX + 6, dataY);
    doc.text(`Curp: ${emp.curp || "—"}`, startX + 6, dataY + 3.2);
    doc.text(`Rfc: ${emp.rfc || "—"}`, startX + 6, dataY + 6.4);

    // Franja inferior con Permiso y Vigencia
    doc.setFillColor(25, 26, 28);
    doc.roundedRect(startX, startY + 77.5, 54, 8.5, 0, 0, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.5);
    doc.setTextColor(255, 255, 255);
    doc.text("PERMISO ESTATAL: DCSESSPNL/879-25/I-II", startX + 27, startY + 81, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.2);
    doc.setTextColor(220, 220, 225);
    doc.text(`Vigencia: ${params.vigencia || "31/12/2026"}`, startX + 27, startY + 84, { align: "center" });
  };

  const drawCardBack = (startX, startY) => {
    // Fondo y borde
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 210, 215);
    doc.roundedRect(startX, startY, 54, 86, 3, 3, "FD");

    // Logo SERCO
    if (logoImg) {
      doc.addImage(logoImg, "PNG", startX + 20, startY + 5, 14, 14);
    }

    // Sección CONTACTO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(25, 25, 28);
    doc.text("CONTACTO", startX + 27, startY + 22.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.setTextColor(60, 60, 65);
    doc.text("Dr. Coss #403A norte esquina M.M. Del Llano", startX + 27, startY + 26, { align: "center" });
    doc.text("Centro de Monterrey. C.P. 64000, Monterrey, N.L.", startX + 27, startY + 28.5, { align: "center" });
    doc.text("TEL: 811-0452422", startX + 27, startY + 31.5, { align: "center" });
    doc.text("EMAIL: serconuevoleon@seguridad.com.mx", startX + 27, startY + 34, { align: "center" });

    // Separador
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(startX + 8, startY + 38, startX + 46, startY + 38);

    // Sección CONTACTO ÁREA OPERATIVA
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(25, 25, 28);
    doc.text("CONTACTO ÁREA OPERATIVA", startX + 27, startY + 43.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(40, 40, 40);
    doc.text("OF. PFC M. Eduardo Sommer M.", startX + 27, startY + 48, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(80, 80, 85);
    doc.text("Director Operativo", startX + 27, startY + 50.8, { align: "center" });
    doc.text("TEL. 2223346635", startX + 27, startY + 53.5, { align: "center" });

    // Director General
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(40, 40, 40);
    doc.text("Ing. Carlos De Arcangelis Ramos", startX + 27, startY + 59, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(80, 80, 85);
    doc.text("Director General", startX + 27, startY + 61.8, { align: "center" });

    // Footer de Sede
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4);
    doc.setTextColor(140, 140, 145);
    doc.text("CIMA-SERCO · Sede Monterrey", startX + 27, startY + 80, { align: "center" });
  };

  if (isLetterSheet) {
    const startY = 70;
    const startX1 = 45;
    const startX2 = 115;
    drawCardFront(startX1, startY);
    drawCardBack(startX2, startY);

    // Guías de corte
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 125);
    doc.text("PLANTILLA IMPRIMIBLE DE GAFETES SERCO - SEDE MONTERREY", 107.5, 45, { align: "center" });
    doc.setFontSize(7);
    doc.text("Imprima al 100% de escala (tamaño real), recorte por el borde y enmique en calor.", 107.5, 50, { align: "center" });
  } else {
    // Formato CR80 (Página 1: Frente, Página 2: Reverso)
    drawCardFront(0, 0);
    doc.addPage([54, 86], "portrait");
    drawCardBack(0, 0);
  }

  const filename = `Gafete_Monterrey_${(emp.nombre_completo || "Empleado").replace(/\s+/g, "_")}.pdf`;

  if (options.returnDoc) {
    const blobUrl = doc.output("bloburl");
    return { doc, blobUrl, filename };
  }

  doc.save(filename);
  return { doc, filename };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. GAFETE OTRAS SEDES (VERACRUZ / XALAPA - CR80: 54mm x 86mm)
// ═════════════════════════════════════════════════════════════════════════════
export async function generateGafeteOtrasSedesPDF(emp, params = {}, options = {}) {
  const isLetterSheet = options.layout === "hoja_carta";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: isLetterSheet ? "letter" : [54, 86],
  });

  const photoRawUrl = params.foto_url || emp.foto_url;
  const [bgFrontImg, logoImg, photoDataUrl] = await Promise.all([
    loadImageSafe("/gafete/gafete_frente_veracruz_bg.png"),
    loadImageSafe("/gafete/logo_serco.png"),
    resolveImageToDataUrl(photoRawUrl),
  ]);

  const photoImg = photoDataUrl ? await loadImageSafe(photoDataUrl) : null;

  const drawCardFront = (startX, startY) => {
    // Fondo estilizado oficial (curva dorada/negra, logo superior y permisos)
    if (bgFrontImg) {
      doc.addImage(bgFrontImg, "PNG", startX, startY, 54, 86);
    } else {
      // Fallback si no está disponible la imagen de fondo
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(210, 210, 215);
      doc.roundedRect(startX, startY, 54, 86, 3, 3, "FD");

      if (logoImg) {
        doc.addImage(logoImg, "PNG", startX + 3, startY + 3, 11, 11);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(30, 30, 30);
      doc.text("CIMA-SERCO, SEGURIDAD", startX + 38, startY + 5.5, { align: "center" });
      doc.text("PRIVADA Y CONFIABILIDAD", startX + 38, startY + 8, { align: "center" });
      doc.text("S.A. DE C.V.", startX + 38, startY + 10.5, { align: "center" });

      doc.setFontSize(4.2);
      doc.setTextColor(180, 140, 45);
      doc.text("PERMISO ESTATAL VERACRUZ: S.PR. 310/2023/RA-25", startX + 27, startY + 74, { align: "center" });
      doc.text("PERMISO ESTATAL NUEVO LEÓN: DCSESSPNL/879-25/I-II", startX + 27, startY + 77.5, { align: "center" });
      doc.setTextColor(60, 60, 65);
      doc.text(`VIGENCIA: ${params.vigencia || "31 DE DICIEMBRE 2026"}`, startX + 27, startY + 81, { align: "center" });
    }

    // Fotografía del empleado en ventana oficial
    const photoX = startX + 18.5;
    const photoY = startY + 8.5;
    const photoW = 34.5;
    const photoH = 38;

    if (photoImg) {
      const roundedPhoto = createRoundedImage(photoImg, 350, 390, 18);
      if (roundedPhoto) {
        doc.addImage(roundedPhoto, "PNG", photoX, photoY, photoW, photoH);
      } else if (photoDataUrl) {
        doc.addImage(photoDataUrl, "JPEG", photoX, photoY, photoW, photoH);
      }
    } else {
      // Placeholder elegante si el empleado no tiene foto
      doc.setFillColor(235, 235, 240);
      doc.roundedRect(photoX, photoY, photoW, photoH, 3, 3, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(140, 140, 145);
      doc.text("SIN FOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
    }

    // Nombre completo del empleado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(25, 25, 28);
    const nombre = (formatNombreNatural(emp) || emp.nombre_completo || "EMPLEADO").toUpperCase();
    const nameLines = doc.splitTextToSize(nombre, 44);
    let curY = startY + 50.5;
    nameLines.forEach((line) => {
      doc.text(line, startX + 27, curY, { align: "center" });
      curY += 3.2;
    });

    // Puesto del empleado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(30, 30, 30);
    const puesto = (emp.puesto || "GUARDIA DE SEGURIDAD").toUpperCase();
    doc.text(puesto, startX + 27, Math.max(curY + 0.5, startY + 56.5), { align: "center" });
  };

  const drawCardBack = (startX, startY) => {
    // Fondo y borde
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 210, 215);
    doc.roundedRect(startX, startY, 54, 86, 3, 3, "FD");

    // Logo SERCO
    if (logoImg) {
      doc.addImage(logoImg, "PNG", startX + 20, startY + 4, 14, 14);
    }

    // Sección CONTACTO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(25, 25, 28);
    doc.text("CONTACTO", startX + 27, startY + 21, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.3);
    doc.setTextColor(60, 60, 65);
    doc.text("Av de las Magnolias No. 30 Bis", startX + 27, startY + 24.5, { align: "center" });
    doc.text("Col. Fuentes de las Ánimas, C.P. 91190,", startX + 27, startY + 27, { align: "center" });
    doc.text("Xalapa, Veracruz.", startX + 27, startY + 29.5, { align: "center" });
    doc.text("TEL. (228) 1548022", startX + 27, startY + 32.5, { align: "center" });
    doc.text("EMAIL: contacto@sercoseguridad.com.mx", startX + 27, startY + 35, { align: "center" });

    // Separador
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(startX + 8, startY + 38.5, startX + 46, startY + 38.5);

    // Sección CONTACTO ÁREA OPERATIVA
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(25, 25, 28);
    doc.text("CONTACTO ÁREA OPERATIVA", startX + 27, startY + 43, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(40, 40, 40);
    doc.text("M. EDUARDO SOMMER MÁRQUEZ", startX + 27, startY + 47.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.6);
    doc.setTextColor(80, 80, 85);
    doc.text("Director Operativo", startX + 27, startY + 50.3, { align: "center" });
    doc.text("Tel: 2881136384", startX + 27, startY + 53, { align: "center" });

    // Separador fino
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(startX + 8, startY + 56.5, startX + 46, startY + 56.5);

    // Sección FIRMA / DIRECTORA GENERAL
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.6);
    doc.setTextColor(100, 100, 105);
    doc.text("Firma", startX + 27, startY + 61.5, { align: "center" });

    // Línea de firma
    doc.setDrawColor(180, 180, 185);
    doc.setLineWidth(0.3);
    doc.line(startX + 12, startY + 68.5, startX + 42, startY + 68.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.3);
    doc.setTextColor(40, 40, 40);
    doc.text("SARAHÍ PEÑA GALAVIZ", startX + 27, startY + 72, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.6);
    doc.setTextColor(80, 80, 85);
    doc.text("Directora general", startX + 27, startY + 75, { align: "center" });

    // Footer de Sede
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4);
    doc.setTextColor(140, 140, 145);
    doc.text("CIMA-SERCO · Sede Veracruz / Otras Sedes", startX + 27, startY + 81, { align: "center" });
  };

  if (isLetterSheet) {
    const startY = 70;
    const startX1 = 45;
    const startX2 = 115;
    drawCardFront(startX1, startY);
    drawCardBack(startX2, startY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 125);
    doc.text("PLANTILLA IMPRIMIBLE DE GAFETES SERCO - OTRAS SEDES (VERACRUZ / XALAPA)", 107.5, 45, { align: "center" });
    doc.setFontSize(7);
    doc.text("Imprima al 100% de escala (tamaño real), recorte por el borde y enmique en calor.", 107.5, 50, { align: "center" });
  } else {
    // Formato CR80 (Página 1: Frente, Página 2: Reverso)
    drawCardFront(0, 0);
    doc.addPage([54, 86], "portrait");
    drawCardBack(0, 0);
  }

  const filename = `Gafete_${(emp.nombre_completo || "Empleado").replace(/\s+/g, "_")}.pdf`;

  if (options.returnDoc) {
    const blobUrl = doc.output("bloburl");
    return { doc, blobUrl, filename };
  }

  doc.save(filename);
  return { doc, filename };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. GENERADOR PRINCIPAL (DISPATCHER)
// ═════════════════════════════════════════════════════════════════════════════
export async function generateGafetePDF(emp, params = {}, sedes = [], options = {}) {
  // Respetar estrictamente la plantilla seleccionada por el usuario
  let sedeTipo = params.sede_tipo;
  if (!sedeTipo) {
    const sedeId = emp?.sede_id || options?.defaultSedeId;
    const sedeObj = (sedes || []).find((s) => s.id === sedeId);
    const isMty = (sedeObj?.nombre || "").toLowerCase().includes("monterrey");
    sedeTipo = isMty ? "monterrey" : "otras_sedes";
  }

  if (sedeTipo === "monterrey") {
    return generateGafeteMonterreyPDF(emp, params, options);
  }
  return generateGafeteOtrasSedesPDF(emp, params, options);
}
