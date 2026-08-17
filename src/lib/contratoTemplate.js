import { jsPDF } from "jspdf";

export function numeroALetras(num) {
  if (num === 0) return "CERO PESOS";
  
  const Unidades = (n) => {
    switch (n) {
      case 1: return "UN";
      case 2: return "DOS";
      case 3: return "TRES";
      case 4: return "CUATRO";
      case 5: return "CINCO";
      case 6: return "SEIS";
      case 7: return "SIETE";
      case 8: return "OCHO";
      case 9: return "NUEVE";
      default: return "";
    }
  };

  const Decenas = (n) => {
    const dec = Math.floor(n / 10);
    const uni = n % 10;
    switch (dec) {
      case 1:
        switch (uni) {
          case 0: return "DIEZ";
          case 1: return "ONCE";
          case 2: return "DOCE";
          case 3: return "TRECE";
          case 4: return "CATORCE";
          case 5: return "QUINCE";
          default: return "DIECI" + Unidades(uni);
        }
      case 2:
        return uni === 0 ? "VEINTE" : "VEINTI" + Unidades(uni);
      case 3: return "TREINTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      case 4: return "CUARENTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      case 5: return "CINCUENTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      case 6: return "SESENTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      case 7: return "SETENTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      case 8: return "OCHENTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      case 9: return "NOVENTA" + (uni > 0 ? " Y " + Unidades(uni) : "");
      default: return Unidades(n);
    }
  };

  const Centenas = (n) => {
    const cent = Math.floor(n / 100);
    const dec = n % 100;
    switch (cent) {
      case 1: return dec > 0 ? "CIENTO " + Decenas(dec) : "CIEN";
      case 2: return "DOSCIENTOS " + Decenas(dec);
      case 3: return "TRESCIENTOS " + Decenas(dec);
      case 4: return "CUATROCIENTOS " + Decenas(dec);
      case 5: return "QUINIENTOS " + Decenas(dec);
      case 6: return "SEISCIENTOS " + Decenas(dec);
      case 7: return "SETECIENTOS " + Decenas(dec);
      case 8: return "OCHOCIENTOS " + Decenas(dec);
      case 9: return "NOVECIENTOS " + Decenas(dec);
      default: return Decenas(n);
    }
  };

  const Seccion = (n, divisor, strSingular, strPlural) => {
    const cientos = Math.floor(n / divisor);
    const resto = n % divisor;
    let letras = "";
    if (cientos > 0) {
      if (cientos > 1) {
        letras = Centenas(cientos) + " " + strPlural;
      } else {
        letras = strSingular;
      }
    }
    if (resto > 0) {
      letras += " " + Centenas(resto);
    }
    return letras;
  };

  const Miles = (n) => {
    const divisor = 1000;
    const cientos = Math.floor(n / divisor);
    const resto = n % divisor;
    let strMiles = Seccion(n, divisor, "UN MIL", "MIL");
    let strCentenas = Centenas(resto);
    if (strMiles === "") return strCentenas;
    return strMiles + " " + strCentenas;
  };

  const Millones = (n) => {
    const divisor = 1000000;
    const cientos = Math.floor(n / divisor);
    const resto = n % divisor;
    let strMillones = Seccion(n, divisor, "UN MILLON", "MILLONES");
    let strMiles = Miles(resto);
    if (strMillones === "") return strMiles;
    return strMillones + " " + strMiles;
  };

  const entero = Math.floor(num);
  return Millones(entero).trim() + " PESOS";
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
  return edad;
}

