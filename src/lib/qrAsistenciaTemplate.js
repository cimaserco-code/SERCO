import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/**
 * Carga una imagen de forma segura y devuelve un Data URL base64
 */
async function loadSafeLogo(src = "/gafete/logo_serco.png") {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error("Fallback to favicon");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      const resFav = await fetch("/favicon.png");
      if (!resFav.ok) return null;
      const blob = await resFav.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}

/**
 * Dibuja una tarjeta individual en un cuadrante de la hoja tamaño carta
 */
async function drawQRAttendanceCard(doc, service, originUrl, cardX, cardY, cardW, cardH, logoDataUrl) {
  const serviceId = service.id;
  const serviceName = service.nombre || "Servicio SERCO";
  const sedeName = service.sede_nombre || service.sede || "";

  // Generar URL del QR
  const qrUrl = `${originUrl}/registro-asistencia?servicio_id=${encodeURIComponent(serviceId)}&servicio_nombre=${encodeURIComponent(serviceName)}`;

  // Generar imagen QR en alta resolución
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 450,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  // 1. Marco exterior de la tarjeta con esquinas redondeadas
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3.5, 3.5, "FD");

  // 2. Encabezado institucional azul marino
  const headerH = 24;
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(cardX, cardY, cardW, headerH, 3.5, 3.5, "F");
  // Rectángulo inferior recto para emparejar la base del header
  doc.rect(cardX, cardY + headerH - 3, cardW, 3, "F");

  // Franja dorada inferior del header
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(cardX, cardY + headerH, cardW, 1.3, "F");

  // Logo SERCO
  const logoSize = 15;
  const logoX = cardX + 3.5;
  const logoY = cardY + 4;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoSize, logoSize);
    } catch {
      // Fallback visual si la imagen falla
      doc.setFillColor(217, 119, 6);
      doc.circle(logoX + 7.5, logoY + 7.5, 6, "F");
    }
  }

  // Textos del encabezado
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("SERCO SEGURIDAD PRIVADA", cardX + 21, cardY + 10);

  doc.setTextColor(251, 191, 36); // Amber 400
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("SISTEMA DE ASISTENCIA OPERATIVA", cardX + 21, cardY + 15);

  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.text("CONTROL DIGITAL DE ACCESOS", cardX + 21, cardY + 19.5);

  // 3. Bloque de Servicio
  const servBoxY = cardY + headerH + 3.5;
  const servBoxH = 18;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.roundedRect(cardX + 3.5, servBoxY, cardW - 7, servBoxH, 2, 2, "FD");

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("SERVICIO / PUESTO DE CONTROL:", cardX + 6, servBoxY + 4.5);

  // Nombre del servicio con ajuste automático de fuente
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont("helvetica", "bold");
  const fontSizeName = serviceName.length > 30 ? 8 : (serviceName.length > 20 ? 9 : 10);
  doc.setFontSize(fontSizeName);
  const splittedName = doc.splitTextToSize(serviceName.toUpperCase(), cardW - 14);
  doc.text(splittedName, cardX + 6, servBoxY + 9.5);

  if (sedeName) {
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(`Sede: ${sedeName}`, cardX + 6, servBoxY + 15.5);
  }

  // 4. Badge: REGISTRO DE ASISTENCIA
  const badgeY = servBoxY + servBoxH + 2.5;
  const badgeW = 60;
  const badgeH = 5.5;
  const badgeX = cardX + (cardW - badgeW) / 2;
  doc.setFillColor(224, 242, 254); // Sky 100
  doc.setDrawColor(186, 230, 253); // Sky 200
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, "FD");

  doc.setTextColor(3, 105, 161); // Sky 700
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("REGISTRO DE ASISTENCIA", cardX + cardW / 2, badgeY + 4, { align: "center" });

  // 5. Contenedor de Código QR
  const qrBoxSize = 44;
  const qrBoxY = badgeY + badgeH + 2.5;
  const qrBoxX = cardX + (cardW - qrBoxSize) / 2;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 2.5, 2.5, "FD");

  const qrInnerMargin = 2;
  doc.addImage(
    qrDataUrl,
    "PNG",
    qrBoxX + qrInnerMargin,
    qrBoxY + qrInnerMargin,
    qrBoxSize - qrInnerMargin * 2,
    qrBoxSize - qrInnerMargin * 2
  );

  // 6. Caja de Instrucciones
  const instY = qrBoxY + qrBoxSize + 2.5;
  const instH = 15;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardX + 3.5, instY, cardW - 7, instH, 2, 2, "FD");

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("1. Escanea este código con tu teléfono celular", cardX + 6, instY + 5);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("2. Selecciona tu nombre y toma tu foto de verificación", cardX + 6, instY + 9.5);
  doc.text("3. Presiona 'Confirmar Asistencia' para validar", cardX + 6, instY + 13.5);

  // 7. Pie institucional
  const footY = instY + instH + 3.5;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  doc.text("Tolerancia Turno Matutino: 7:15 AM • Vespertino: 7:15 PM", cardX + cardW / 2, footY, { align: "center" });

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.text("SERCO Seguridad Privada S.A. de C.V. • Código de Uso Exclusivo Operativo", cardX + cardW / 2, footY + 3.2, { align: "center" });
}

