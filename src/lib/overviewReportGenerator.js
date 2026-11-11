import { jsPDF } from "jspdf";

function buildNarrativeLinesByScope(data, scope) {
  const lines = [];

  if (scope === "full" || scope === "rh") {
    lines.push(
      `• Talento Humano: ${data.empActivos ?? 0} colaboradores activos (${data.empConSeguro ?? 0} con IMSS), ${data.empAltas ?? 0} altas (${data.varAltasFormatted || "N/D"}) y ${data.empBajas ?? 0} bajas (${data.varBajasFormatted || "N/D"}) vs mes anterior. En Reclutamiento se agendaron ${data.totalEntrevistas ?? 0} entrevistas y ${data.totalContratados ?? 0} contrataciones (${data.tasaConversionEntrevistas ?? 0}%).`
    );
  }

  if (scope === "rh") {
    lines.push(
      `• Asistencia del Personal: Se confirmaron ${data.asistOk ?? 0} asistencias y se registraron ${data.asistFaltas ?? 0} faltas durante el periodo.`
    );
  }

  if (scope === "full" || scope === "operativo") {
    lines.push(
      `• Operaciones y Supervisión: ${data.servActivos ?? 0} servicios activos (+${data.servAltas ?? 0} altas / -${data.servBajas ?? 0} bajas). El supervisor con mayor actividad en campo fue ${data.topSupervisorNombre || "Sin registro"} con ${data.topSupervisorVisitas ?? 0} visitas (${data.totalSupervisiones ?? 0} supervisiones totales).`
    );
  }

  if (scope === "operativo") {
    lines.push(
      `• Cobertura Operativa e Insumos: ${data.empActivos ?? 0} colaboradores en operación, ${data.asistOk ?? 0} asistencias confirmadas y ${data.asistFaltas ?? 0} faltas. En almacén hay ${data.inventarioItemsCount ?? 0} artículos (${data.inventarioTotalStock ?? 0} pzas) y ${data.solsPendientes ?? 0} solicitud(es) pendiente(s).`
    );
  }

  if (scope === "full" || scope === "finanzas") {
    lines.push(
      `• Cobranza y Facturación: Se cobraron $${(data.totalCobrado ?? 0).toLocaleString("es-MX")} de $${(data.totalFacturado ?? 0).toLocaleString("es-MX")} facturados (${data.efectividadCobranza ?? 0}% de efectividad). Se detectaron ${(data.serviciosMorosos || []).length} servicio(s) con pago fuera de tiempo por $${(data.totalMontoMoroso ?? 0).toLocaleString("es-MX")}.`
    );
    lines.push(
      `• Inversión en Inventario y Nómina: Se destinaron $${(data.inversionInventario ?? 0).toLocaleString("es-MX")} a compras de inventario y $${(data.totalNominasPagadas ?? 0).toLocaleString("es-MX")} en nóminas (${data.totalNominasEmpleados ?? 0} colaboradores).`
    );
  }

  return lines;
}

function drawKpiRow(doc, cards, margin, pageWidth, y) {
  const colWidth = (pageWidth - margin * 2) / cards.length;
  const kpiBoxHeight = 16;

  cards.forEach((c, idx) => {
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
    doc.text(String(c.val), bx + 3, y + 12);
  });

  return y + kpiBoxHeight + 8;
}

/**
 * Genera el Reporte Ejecutivo Mensual en PDF oficial de CIMA SERCO,
 * filtrado según el alcance del rol en Overview.
 */
