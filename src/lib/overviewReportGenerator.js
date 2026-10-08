import { jsPDF } from "jspdf";

/**
 * Genera el Reporte Ejecutivo Mensual en PDF oficial de CIMA SERCO
 */
export async function generateOverviewPDFReport(data) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CIMA SERCO SEGURIDAD PRIVADA", margin + 6, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`INFORME EJECUTIVO MENSUAL Y DE ESTRUCTURA — ${data.mesNombre?.toUpperCase() || ""}`, margin + 6, y + 14);

  const fechaImpresion = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Generado: ${fechaImpresion}`, pageWidth - margin - 6, y + 14, { align: "right" });

  y += 28;

  // 1. Resumen Narrativo Inteligente (Insights Clave)
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("1. RESUMEN NARRATIVO Y HALLAZGOS DEL MES", margin + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const narrativeLines = [
    `• Talento Humano: Se registraron ${data.empAltas} altas (${data.varAltasFormatted}) y ${data.empBajas} bajas (${data.varBajasFormatted}) respecto al mes anterior. En Reclutamiento se agendaron ${data.totalEntrevistas} entrevistas, concretando ${data.totalContratados} contrataciones (tasa de conversión: ${data.tasaConversionEntrevistas}%).`,
    `• Operaciones y Supervisión: ${data.servActivos} servicios activos en operación. El supervisor con mayor actividad en campo fue ${data.topSupervisorNombre || "Sin registro"} con ${data.topSupervisorVisitas} visitas registradas.`,
    `• Cobranza y Facturación: Se cobraron $${data.totalCobrado.toLocaleString("es-MX")} de un total facturado de $${data.totalFacturado.toLocaleString("es-MX")} (${data.efectividadCobranza}% de efectividad). Se detectaron ${data.serviciosMorosos.length} servicios con pago fuera de tiempo por $${data.totalMontoMoroso.toLocaleString("es-MX")}.`,
    `• Inversión en Inventario y Almacén: Se destinaron $${data.inversionInventario.toLocaleString("es-MX")} a compras de uniformes, insumos y equipo táctico este mes.`,
  ];

  let lineY = y + 13;
  narrativeLines.forEach((line) => {
    const split = doc.splitTextToSize(line, pageWidth - margin * 2 - 8);
    doc.text(split, margin + 4, lineY);
    lineY += split.length * 4.2;
  });

  y += 48;

  // 2. Indicadores Financieros Clave (Tabla)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("2. BALANCE FINANCIERO CONSOLIDADO", margin, y);
  y += 4;

  const colWidth = (pageWidth - margin * 2) / 4;
  const kpiBoxHeight = 16;

  const finCards = [
    { label: "Total Facturado", val: `$${data.totalFacturado.toLocaleString("es-MX")}`, color: [37, 99, 235] },
    { label: "Cobrado Efectivo", val: `$${data.totalCobrado.toLocaleString("es-MX")}`, color: [16, 185, 129] },
    { label: "Total Egresos", val: `$${data.totalEgresos.toLocaleString("es-MX")}`, color: [225, 29, 72] },
    { label: "Flujo Neto Operativo", val: `$${data.flujoNeto.toLocaleString("es-MX")}`, color: data.flujoNeto >= 0 ? [16, 185, 129] : [225, 29, 72] },
  ];

  finCards.forEach((c, idx) => {
    const bx = margin + idx * colWidth;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, colWidth - 2, kpiBoxHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, bx + 3, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, bx + 3, y + 12);
  });

  y += kpiBoxHeight + 8;

  // 3. Servicios con Pagos Fuera de Tiempo (Cartera Vencida)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`3. SERVICIOS CON PAGOS FUERA DE TIEMPO / MOROSIDAD (${data.serviciosMorosos.length})`, margin, y);
  y += 4;

  // Header tabla morosos
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 6, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("CLIENTE / SERVICIO", margin + 3, y + 4.2);
  doc.text("FECHA LÍMITE", margin + 70, y + 4.2);
  doc.text("DÍAS DE RETRASO", margin + 105, y + 4.2);
  doc.text("MONDO PENDIENTE", pageWidth - margin - 3, y + 4.2, { align: "right" });
  y += 6;

  if (data.serviciosMorosos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text("¡Excelente! No se detectaron servicios con atraso de pago este mes.", margin + 3, y + 5);
    y += 9;
  } else {
    data.serviciosMorosos.slice(0, 8).forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - margin * 2, 5.5, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.nombre || "—", margin + 3, y + 4);
      doc.text(item.fechaLimite || "—", margin + 70, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`${item.diasAtraso} día(s)`, margin + 105, y + 4);

      doc.text(`$${Number(item.monto || 0).toLocaleString("es-MX")}`, pageWidth - margin - 3, y + 4, { align: "right" });
      y += 5.5;
    });

    if (data.serviciosMorosos.length > 8) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`... y ${data.serviciosMorosos.length - 8} servicio(s) adicional(es) en cartera vencida.`, margin + 3, y + 4);
      y += 6;
    }
  }

  y += 4;

  // 4. Facturas Extras y Requerimientos Adicionales
  if (data.facturasExtras && data.facturasExtras.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`4. FACTURAS EXTRAS DEL MES (${data.facturasExtras.length})`, margin, y);
    y += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 6, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("SERVICIO", margin + 3, y + 4.2);
    doc.text("CONCEPTO EXTRAORDINARIO", margin + 55, y + 4.2);
    doc.text("FECHA", margin + 115, y + 4.2);
    doc.text("ESTADO", margin + 138, y + 4.2);
    doc.text("TOTAL", pageWidth - margin - 3, y + 4.2, { align: "right" });
    y += 6;

    data.facturasExtras.slice(0, 5).forEach((fe, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - margin * 2, 5.5, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(fe.servicio_nombre || "—", margin + 3, y + 4);
      doc.text(fe.concepto || "—", margin + 55, y + 4);
      doc.text(fe.fecha || "—", margin + 115, y + 4);
      doc.text(fe.estado?.toUpperCase() || "PENDIENTE", margin + 138, y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(`$${Number(fe.monto_total || fe.monto || 0).toLocaleString("es-MX")}`, pageWidth - margin - 3, y + 4, { align: "right" });
      y += 5.5;
    });

    y += 4;
  }

  // Footer institucional
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Documento confidencial para uso exclusivo de Dirección y Gerencia Operativa de CIMA SERCO.", margin, pageHeight - 10);
  doc.text(`Página 1 de 1`, pageWidth - margin, pageHeight - 10, { align: "right" });

  const filename = `Reporte_Ejecutivo_SERCO_${data.mes || "mes"}.pdf`;
  doc.save(filename);
}

/**
 * Genera el Reporte de Estructura y Resumen en formato CSV/Excel
 */
export function generateOverviewExcelReport(data) {
  const lines = [];

  lines.push("REPORTE EJECUTIVO Y DE ESTRUCTURA OPERATIVA - CIMA SERCO");
  lines.push(`Periodo: ${data.mesNombre || data.mes}`);
  lines.push(`Fecha de Emisión: ${new Date().toLocaleString("es-MX")}`);
  lines.push("");

  // 1. Resumen Ejecutivo
  lines.push("=== 1. INDICADORES GENERALES ===");
  lines.push(`Total Facturado,$${data.totalFacturado}`);
  lines.push(`Total Cobrado Efectivo,$${data.totalCobrado}`);
  lines.push(`Total Pendiente de Cobro,$${data.totalPendiente}`);
  lines.push(`Efectividad de Cobranza,${data.efectividadCobranza}%`);
  lines.push(`Total Egresos,$${data.totalEgresos}`);
  lines.push(`Flujo Neto Operativo,$${data.flujoNeto}`);
  lines.push(`Inversión en Compras de Inventario,$${data.inversionInventario}`);
  lines.push(`Colaboradores Activos,${data.empActivos}`);
  lines.push(`Altas del Mes,${data.empAltas} (${data.varAltasFormatted})`);
  lines.push(`Bajas del Mes,${data.empBajas} (${data.varBajasFormatted})`);
  lines.push(`Entrevistas Agendadas (Agenda),${data.totalEntrevistas}`);
  lines.push(`Candidatos Contratados,${data.totalContratados}`);
  lines.push(`Tasa de Efectividad Reclutamiento,${data.tasaConversionEntrevistas}%`);
  lines.push(`Supervisor Más Activo,${data.topSupervisorNombre || "Sin datos"} (${data.topSupervisorVisitas} visitas)`);
  lines.push("");

  // 2. Cartera Vencida (Servicios Morosos)
  lines.push("=== 2. SERVICIOS CON PAGOS FUERA DE TIEMPO ===");
  lines.push("Servicio,Fecha Limite,Dias de Retraso,Monto Pendiente");
  if (data.serviciosMorosos && data.serviciosMorosos.length > 0) {
    data.serviciosMorosos.forEach((s) => {
      lines.push(`"${s.nombre || ""}","${s.fechaLimite || ""}","${s.diasAtraso} días",$${s.monto || 0}`);
    });
  } else {
    lines.push("Sin adeudos vencidos registrados este mes.");
  }
  lines.push("");

  // 3. Facturas Extras
  lines.push("=== 3. FACTURAS EXTRAS DEL SERVICIO (CARGOS INDEPENDIENTES) ===");
  lines.push("Servicio,Concepto Extra,Fecha,Base,IVA,Total,Estado,Notas");
  if (data.facturasExtras && data.facturasExtras.length > 0) {
    data.facturasExtras.forEach((fe) => {
      lines.push(`"${fe.servicio_nombre || ""}","${fe.concepto || ""}","${fe.fecha || ""}",$${fe.monto_base || 0},$${fe.iva || 0},$${fe.monto_total || 0},"${fe.estado || "pendiente"}","${fe.notas || ""}"`);
    });
  } else {
    lines.push("No se registraron facturas extras en el mes.");
  }

  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Reporte_Estructura_SERCO_${data.mes || "mes"}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
