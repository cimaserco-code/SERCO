import { jsPDF } from "jspdf";
import { formatNombreNatural } from "@/lib/userNameFormatting";

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Creates a circular / rounded cropped version of an image
 */
function createRoundedImage(img, width, height, radius = 6) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return img;

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

    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Error rounding image:", e);
    return img;
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

  const [logoImg, photoImg] = await Promise.all([
    loadImage("/gafete/logo_serco.png"),
    loadImage(params.foto_url || emp.foto_url),
  ]);

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
      const roundedPhoto = createRoundedImage(photoImg, 300, 350, 20);
      doc.addImage(roundedPhoto, "PNG", photoX, photoY, photoW, photoH);
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
    // Dibujar frente y reverso lado a lado centrados en hoja carta
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
    // Formato CR80 (2 Páginas: Página 1 Frente, Página 2 Reverso)
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

  const [bgFrontImg, bgBackImg, photoImg] = await Promise.all([
    loadImage("/gafete/gafete_frente_veracruz_bg.png"),
    loadImage("/gafete/gafete_reverso_veracruz.png"),
    loadImage(params.foto_url || emp.foto_url),
  ]);

  const drawCardFront = (startX, startY) => {
    // Fondo estilizado oficial (curva dorada/negra, logo superior y permisos)
    if (bgFrontImg) {
      doc.addImage(bgFrontImg, "PNG", startX, startY, 54, 86);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(startX, startY, 54, 86, 3, 3, "FD");
    }

    // Fotografía del empleado
    // Ubicación correspondiente a la ventana de la plantilla original
    const photoX = startX + 18.5;
    const photoY = startY + 8.8;
    const photoW = 34.5;
    const photoH = 37.8;

    if (photoImg) {
      // Recorte estilizado con esquinas redondeadas suaves para integrarse al arco
      const roundedPhoto = createRoundedImage(photoImg, 400, 440, 24);
      doc.addImage(roundedPhoto, "PNG", photoX, photoY, photoW, photoH);
    } else {
      // Placeholder en caso de que no tenga foto subida
      doc.setFillColor(235, 235, 240);
      doc.roundedRect(photoX, photoY, photoW, photoH, 4, 4, "F");
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
    // Fondo y reverso oficial (contacto Xalapa, Eduardo Sommer, Sarahí Peña Galaviz)
    if (bgBackImg) {
      doc.addImage(bgBackImg, "PNG", startX, startY, 54, 86);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(startX, startY, 54, 86, 3, 3, "FD");
    }
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
  const sedeId = emp?.sede_id || options?.defaultSedeId;
  const sedeObj = (sedes || []).find((s) => s.id === sedeId);
  const isMty = (sedeObj?.nombre || "").toLowerCase().includes("monterrey");

  const sedeTipo = params.sede_tipo || (isMty ? "monterrey" : "otras_sedes");

  if (sedeTipo === "monterrey") {
    return generateGafeteMonterreyPDF(emp, params, options);
  }
  return generateGafeteOtrasSedesPDF(emp, params, options);
}