export function generateContractPDF(emp, params, sedes) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter"
  });

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 25;

  const totalPagesAlias = "{total_pages}";

  const addPageDecorations = (pageNum) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${pageNum} de ${totalPagesAlias}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.text("CONTRATO INDIVIDUAL DE TRABAJO - CIMA-SERCO", margin, 12);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 14, pageWidth - margin, 14);
  };

  const addParagraph = (text, isTitle = false, isCentered = false) => {
    doc.setFont("helvetica", isTitle ? "bold" : "normal");
    doc.setFontSize(isTitle ? 11 : 9.5);
    doc.setTextColor(isTitle ? 30 : 60);

    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = isTitle ? 6 : 5;

    lines.forEach((line) => {
      if (y + lineHeight > pageHeight - 20) {
        doc.addPage();
        y = 25;
      }
      if (isCentered) {
        doc.text(line, pageWidth / 2, y, { align: "center" });
      } else {
        doc.text(line, margin, y);
      }
      y += lineHeight;
    });

    y += 3;
  };

  const addSignatures = () => {
    if (y + 40 > pageHeight - 20) {
      doc.addPage();
      y = 25;
    }
    y += 10;
    
    doc.setFont("helvetica", "bold");
    doc.text("“El Patrón”", margin + 15, y);
    doc.text("“El Trabajador”", pageWidth - margin - 45, y);
    
    y += 25;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    
    const patronNameLines = doc.splitTextToSize("JUAN CARLOS CANALIZO HERNÁNDEZ\nAPODERADO LEGAL DE “CIMA-SERCO SEGURIDAD PRIVADA Y CONFIABILIDAD, S.A. DE C.V.”", contentWidth / 2 - 10);
    let tempY = y;
    patronNameLines.forEach(line => {
      doc.text(line, margin, tempY);
      tempY += 4;
    });

    const trabNameLines = doc.splitTextToSize(`${emp.nombre_completo}\nTrabajador`, contentWidth / 2 - 10);
    tempY = y;
    trabNameLines.forEach(line => {
      doc.text(line, pageWidth / 2 + 10, tempY);
      tempY += 4;
    });
  };

  const sueldoBase = Number(emp.sueldo || 0);
  const sueldoBaseLetras = numeroALetras(sueldoBase);
  const sueldoSemanal = Math.round(sueldoBase / 4);
  const sueldoSemanalLetras = numeroALetras(sueldoSemanal);

  const bonoBase = Number(params.bono_mensual || 0);
  const bonoBaseLetras = numeroALetras(bonoBase);
  const bonoSemanal = Math.round(bonoBase / 4);
  const bonoSemanalLetras = numeroALetras(bonoSemanal);

  const edad = calcularEdad(emp.fecha_nacimiento);
  const cp = emp.codigo_postal || "______";
  const rfc = emp.rfc || "______";
  const curp = emp.curp || "______";
  
  const today = new Date();
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const duracionTexto = params.duracion_meses === "3" ? "3 (tres meses)" : `${params.duracion_meses} meses`;

  const paragraphs = [
    `CONTRATO POR TIEMPO DETERMINADO, QUE CELEBRA POR UNA PARTE CIMA-SERCO, SEGURIDAD PRIVADA Y CONFIABILIDAD, S.A. DE C.V., REPRESENTADA POR SU APODERADO LEGAL JUAN CARLOS CANALIZO HERNÁNDEZ, A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ “EL PATRÓN” Y POR LA OTRA PARTE EL C. ${emp.nombre_completo.toUpperCase()}, A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ COMO “EL TRABAJADOR”, QUIENES EN CONJUNTO “LAS PARTES”; SE SUJETAN A LAS SIGUIENTES DECLARACIONES Y CLÁUSULAS:`,
    `DECLARACIONES:`,
    `I. Declara “El Patrón”:`,
    `Ser una persona moral legalmente constituida conforme a las leyes mexicanas, acreditando constitución a través del instrumento notarial con número 24,017 (veinticuatro mil diecisiete), de fecha doce de abril del año dos mil veintiuno, otorgada ante la fe del Licenciado Rafael De La Huerta Manjarrez, Titular de la Notaría Pública número Dieciséis de la Décima Primera Demarcación Notarial, con residencia en la Ciudad de Xalapa, Veracruz.`,
    `Que su representado acredita su personalidad mediante instrumento público número 2,588 (dos mil quinientos ochenta y ocho), pasado ante la fe del Licenciado Javier Humberto Parás Garza, titular de la notaría pública número 36, de la ciudad de Monterrey, Nuevo León.`,
    `Declara ser una persona moral debidamente registrada ante la Secretaría de Hacienda y Crédito Público, con Registro Federal de Contribuyentes: CSP210412PK1.`,
    `Señalando como medio de contacto para oír y recibir todo de notificaciones el correo electrónico; cimacontacto2024@gmail.com.`,
    `II. Declara “El Trabajador”:`,
    `Bajo protesta de decir verdad declaro ser una persona física, de nacionalidad mexicana, contar con la edad ${edad} años, de estado civil ${emp.estado_civil || '______'}, sexo ${emp.sexo || '______'}, con domicilio en calle ${emp.calle || '______'} número ${emp.numero || '___'}, colonia ${emp.colonia || '______'} con C.P. ${cp}, en la ciudad de ${emp.ciudad || '______'}, del estado de ${emp.ciudad?.toLowerCase() === 'xalapa' ? 'Veracruz' : 'Nuevo León'}. Con C.U.R.P. ${curp} y R.F.C. ${rfc}.`,
    `Poseer la capacidad, facultades, habilidades, aptitudes, experiencia, condiciones de salud y adiestramiento necesario para el desempeño de las actividades a desarrollar y de las tareas inherentes al mismo.`,
    `“El Trabajador” declara conocer completamente la naturaleza del presente contrato al momento de su firma y se compromete a desempeñar las funciones del puesto bajo la dirección y supervisión del “Patrón”, cumpliendo con las órdenes e instrucciones relacionadas con todas y cada una de sus responsabilidades.`,
    `Sus datos generales son veraces, y se obliga a notificar a “El Patrón” por escrito y en forma inmediata, cualquier cambio relacionado con estos; de no hacerlo, se considerarán vigentes los últimos datos que hubiere proporcionado a “El Patrón” para todos los efectos legales a que haya lugar.`,
    `Reconocer su firma plasmada al calce de cada página y al final del presente contrato.`,
    `III. Declaran “Las Partes”:`,
    `“Las Partes” declaran que conocen sus obligaciones y prohibiciones:Por lo que respecta a “El Patrón”: los artículos 132 y 133 de la Ley Federal del Trabajo.`,
    `Por lo que se refiere a “El Trabajador”: los artículos 134 y 135, así como demás relativos aplicables de dicho ordenamiento legal.`,
    `Se reconocen la personalidad con la que comparecen y se sujetan a lo dispuesto en la Ley Federal del Trabajo, en lo sucesivo “La Ley”; y finalmente, al referirse al presente escrito se le denominará como “El Contrato”, acordando las partes sujetarse al tenor de las siguientes:`,
    `CLÁUSULAS`,
    `PRIMERA. - OBJETO. El presente contrato se celebra bajo la modalidad de tiempo determinado, de conformidad con lo dispuesto por el artículo 35 de la Ley Federal del Trabajo.`,
    `Durante dicho periodo, “El Trabajador” prestará sus servicios personales subordinados en los términos establecidos en el presente contrato, gozando de todas las prestaciones y condiciones de trabajo correspondientes al puesto, conforme a lo previsto en la Ley Federal del Trabajo.`,
    `PRIMERA BIS. - TIPO DE CONTRATO. – El presente contrato se celebra por tiempo determinado por un periodo de ${duracionTexto} tal y como se establece en el artículo 35 de la Ley Federal del Trabajo e iniciando su vigencia a partir de la fecha de suscripción del mismo.`,
    `SEGUNDA. - FUNCIONES, RESPONSABILIDADES Y OBLIGACIONES DEL PUESTO. – “El trabajador” se obliga a desempeñar el puesto de Guardia de Seguridad, siendo responsable de la vigilancia, protección y custodia de las instalaciones, bienes y personas que le sean asignadas, actuando en todo momento con diligencia, lealtad y apego a la normatividad aplicable.`,
    `En el desempeño de sus funciones, deberá controlar accesos, realizar rondines periódicos, operar equipos y sistemas de seguridad, llevar registros en bitácoras, reportar de forma inmediata cualquier incidente o anomalía, y ejecutar los protocolos de emergencia correspondientes.`,
    `“El trabajador” se compromete a cumplir con las políticas internas de la empresa, así como con las disposiciones legales y reglamentarias vigentes en materia de seguridad privada, protección civil y demás aplicables en los Estados Unidos Mexicanos.`,
    `Asimismo, “El trabajador”, deberá acatar las instrucciones de su superior jerárquico y guardar estricta confidencialidad respecto de la información, procesos, instalaciones y personas relacionadas con el servicio.`,
    `El incumplimiento de cualquiera de las obligaciones aquí establecidas, así como la negligencia, omisión o conducta indebida en el desempeño de sus funciones, será considerado causa de responsabilidad laboral, pudiendo dar lugar a la aplicación de medidas disciplinarias y, en su caso, a la rescisión de la relación laboral, en términos de la legislación aplicable.`,
    `TERCERA. - MANUALES Y LINEAMIENTOS. “El Trabajador” reconoce la responsabilidad del puesto asumido y se compromete a cumplir con las medidas necesarias en cuanto al manual de procedimientos, reglamentos y consignas establecidos por “El Patrón”, mismos que a la firma del presente contrato manifiesta conocer todos y cada uno de ellos.`,
    `Asimismo, “El Trabajador” se compromete a ejecutar cada una de las instrucciones que le haga mención su superior jerárquico.`,
    `CUARTA. - CENTRO DE TRABAJO Y REUBICACIÓN. “El Trabajador” reconoce y acepta que, derivado de la naturaleza de las funciones propias del puesto de GUARDIA DE SEGURIDAD privada, sus actividades implican que la prestación de sus labores deba realizarse en diversos centros de trabajo o instalaciones en donde se presten los servicios de seguridad, dentro de la zona operativa correspondiente, incluyendo instalaciones de clientes o puntos de operación que le sean asignados según las necesidades del servicio.`,
    `“El Patrón” podrá asignar, cambiar o reubicar a “El Trabajador” en cualquiera de dichos centros de trabajo o servicios, cuando así lo requieran las necesidades operativas, administrativas o contractuales del servicio de seguridad privada, siempre que se respete su salario base y las demás condiciones esenciales de trabajo. La reasignación podrá generar la modificación del bono por asignación de servicio, de conformidad con lo previsto en la cláusula SÉPTIMA BIS del presente contrato, sin que ello constituya una reducción del salario base.`,
    `En caso de que la asignación de servicio implique modificaciones en el horario de labores, “El Trabajador” acepta ajustarse al horario correspondiente al servicio asignado, respetándose en todo momento los límites establecidos por la Ley Federal del Trabajo.`,
    `QUINTA. - JORNADA LABORAL. La jornada laboral en ningún momento rebasará los máximos legales que para tal efecto señale “la ley”.`,
    `“El Patrón” otorgará, por cada seis días trabajados, un día de descanso; reservándose el derecho “El Patrón” de modificar el día de descanso con previo aviso, respetando siempre un día de descanso a la semana.`,
    `SEXTA. ACUERDOS. - “El Trabajador” disfrutará de un día de descanso tal como se establece en la cláusula anterior; sin embargo, “El Trabajador” conviene en laborar los días domingos en que “El Patrón” necesite de sus servicios.Asimismo, “El Trabajador” se obliga a laborar los días festivos que establece el artículo 74 de “La Ley” cuando así lo requieran las necesidades del servicio, teniendo derecho al pago del salario conforme a lo que establece “La Ley” del día en que prestó sus servicios.`,
    `“El Trabajador” únicamente podrá laborar tiempo extraordinario cuando “El Patrón” se lo indique mediante orden por escrito, en la cual señalará él o los días y horarios en el cual laborará tiempo extra.`,
    `SÉPTIMA. - SALARIO BASE Y FORMA DE PAGO. “El Trabajador” recibirá como contraprestación por los servicios personales subordinados prestados un salario base mensual bruto de \${sueldoBase.toLocaleString('es-MX')} (${sueldoBaseLetras} 00/100 M.N.), dicho salario será cubierto los viernes de cada semana, por la cantidad de \$______________________, (__________________________________00/100 M.N.) , en el lugar de trabajo asignado o mediante depósito o transferencia a la cuenta o tarjeta bancaria que designe “El Trabajador”, previa expedición del recibo de nómina correspondiente. El salario señalado comprende el pago proporcional de los días de descanso semanal y obligatorio que legalmente correspondan, sin perjuicio de las demás prestaciones a que tenga derecho “El Trabajador”.`,
    `SÉPTIMA BIS. - BONO POR ASIGNACIÓN DE SERVICIO. Adicionalmente al salario base establecido en la cláusula anterior, “El Trabajador” recibirá un bono mensual por asignación de servicio, por la cantidad de \${bonoBase.toLocaleString('es-MX')} (${bonoBaseLetras} 00/100 M.N.), el cual será cubierto los viernes de cada semana, por la cantidad de \$______________________, (__________________________________00/100 M.N.) , según el servicio, centro de trabajo, nivel de responsabilidad, condiciones operativas y funciones específicas que le sean asignadas. El monto aplicable será informado por escrito a “El Trabajador” al momento de su asignación o cambio de servicio. Cuando la asignación comprenda únicamente una parte del mes, el bono se cubrirá de manera proporcional a los días efectivamente laborados en dicho servicio. En caso de reasignación a un servicio distinto, el monto del bono se ajustará al nivel correspondiente al nuevo servicio, sin que dicha modificación implique una reducción del salario base mensual ni afecte cantidades previamente devengadas. El bono será cubierto junto con el salario de cada semana, en la parte proporcional correspondiente, y deberá identificarse por separado en el recibo de nómina. Para todos los efectos legales y de seguridad social, su integración salarial se determinará conforme a la legislación aplicable.`,
    `OCTAVA. DEDUCCIONES. - “El Trabajador” autoriza a “El Patrón” deducir de su salario el Impuesto sobre el Producto del Trabajo o también conocido como el Impuesto sobre la Renta y demás impuestos correspondientes, de conformidad con lo establecido en las disposiciones legales en vigor al momento en que se realice el descuento respectivo. Así como demás descuentos descritos en el artículo 97 de la Ley, tales como pensiones alimenticias decretadas por la autoridad competente, pago de rentas, pago de abonos para cubrir préstamos provenientes del Fondo Nacional de la Vivienda para los Trabajadores, etc., según sea el caso de “El Trabajador”.`,
    `NOVENA. - RECIBOS. “El Trabajador” queda obligado a otorgar su firma al recibo de pago a favor del “Patrón” por el total de los salarios devengados a que tuviere derecho, conviniendo que la firma implicará un finiquito total hasta la fecha del recibo correspondiente.`,
    `DÉCIMA. - CONTROL DE ASISTENCIA. “El Trabajador” deberá registrar el inicio y término de su jornada laboral mediante los mecanismos de control de asistencia que establezca “El Patrón”, los cuales podrán consistir en listas de asistencia, sistemas electrónicos, aplicaciones móviles, reportes operativos, mensajes institucionales o cualquier otro medio de control implementado por la empresa.`,
    `Asimismo, “El Trabajador” se obliga a reportar el inicio de sus labores y su presencia en el servicio o servicios asignados, mediante los medios de comunicación o plataformas que determine “El Patrón”, pudiendo incluir el envío de reportes, fotografías, ubicación o cualquier otro mecanismo que permita verificar la prestación efectiva del servicio.`,
    `Los registros generados a través de dichos medios constituirán constancia de asistencia, permanencia y cumplimiento de jornada, para efectos administrativos y laborales. En caso de no cumplir con alguno de estos recursos, la asistencia será considerada como injustificada.`,
    `DÉCIMA PRIMERA. - CADENA DE MANDO. Queda establecido que “El Trabajador” deberá en todo momento realizar las solicitudes necesarias a su superior jerárquico (DIRECTOR OPERATIVO), al margen del cumplimiento de sus responsabilidades, respetando siempre la cadena de mando que se adjunta como ANEXO 2 al presente contrato.`,
    `DÉCIMA SEGUNDA. - UNIFORME. “El Trabajador” deberá acudir al servicio con uniforme completo y limpio; igualmente, deberá cumplir con las normas de higiene, lo cual implica estar bien aseado, con uñas limpias, corte de cabello corto; en caso de usar barba y bigote deberán estar bien recortados, zapatos limpios, afeitado, etc.`,
    `DÉCIMA TERCERA. - CUIDADO DEL UNIFORME. “El Trabajador” se compromete a cuidar el uniforme asignado para el ejercicio de su función, firmando de recibido y, en caso de extravío o negligencia propia, “El Trabajador” deberá pagar o reponer lo perdido.`,
    `El desgaste natural por ejercicio de sus funciones de todas las herramientas y uniforme será repuesto por “El Patrón”; comprometiéndose “El Trabajador” a notificar a “El Patrón” en el momento del desgaste de estos. Asimismo, deberá portarlo única y exclusivamente durante su jornada laboral en el lugar de trabajo asignado.`,
    `DÉCIMA CUARTA. - CAPACITACIÓN Y ADIESTRAMIENTO. “El Patrón” proporcionará capacitación y/o adiestramiento, según los planes y programas que sobre este se requieran, en términos de lo dispuesto en el Capítulo III Bis, del Título IV, de la Ley Federal del Trabajo en vigor, quedando establecida la obligatoriedad de acudir a dichas capacitaciones, mismas que por ningún motivo serán consideradas como horas o jornada laboral extra.`,
    `DÉCIMA QUINTA. - CONFIDENCIALIDAD. “El Trabajador” se obliga a guardar estricta confidencialidad respecto de toda la información a la que tenga acceso con motivo de sus funciones, incluyendo de manera enunciativa mas no limitativa: datos de la empresa, de sus clientes, proveedores, personal, instalaciones, sistemas de seguridad, procedimientos operativos, registros, bitácoras, así como cualquier otra información de carácter reservado o sensible.`,
    `“El Trabajador” se compromete a no divulgar, revelar, copiar, reproducir, sustraer o utilizar dicha información para fines distintos a los estrictamente relacionados con el desempeño de sus funciones, sin la autorización previa y por escrito del patrón.`,
    `Esta obligación de confidencialidad subsistirá aun después de la terminación de la relación laboral, por el tiempo que la información conserve su carácter confidencial. El incumplimiento de esta obligación será considerado falta grave, podrá constituir causa de rescisión de la relación laboral sin responsabilidad para “El Patrón”, en términos de lo dispuesto en el artículo 47 de la Ley Federal del Trabajo, sin perjuicio de las acciones civiles o legales que correspondan.`,
    `DÉCIMA SEXTA. – AGUINALDO Y VACACIONES. “El Trabajador” tendrá derecho a recibir aguinaldo anual equivalente a quince días de salario, conforme al artículo 87 de la Ley Federal del Trabajo. En caso de no haber laborado el año completo, se pagará la parte proporcional correspondiente.`,
    `Asimismo, “El Trabajador” tendrá derecho a disfrutar de vacaciones pagadas una vez cumplido un año de servicios, conforme a lo establecido en el artículo 76 de la Ley Federal del Trabajo, así como a recibir la prima vacacional correspondiente, en términos del artículo 80 del mismo ordenamiento. En caso de terminación de la relación laboral, se cubrirán las partes proporcionales que correspondan.`,
    `DÉCIMA SÉPTIMA. - ESTUDIO DE MANUALES, CONSIGNAS Y PROCESOS DE EVALUACIÓN. “El Trabajador” se obliga a estudiar, conocer y cumplir con las consignas, manuales operativos, reglamentos internos, protocolos de seguridad y demás lineamientos aplicables a los servicios en los que sea asignado.`,
    `Asimismo, “El Trabajador” acepta someterse a procesos de evaluación, revisión de conocimientos y aplicación de exámenes, ya sea de manera periódica o aleatoria, con la finalidad de verificar el adecuado conocimiento de los procedimientos, consignas y funciones propias del puesto.`,
    `Dichas evaluaciones podrán realizarse durante la vigencia de la relación laboral y formarán parte de los mecanismos de control y capacitación necesarios para garantizar la correcta prestación de los servicios de seguridad privada.`,
    `DÉCIMA OCTAVA. - REGLAMENTO INTERNO. “El Trabajador” está obligado a respetar y cumplir con las disposiciones establecidas en el reglamento interno, mismo que se le proporciona a “El Trabajador” para su conocimiento, por lo que no puede violar ninguna de las normas estipuladas en este. Asimismo, “El Trabajador” hace constar, por medio de su firma en el presente contrato, que conoce cada una de las normas a las que se hace referencia en esta cláusula.`,
    `DÉCIMA NOVENA. - CAUSAS DE RESCISIÓN. La relación de trabajo podrá rescindirse sin responsabilidad para “El Patrón”, cuando “El Trabajador” incurra en cualquiera de las causas previstas en el artículo 47 y 135 de la Ley Federal del Trabajo.`,
    `De manera enunciativa, se considerarán causas de rescisión aquellas conductas que impliquen incumplimiento a las obligaciones laborales, desobediencia a las instrucciones de sus superiores, abandono del servicio, actos de indisciplina, consumo de bebidas alcohólicas o sustancias prohibidas durante la jornada laboral, divulgación de información confidencial o cualquier conducta que afecte la prestación de los servicios de seguridad.`,
    `VIGÉSIMA. - EXÁMENES TOXICOLÓGICOS. “El Trabajador” acepta someterse a exámenes toxicológicos o de detección de consumo de alcohol o sustancias prohibidas, los cuales podrán aplicarse al ingreso, de manera periódica, aleatoria o cuando existan indicios razonables, con la finalidad de garantizar la adecuada prestación de los servicios de seguridad.`,
    `Dichos exámenes podrán realizarse durante la jornada laboral o en las instalaciones que determine “El Patrón”, conforme a las políticas internas de la empresa.`,
    `El incumplimiento injustificado a someterse a dichas pruebas o el resultado positivo podrá dar lugar a la aplicación de las medidas correspondientes conforme a la Ley Federal del Trabajo y al reglamento interno de trabajo.`,
    `VIGÉSIMA. PRIMERA. - BENEFICIARIO. - “El Trabajador” autoriza a la empresa, con base en el artículo 501 de la Ley Federal del Trabajo, designar como beneficiario/a, para otorgar sus salarios y prestaciones devengadas y no cobradas, en caso de muerte y/o desaparición por un acto delincuencial, al/a la C. ${params.beneficiario.toUpperCase()}, con parentesco ${params.parentesco} y ${params.porcentaje}% de dicha percepción.`,
    `VIGÉSIMA. SEGUNDA- CONTACTO DE EMERGENCIA “El Trabajador” designa como contacto de emergencia a la ${emp.contacto_emergencia || '______'}, quien es su ${emp.parentesco || '______'} y cuenta con número de teléfono: ${emp.telefono_emergencia || '______'}, a quien “El Patrón”, podrá notificar en caso de accidente, enfermedad o cualquier situación que comprometa la salud o integridad de “El Trabajador” durante el desempeño de sus funciones.`,
    `VIGÉSIMA. TERCERA. - INASISTENCIAS. Cuando “El Trabajador” por cualquier circunstancia se vea obligado a faltar a sus labores, deberá avisar a “El Patrón”, por conducto de sus representantes, con mínimo 12 horas de anticipación a la entrada de su turno. El aviso no justifica la falta, pues en todo caso “El Trabajador” al regresar a sus labores deberá justificar su ausencia con el comprobante respectivo, que en caso de enfermedad será únicamente el certificado de incapacidad. Cuando “El Trabajador” solicite permiso para faltar a sus labores, deberá recabar en todo caso constancia escrita de “El Patrón”; sin dicho requisito, su inasistencia se considerará como falta injustificada.`,
    `VIGÉSIMA CUARTA. - AVISO. Se establece y reconoce “El Trabajador” que, si desea dejar de laborar para “El Patrón”, tendrá la obligación de avisar con 10 días naturales de anticipación, así como de hacer entrega a la administración de toda y cada una de la documentación, indumentaria o materiales que tenga en su poder.`,
    `VIGÉSIMA QUINTA. - AUTORIZACIÓN. “El Trabajador” autoriza a “El Patrón” a ser grabado mediante cámaras de seguridad durante la jornada laboral, a fin de salvaguardar la seguridad del trabajador en caso de un accidente y/o acción suscitada en las instalaciones de la empresa, o donde se encuentre prestando sus servicios.`,
    `VIGÉSIMA SEXTA. - DATOS PERSONALES. “El Patrón” y “El Trabajador” declaran que los datos personales que se proporcionen entre sí, así como aquellos generados o recopilados durante la relación laboral y una vez terminada dicha relación, serán tratados de forma confidencial, mismas que serán sujetas a medidas de seguridad, en virtud de lo establecido en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.`,
    `VIGÉSIMA SÉPTIMA. - USO Y CUIDADO DE MOBILIARIO (LEY SILLA). El trabajador reconoce que, en cumplimiento de la normativa aplicable en materia de condiciones laborales (comúnmente conocida como “Ley Silla”), el empleador le proporcionará una silla o asiento adecuado para el desarrollo de sus funciones, particularmente en aquellas actividades que lo permitan.`,
    `En virtud de lo anterior, el trabajador se obliga a hacer un uso correcto, responsable y adecuado del mobiliario proporcionado, comprometiéndose a:`,
    `Utilizar la silla exclusivamente para los fines laborales correspondientes.`,
    `Mantenerla en buen estado, evitando daños por uso indebido, negligencia o descuido.`,
    `Reportar de manera inmediata cualquier desperfecto, daño o anomalía que presente el mobiliario.`,
    `El incumplimiento de estas obligaciones podrá dar lugar a las responsabilidades que correspondan conforme a la legislación laboral aplicable y a las disposiciones internas de la empresa.`,
    `VIGÉSIMA OCTAVA. - ENCABEZADOS Y JURISDICCIÓN. Los encabezados de las cláusulas del presente contrato se han colocado para conveniencia de “Las Partes”, con el exclusivo objeto de facilitar su lectura y localización; por tanto, no necesariamente definen ni limitan el contenido de estas. Para la interpretación de cada cláusula deberá entenderse exclusivamente a su contenido, y de ninguna manera a su título, por lo que no afectará la interpretación y la validez de este instrumento, ni los términos, condiciones, derechos u obligaciones en el presente contrato. Así mismo se someten a la jurisdicción de los Juzgados Laborales de la ciudad de Monterrey Nuevo León, renunciando a cualquier otro fuero que pudiera corresponderles por domicilio futuro. Ambas partes convienen en que lo no previsto en el presente contrato se sujetará a las disposiciones de la Ley Federal del Trabajo en vigor.`,
    `Leído que fue por ambas partes el presente contrato individual de trabajo, enterados de su contenido, alcance, fuerza y valor legal, sabedores y conscientes de las obligaciones que contraen, lo ratifican y firman de conformidad en la ciudad de Monterrey, Nuevo León, el día ${today.getDate()} de ${meses[today.getMonth()]} del año ${today.getFullYear()}.`,
    `“El Patrón”`,
    `JUAN CARLOS CANALIZO HERNÁNDEZAPODERADO LEGAL DE “CIMA-SERCO SEGURIDAD PRIVADA Y CONFIABILIDAD, S.A. DE C.V.”`,
    `“El Trabajador”`,
    `Nombre comnpleto, firma y huellas digitales`,
  ];

  paragraphs.forEach((p, idx) => {
    if (idx === 0) {
      addParagraph(p, true, true);
    } else {
      addParagraph(p, false, false);
    }
  });

  addSignatures();

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addPageDecorations(i);
  }

  doc.save(`Contrato_${emp.nombre_completo.replace(/\s+/g, "_")}.pdf`);
}
