import { jsPDF } from "jspdf";
import { formatNombreNatural } from "@/lib/userNameFormatting";
import { supabase } from "@/lib/supabaseClient";

export function loadLogoImage(src = "/favicon.png") {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function loadImageSafe(url, emp) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** @param {string} fotoUrl */
function getEmployeePhotoPath(fotoUrl) {
  try {
    const url = new URL(fotoUrl);
    const objectPrefix = "/storage/v1/object/public/documentos/";
    if (!url.pathname.startsWith(objectPrefix)) return null;

    const path = decodeURIComponent(url.pathname.slice(objectPrefix.length));
    const segments = path.split("/");
    if (segments[0] !== "fotos" || segments.length < 2 || segments.some((part) => !part || part === "." || part === "..")) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/** @param {string} fotoUrl */
async function loadEmployeePhoto(fotoUrl) {
  if (typeof fotoUrl === "string" && /^data:image\/(?:webp|jpeg|png);base64,/i.test(fotoUrl)) {
    return loadImageSafe(fotoUrl);
  }

  const path = getEmployeePhotoPath(fotoUrl);
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage.from("documentos").download(path);
    if (error || !data) return null;

    const objectUrl = URL.createObjectURL(data);
    try {
      return await loadImageSafe(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "___";
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return isNaN(edad) ? "___" : `${edad} AÑOS`;
}

export async function generateFichaTecnicaPDF(emp, params = {}, options = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter"
  });

  const [logoImg, photoImg] = await Promise.all([
    loadLogoImage("/favicon.png"),
    emp?.foto_url ? loadEmployeePhoto(emp.foto_url) : Promise.resolve(null)
  ]);

  const pageWidth = doc.internal.pageSize.width; // 215.9 mm
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2); // 187.9 mm

  // Watermark (Marca de Agua) en el fondo - tamaño ajustado a media página
  if (logoImg) {
    try {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.07 }));
      const logoSize = 85;
      doc.addImage(
        logoImg,
        "PNG",
        (pageWidth - logoSize) / 2,
        45,
        logoSize,
        logoSize,
        undefined,
        "FAST"
      );
      doc.restoreGraphicsState();
    } catch (e) {
      console.warn("Watermark error in Ficha Técnica:", e);
    }
  }

  // ══════════════════════════════════════════════════════════
  // ENCABEZADO INSTITUCIONAL
  // ══════════════════════════════════════════════════════════
  let y = 14;

  if (logoImg) {
    try {
      doc.addImage(logoImg, "PNG", margin, y, 15, 15);
    } catch {}
  }

  // Títulos institucionales
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(24, 30, 42);
  doc.text("CIMA-SERCO SEGURIDAD PRIVADA Y CONFIABILIDAD, S.A. DE C.V.", margin + 18, y + 4);

  doc.setFontSize(9.5);
  doc.setTextColor(70, 80, 95);
  doc.text("RECURSOS HUMANOS", margin + 18, y + 8.5);

  doc.setFontSize(8);
  doc.setTextColor(100, 110, 120);
  doc.text("FORMATO DE MOVIMIENTO DE PERSONAL", margin + 18, y + 13);

  // Fecha y Folio top right
  const todayStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${todayStr}`, pageWidth - margin, y + 4, { align: "right" });
  doc.text(`Folio Emp: ${emp.numero_empleado || "S/N"}`, pageWidth - margin, y + 9, { align: "right" });

  y += 18;

  // ══════════════════════════════════════════════════════════
  // SECCIÓN: TIPO DE MOVIMIENTO (ALTA / BAJA)
  // ══════════════════════════════════════════════════════════
  const tipoMov = (params.tipo_movimiento || (emp.fecha_baja ? "BAJA" : "ALTA")).toUpperCase();
  const isAlta = tipoMov === "ALTA";
  const isBaja = tipoMov === "BAJA";

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 8, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("TIPO DE MOVIMIENTO:", margin + 4, y + 5.3);

  // Checkbox ALTA
  doc.rect(margin + 48, y + 1.8, 4.4, 4.4, "S");
  if (isAlta) {
    doc.setFillColor(16, 185, 129);
    doc.rect(margin + 48, y + 1.8, 4.4, 4.4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("X", margin + 49.1, y + 5.1);
  }
  doc.setFont("helvetica", isAlta ? "bold" : "normal");
  doc.setFontSize(8.5);
  if (isAlta) doc.setTextColor(5, 150, 105);
  else doc.setTextColor(71, 85, 105);
  doc.text("ALTA", margin + 55, y + 5.3);

  // Checkbox BAJA
  doc.rect(margin + 85, y + 1.8, 4.4, 4.4, "S");
  if (isBaja) {
    doc.setFillColor(239, 68, 68);
    doc.rect(margin + 85, y + 1.8, 4.4, 4.4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("X", margin + 86.1, y + 5.1);
  }
  doc.setFont("helvetica", isBaja ? "bold" : "normal");
  doc.setFontSize(8.5);
  if (isBaja) doc.setTextColor(220, 38, 38);
  else doc.setTextColor(71, 85, 105);
  doc.text("BAJA", margin + 92, y + 5.3);

  const fechaMov = params.fecha_movimiento || (isBaja ? emp.fecha_baja : emp.fecha_ingreso) || todayStr;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Fecha Efectiva: ${fechaMov}`, pageWidth - margin - 4, y + 5.3, { align: "right" });

  y += 10;

  // ══════════════════════════════════════════════════════════
  // CUADRO DE INFORMACIÓN (DATOS EMPLEADO + COMENTARIOS)
  // Todo agrupado en el mismo cuadrito que abarca media página
  // ══════════════════════════════════════════════════════════
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, y, contentWidth, 5.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DATOS EMPLEADO", margin + 4, y + 3.9);

  y += 5.5;

  const boxStartY = y;
  const photoW = 28;
  const photoH = 34;
  const photoX = pageWidth - margin - photoW - 3;
  const photoY = y + 3;
  const infoW = contentWidth - photoW - 6;

  // Filas de datos
  let rowY = boxStartY + 4.5;
  const rowH = 7.5;

  const drawField = (label, value, xPos, wVal, isBold = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(label, xPos, rowY);

    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    const strVal = String(value || "—").toUpperCase();
    const truncated = doc.splitTextToSize(strVal, wVal - 2);
    doc.text(truncated[0] || "—", xPos, rowY + 3.2);

    doc.setDrawColor(226, 232, 240);
    doc.line(xPos, rowY + 4.3, xPos + wVal - 3, rowY + 4.3);
  };

  // 1. NOMBRE: primero nombre, luego apellido paterno y luego materno
  const nombreNatural = formatNombreNatural(emp);
  drawField("NOMBRE:", nombreNatural || emp.nombre_completo || "—", margin + 4, infoW, true);
  rowY += rowH;

  // 2. PUESTO, SERVICIO, TURNO, ZONA
  const cW4 = infoW / 4;
  drawField("PUESTO:", emp.puesto || "GUARDIA", margin + 4, cW4, true);
  drawField("SERVICIO:", emp.servicio_ubicacion || "OFICINA", margin + 4 + cW4, cW4 + 3);
  drawField("TURNO:", emp.turno || "MATUTINO", margin + 4 + (cW4 * 2) + 3, cW4 - 3);
  drawField("ZONA:", emp.zona || params.sede_nombre || "MONTERREY", margin + 4 + (cW4 * 3), cW4);
  rowY += rowH;

  // 3. FECHA DE INGRESO, R.F.C., N.S.S.
  const cW3 = infoW / 3;
  drawField("FECHA DE INGRESO:", emp.fecha_ingreso || "—", margin + 4, cW3);
  drawField("R.F.C.:", emp.rfc || "—", margin + 4 + cW3, cW3);
  drawField("N.S.S.:", emp.nss || "—", margin + 4 + (cW3 * 2), cW3);
  rowY += rowH;

  // 4. DÍAS DE CAPACITACIÓN RH, CURP
  const diasCap = params.dias_capacitacion || [emp.dia_capacitacion, emp.dia_capacitacion_2].filter(Boolean).join(" y ") || "—";
  drawField("DÍAS DE CAPACITACIÓN RH:", diasCap, margin + 4, cW3);
  drawField("CURP:", emp.curp || "—", margin + 4 + cW3, cW3 * 2);
  rowY += rowH;

  // 5. EDAD
  const edad = calcularEdad(emp.fecha_nacimiento);
  drawField("EDAD:", edad, margin + 4, cW3);
  rowY += rowH;

  // 6. SERVICIO EN EL QUE SE CAPACITA, TELÉFONO (ancho total debajo de foto)
  const fullHalfW = (contentWidth - 6) / 2;
  const servCap = params.servicio_capacita || emp.servicio_ubicacion || "INDUCCIÓN GENERAL";
  drawField("SERVICIO EN EL QUE SE CAPACITA:", servCap, margin + 4, fullHalfW);
  drawField("TELÉFONO:", emp.telefono || "—", margin + 4 + fullHalfW, fullHalfW);
  rowY += rowH + 2;

  // Dibujar Recuadro de Fotografía
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(photoX, photoY, photoW, photoH, "FD");

  if (photoImg) {
    try {
      const photoCanvas = document.createElement("canvas");
      photoCanvas.width = photoImg.naturalWidth || photoImg.width;
      photoCanvas.height = photoImg.naturalHeight || photoImg.height;
      photoCanvas.getContext("2d").drawImage(photoImg, 0, 0);
      const photoData = photoCanvas.toDataURL("image/jpeg", 0.92);
      const photoScale = Math.min((photoW - 2) / photoCanvas.width, (photoH - 2) / photoCanvas.height);
      const renderedPhotoW = photoCanvas.width * photoScale;
      const renderedPhotoH = photoCanvas.height * photoScale;
      const renderedPhotoX = photoX + (photoW - renderedPhotoW) / 2;
      const renderedPhotoY = photoY + (photoH - renderedPhotoH) / 2;
      doc.addImage(photoData, "JPEG", renderedPhotoX, renderedPhotoY, renderedPhotoW, renderedPhotoH);
    } catch {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("FOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("FOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
  }

  // ══════════════════════════════════════════════════════════
  // OBSERVACIONES DENTRO DEL CUADRITO DE LA INFORMACIÓN
  // ══════════════════════════════════════════════════════════
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 2, rowY - 1, margin + contentWidth - 2, rowY - 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("OBSERVACIONES:", margin + 4, rowY + 3);

  const obsTexto = params.observaciones || (isBaja && emp.motivo_baja ? `Motivo de baja: ${emp.motivo_baja}` : "Sin observaciones.");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const obsLines = doc.splitTextToSize(obsTexto, contentWidth - 8);
  doc.text(obsLines.slice(0, 3), margin + 4, rowY + 6.8);

  rowY += 15;

  // Altura total del cuadro principal
  const boxHeight = rowY - boxStartY;
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, boxStartY, contentWidth, boxHeight, "S");

  // Pie breve
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 174, 192);
  doc.text(
    "CIMA-SERCO SEGURIDAD PRIVADA Y CONFIABILIDAD, S.A. DE C.V. · Control Interno de Recursos Humanos",
    pageWidth / 2,
    boxStartY + boxHeight + 6,
    { align: "center" }
  );

  const filename = `Ficha_Tecnica_${tipoMov}_${nombreNatural.replace(/\s+/g, "_")}.pdf`;

  if (options.returnDoc) {
    const blobUrl = doc.output("bloburl");
    return { doc, blobUrl, filename };
  }

  doc.save(filename);
  return { doc, filename };
}