/**
 * Dibuja las líneas de corte punteadas en la hoja carta
 */
function drawCuttingGuides(doc, pageWidth, pageHeight) {
  const midX = pageWidth / 2;
  const midY = pageHeight / 2;

  doc.setDrawColor(148, 163, 184); // Slate 400
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([2, 2], 0);

  // Línea vertical
  doc.line(midX, 6, midX, pageHeight - 6);
  // Línea horizontal
  doc.line(6, midY, pageWidth - 6, midY);

  // Restaurar línea continua
  doc.setLineDashPattern([], 0);

  // Símbolos de tijera / guía en los 4 extremos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text("Guía de corte", midX + 2, 5);
  doc.text("Guía de corte", midX + 2, pageHeight - 2);
  doc.text("Guía de corte", 2, midY - 2);
  doc.text("Guía de corte", pageWidth - 16, midY - 2);
}

/**
 * Genera el PDF en Hoja Carta con 4 tarjetas para recortar (2x2)
 *
 * @param {Array<Object>|Object} services - Uno o varios objetos de servicio: { id, nombre, sede_nombre }
 * @param {string} originUrl - URL base de la aplicación (ej: window.location.origin)
 * @returns {Promise<jsPDF>}
 */
export async function generateQRAttendanceCardsSheet(services, originUrl = window.location.origin) {
  // Asegurar arreglo de servicios
  const serviceList = Array.isArray(services) ? services : [services];
  if (serviceList.length === 0) {
    throw new Error("No se proporcionó ningún servicio para generar el código QR.");
  }

  // Dimensiones Hoja Carta estándar en mm
  const pageWidth = 215.9;
  const pageHeight = 279.4;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const logoDataUrl = await loadSafeLogo("/gafete/logo_serco.png");

  // Ancho y alto de cada cuadrante (1/4 de carta)
  const quadW = pageWidth / 2; // 107.95 mm
  const quadH = pageHeight / 2; // 139.7 mm

  // Margen interno dentro de cada cuadrante para centrar la tarjeta
  const cardMarginX = 5;
  const cardMarginY = 5;
  const cardW = quadW - cardMarginX * 2; // ~97.95 mm
  const cardH = quadH - cardMarginY * 2; // ~129.7 mm

  // Si se envió un solo servicio, se repite 4 veces en la hoja para tener 4 tarjetas del mismo servicio
  let fullList = [...serviceList];
  if (serviceList.length === 1) {
    fullList = [serviceList[0], serviceList[0], serviceList[0], serviceList[0]];
  }

  // Cuadrantes (2x2)
  const quadrants = [
    { x: cardMarginX, y: cardMarginY }, // Superior izquierdo
    { x: quadW + cardMarginX, y: cardMarginY }, // Superior derecho
    { x: cardMarginX, y: quadH + cardMarginY }, // Inferior izquierdo
    { x: quadW + cardMarginX, y: quadH + cardMarginY }, // Inferior derecho
  ];

  // Iterar en bloques de 4 tarjetas por página
  for (let i = 0; i < fullList.length; i += 4) {
    if (i > 0) {
      doc.addPage("letter", "portrait");
    }

    // Dibujar guías de corte en la página
    drawCuttingGuides(doc, pageWidth, pageHeight);

    // Dibujar hasta 4 tarjetas en la página
    for (let q = 0; q < 4; q++) {
      const currentService = fullList[i + q];
      if (!currentService) break;

      const pos = quadrants[q];
      await drawQRAttendanceCard(
        doc,
        currentService,
        originUrl,
        pos.x,
        pos.y,
        cardW,
        cardH,
        logoDataUrl
      );
    }
  }

  return doc;
}