export async function generateOverviewPDFReport(data) {
  const scope = data.scope || "full";
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
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CIMA SERCO SEGURIDAD PRIVADA", margin + 6, y + 8);

  const areaSuffix = scope !== "full" && data.scopeLabel ? ` (${data.scopeLabel.toUpperCase()})` : "";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `INFORME EJECUTIVO MENSUAL${areaSuffix} — ${data.mesNombre?.toUpperCase() || ""}`,
    margin + 6,
    y + 14
  );

  const fechaImpresion = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generado: ${fechaImpresion}`, pageWidth - margin - 6, y + 14, { align: "right" });

  y += 28;

  // 1. Resumen Narrativo
  const narrativeLines = buildNarrativeLinesByScope(data, scope);
  const splitGroups = narrativeLines.map((line) =>
    doc.splitTextToSize(line, pageWidth - margin * 2 - 8)
  );
  const totalTextLines = splitGroups.reduce((sum, g) => sum + g.length, 0);
  const narrativeHeight = Math.max(24, 15 + totalTextLines * 4.3);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, pageWidth - margin * 2, narrativeHeight, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - margin * 2, narrativeHeight, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("1. RESUMEN NARRATIVO Y HALLAZGOS DEL MES", margin + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  let lineY = y + 13;
  splitGroups.forEach((split) => {
    doc.text(split, margin + 4, lineY);
    lineY += split.length * 4.3;
  });

  y += narrativeHeight + 6;

  // 2. Indicadores según alcance del rol
  if (scope === "rh") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("2. INDICADORES DE RECURSOS HUMANOS Y ASISTENCIA", margin, y);
    y += 4;

    y = drawKpiRow(
      doc,
      [
        { label: "Colaboradores Activos", val: `${data.empActivos ?? 0}`, color: [37, 99, 235] },
        { label: "Con Seguro (IMSS)", val: `${data.empConSeguro ?? 0}`, color: [16, 185, 129] },
        { label: "Altas / Bajas Mes", val: `+${data.empAltas ?? 0} / -${data.empBajas ?? 0}`, color: [79, 70, 229] },
        { label: "Asistencias / Faltas", val: `${data.asistOk ?? 0} / ${data.asistFaltas ?? 0}`, color: [13, 148, 136] },
      ],
      margin,
      pageWidth,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("3. DETALLE DE RECLUTAMIENTO Y ROTACIÓN", margin, y);
    y += 5;

    const rhRows = [
      ["Entrevistas agendadas en el mes", String(data.totalEntrevistas ?? 0)],
      ["Contrataciones concretadas", String(data.totalContratados ?? 0)],
      ["Efectividad de reclutamiento", `${data.tasaConversionEntrevistas ?? 0}%`],
      ["Variación altas vs mes anterior", data.varAltasFormatted || "N/D"],
      ["Variación bajas vs mes anterior", data.varBajasFormatted || "N/D"],
    ];
    rhRows.forEach(([k, v], idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3.5, pageWidth - margin * 2, 6, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(k, margin + 3, y + 0.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(v, pageWidth - margin - 3, y + 0.5, { align: "right" });
      y += 6;
    });
  } else if (scope === "operativo") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("2. INDICADORES OPERATIVOS Y DE SUPERVISIÓN", margin, y);
    y += 4;

    y = drawKpiRow(
      doc,
      [
        { label: "Servicios Activos", val: `${data.servActivos ?? 0}`, color: [79, 70, 229] },
        { label: "Supervisiones Totales", val: `${data.totalSupervisiones ?? 0}`, color: [37, 99, 235] },
        { label: "Asistencias Confirmadas", val: `${data.asistOk ?? 0}`, color: [13, 148, 136] },
        { label: "Stock en Almacén", val: `${data.inventarioTotalStock ?? 0} pzas`, color: [124, 58, 237] },
      ],
      margin,
      pageWidth,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("3. RESUMEN DE OPERACIÓN EN CAMPO E INSUMOS", margin, y);
    y += 5;

    const opRows = [
      ["Altas / Bajas de servicios en el mes", `+${data.servAltas ?? 0} / -${data.servBajas ?? 0}`],
      ["Personal activo en operación", String(data.empActivos ?? 0)],
      ["Supervisor con mayor actividad", `${data.topSupervisorNombre || "Sin registro"} (${data.topSupervisorVisitas ?? 0} visitas)`],
      ["Faltas reportadas en el mes", String(data.asistFaltas ?? 0)],
      ["Artículos registrados en inventario", String(data.inventarioItemsCount ?? 0)],
      ["Solicitudes de material pendientes", String(data.solsPendientes ?? 0)],
    ];
    opRows.forEach(([k, v], idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3.5, pageWidth - margin * 2, 6, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(k, margin + 3, y + 0.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(v, pageWidth - margin - 3, y + 0.5, { align: "right" });
      y += 6;
    });
  } else {
    // Full o Finanzas
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("2. BALANCE FINANCIERO CONSOLIDADO", margin, y);
    y += 4;

    y = drawKpiRow(
      doc,
      [
        { label: "Total Facturado", val: `$${(data.totalFacturado ?? 0).toLocaleString("es-MX")}`, color: [37, 99, 235] },
        { label: "Cobrado Efectivo", val: `$${(data.totalCobrado ?? 0).toLocaleString("es-MX")}`, color: [16, 185, 129] },
        { label: "Total Egresos", val: `$${(data.totalEgresos ?? 0).toLocaleString("es-MX")}`, color: [225, 29, 72] },
        {
          label: "Flujo Neto Operativo",
          val: `$${(data.flujoNeto ?? 0).toLocaleString("es-MX")}`,
          color: (data.flujoNeto ?? 0) >= 0 ? [16, 185, 129] : [225, 29, 72],
        },
      ],
      margin,
      pageWidth,
      y
    );

    // 3. Servicios con Pagos Fuera de Tiempo
    const morosos = data.serviciosMorosos || [];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`3. SERVICIOS CON PAGOS FUERA DE TIEMPO / MOROSIDAD (${morosos.length})`, margin, y);
    y += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 6, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("CLIENTE / SERVICIO", margin + 3, y + 4.2);
    doc.text("FECHA LÍMITE", margin + 70, y + 4.2);
    doc.text("DÍAS DE RETRASO", margin + 105, y + 4.2);
    doc.text("MONTO PENDIENTE", pageWidth - margin - 3, y + 4.2, { align: "right" });
    y += 6;

    if (morosos.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(16, 185, 129);
      doc.text("¡Excelente! No se detectaron servicios con atraso de pago este mes.", margin + 3, y + 5);
      y += 9;
    } else {
      morosos.slice(0, 8).forEach((item, idx) => {
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
        doc.setTextColor(225, 29, 72);
        doc.text(`${item.diasAtraso} día(s)`, margin + 105, y + 4);
        doc.text(`$${Number(item.monto || 0).toLocaleString("es-MX")}`, pageWidth - margin - 3, y + 4, { align: "right" });
        y += 5.5;
      });

      if (morosos.length > 8) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`... y ${morosos.length - 8} servicio(s) adicional(es) en cartera vencida.`, margin + 3, y + 4);
        y += 6;
      }
    }

    y += 4;

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
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Documento confidencial para uso exclusivo de Dirección y Gerencia Operativa de CIMA SERCO.", margin, pageHeight - 10);
  doc.text("Página 1 de 1", pageWidth - margin, pageHeight - 10, { align: "right" });

  const scopeSuffix = scope !== "full" ? `_${scope}` : "";
  const filename = `Reporte_Ejecutivo_SERCO_${data.mes || "mes"}${scopeSuffix}.pdf`;
  doc.save(filename);
}

/**
 * Genera el Reporte de Estructura y Resumen en formato CSV/Excel,
 * filtrado según el alcance del rol en Overview.
 */
export function generateOverviewExcelReport(data) {
  const scope = data.scope || "full";
  const lines = [];

  lines.push("REPORTE EJECUTIVO Y DE ESTRUCTURA OPERATIVA - CIMA SERCO");
  lines.push(`Área: ${data.scopeLabel || "Vista Ejecutiva Completa"}`);
  lines.push(`Periodo: ${data.mesNombre || data.mes}`);
  lines.push(`Fecha de Emisión: ${new Date().toLocaleString("es-MX")}`);
  lines.push("");

  lines.push("=== 1. INDICADORES DEL ÁREA ===");

  if (scope === "full" || scope === "finanzas") {
    lines.push(`Total Facturado,$${data.totalFacturado ?? 0}`);
    lines.push(`Total Cobrado Efectivo,$${data.totalCobrado ?? 0}`);
    lines.push(`Total Pendiente de Cobro,$${data.totalPendiente ?? 0}`);
    lines.push(`Efectividad de Cobranza,${data.efectividadCobranza ?? 0}%`);
    lines.push(`Total Egresos,$${data.totalEgresos ?? 0}`);
    lines.push(`Flujo Neto Operativo,$${data.flujoNeto ?? 0}`);
    lines.push(`Inversión en Compras de Inventario,$${data.inversionInventario ?? 0}`);
    lines.push(`Nóminas Dispersadas,$${data.totalNominasPagadas ?? 0}`);
    lines.push(`Colaboradores en Nómina,${data.totalNominasEmpleados ?? 0}`);
    lines.push(`Servicios Activos,${data.servActivos ?? 0}`);
  }

  if (scope === "full" || scope === "rh") {
    lines.push(`Colaboradores Activos,${data.empActivos ?? 0}`);
    lines.push(`Colaboradores Con Seguro (IMSS),${data.empConSeguro ?? 0}`);
    lines.push(`Altas del Mes,${data.empAltas ?? 0} (${data.varAltasFormatted || "N/D"})`);
    lines.push(`Bajas del Mes,${data.empBajas ?? 0} (${data.varBajasFormatted || "N/D"})`);
    lines.push(`Entrevistas Agendadas (Agenda),${data.totalEntrevistas ?? 0}`);
    lines.push(`Candidatos Contratados,${data.totalContratados ?? 0}`);
    lines.push(`Tasa de Efectividad Reclutamiento,${data.tasaConversionEntrevistas ?? 0}%`);
  }

  if (scope === "rh" || scope === "operativo") {
    lines.push(`Asistencias Confirmadas,${data.asistOk ?? 0}`);
    lines.push(`Faltas Reportadas,${data.asistFaltas ?? 0}`);
  }

  if (scope === "full" || scope === "operativo") {
    lines.push(`Servicios Activos,${data.servActivos ?? 0}`);
    lines.push(`Servicios Altas / Bajas,${data.servAltas ?? 0} / ${data.servBajas ?? 0}`);
    lines.push(`Supervisor Más Activo,${data.topSupervisorNombre || "Sin datos"} (${data.topSupervisorVisitas ?? 0} visitas)`);
    lines.push(`Supervisiones Totales,${data.totalSupervisiones ?? 0}`);
  }

  if (scope === "operativo") {
    lines.push(`Personal Activo en Operación,${data.empActivos ?? 0}`);
    lines.push(`Artículos en Almacén,${data.inventarioItemsCount ?? 0}`);
    lines.push(`Stock Total de Insumos,${data.inventarioTotalStock ?? 0}`);
    lines.push(`Solicitudes de Material Pendientes,${data.solsPendientes ?? 0}`);
  }

  lines.push("");

  if (scope === "full" || scope === "finanzas") {
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

    lines.push("=== 3. FACTURAS EXTRAS DEL SERVICIO (CARGOS INDEPENDIENTES) ===");
    lines.push("Servicio,Concepto Extra,Fecha,Base,IVA,Total,Estado,Notas");
    if (data.facturasExtras && data.facturasExtras.length > 0) {
      data.facturasExtras.forEach((fe) => {
        lines.push(`"${fe.servicio_nombre || ""}","${fe.concepto || ""}","${fe.fecha || ""}",$${fe.monto_base || 0},$${fe.iva || 0},$${fe.monto_total || 0},"${fe.estado || "pendiente"}","${fe.notas || ""}"`);
      });
    } else {
      lines.push("No se registraron facturas extras en el mes.");
    }
  }

  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const scopeSuffix = scope !== "full" ? `_${scope}` : "";
  link.setAttribute("download", `Reporte_Estructura_SERCO_${data.mes || "mes"}${scopeSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
