import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sercoApi } from "@/api/sercoClient";
import { Users, Briefcase, Package, FileText, ArrowRight, Clock, CheckCircle, DollarSign, AlertCircle, ChevronLeft, ChevronRight, Plus, Megaphone, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";
import AccessRestricted from "@/components/AccessRestricted";

export default function Home() {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const { sedeFilter } = useSedeScope();
  
  if (!canView("inicio")) return <AccessRestricted />;
  
  const [stats, setStats] = useState({
    empleadosActivos: 0,
    empleadosBajas: 0,
    empleadosAltas: 0,
    servicios: 0,
    inventario: 0,
    documentos: 0,
    turnos: 0,
    pagados: 0,
    pendientes: 0,
    totalFacturado: 0,
    totalCobrado: 0,
  });
  const [sedeStats, setSedeStats] = useState([]);
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  const handleMonthChange = (direction) => {
    const [yearStr, monthStr] = currentMonth.split("-");
    let year = parseInt(yearStr);
    let month = parseInt(monthStr) - 1;
    month += direction;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    const mm = String(month + 1).padStart(2, '0');
    setCurrentMonth(`${year}-${mm}`);
  };

  const formatMes = (mes) => {
    if (!mes) return "—";
    try {
      return new Date(mes + "-01T00:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } catch {
      return mes;
    }
  };

  // Normalize role matching to lowercase
  const role = (user?.role || "").toLowerCase();
  
  // Decide which dashboard components to show based on role permissions
  const showFinances = canView("kpi_financiero");
  const showRH = canView("kpi_rh");
  const isCeoOrAdmin = role === "ceo" || role === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [emp, serv, inv, docs, turnos, cobros, seds, coms] = await Promise.all([
          (canView("empleados") ? sercoApi.entities.Empleado.filter(sedeFilter) : Promise.resolve([])).catch(() => []),
          sercoApi.entities.Servicio.filter(sedeFilter).catch(() => []),
          sercoApi.entities.InventarioItem.filter(sedeFilter).catch(() => []),
          sercoApi.entities.Documento.list().catch(() => []),
          sercoApi.entities.AsignacionTurno.filter(sedeFilter).catch(() => []),
          sercoApi.entities.Cobro.filter(sedeFilter).catch(() => []),
          sercoApi.entities.Sede.list().catch(() => []),
          sercoApi.entities.Comunicado.list().catch(() => [])
        ]);

        const activeComs = (coms || []).filter(c => c.activo !== false);
        setComunicados(activeComs);

        const empsActivos = emp.filter(e => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja)).length;
        const empsBajas = emp.filter(e => e.fecha_baja && e.fecha_baja.slice(0, 7) === currentMonth && (!e.fecha_reingreso || e.fecha_baja > e.fecha_reingreso)).length;
        const empsAltas = emp.filter(e => 
          (e.fecha_ingreso && e.fecha_ingreso.slice(0, 7) === currentMonth) || 
          (e.fecha_reingreso && e.fecha_reingreso.slice(0, 7) === currentMonth)
        ).length;

        const monthlyCobros = cobros.filter(c => c.mes === currentMonth);
        const cobrosPagados = monthlyCobros.filter(c => c.estado === 'pagado');
        const cobrosPendientes = monthlyCobros.filter(c => c.estado === 'pendiente' || c.estado === 'vencido');

        const totalFacturado = monthlyCobros.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const totalCobrado = cobrosPagados.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const totalPendiente = cobrosPendientes.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);

        setStats({
          empleadosActivos: empsActivos,
          empleadosBajas: empsBajas,
          empleadosAltas: empsAltas,
          servicios: serv.length,
          inventario: inv.length,
          documentos: docs.length,
          turnos: turnos.length,
          pagados: totalCobrado,
          pendientes: totalPendiente,
          totalFacturado: totalFacturado,
          totalCobrado: totalCobrado,
        });

        // Compute per-sede stats
        const computedSedeStats = seds.map(sede => {
          const sedeCobros = monthlyCobros.filter(c => c.sede_id === sede.id);
          const sedeCobrosPagados = sedeCobros.filter(c => c.estado === 'pagado');
          const sedeCobrosPendientes = sedeCobros.filter(c => c.estado === 'pendiente' || c.estado === 'vencido');
          
          const sFacturado = sedeCobros.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
          const sCobrado = sedeCobrosPagados.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
          const sPendiente = sedeCobrosPendientes.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
          
          const sServicios = serv.filter(s => s.sede_id === sede.id).length;
          const sEmpleados = emp.filter(e => e.sede_id === sede.id);
          const sEmpsActivos = sEmpleados.filter(e => !e.fecha_baja || (e.fecha_reingreso && e.fecha_reingreso >= e.fecha_baja)).length;
          const sEmpsBajas = sEmpleados.filter(e => e.fecha_baja && e.fecha_baja.slice(0, 7) === currentMonth && (!e.fecha_reingreso || e.fecha_baja > e.fecha_reingreso)).length;
          const sEmpsAltas = sEmpleados.filter(e => 
            (e.fecha_ingreso && e.fecha_ingreso.slice(0, 7) === currentMonth) || 
            (e.fecha_reingreso && e.fecha_reingreso.slice(0, 7) === currentMonth)
          ).length;
          
          return {
            sedeId: sede.id,
            sedeNombre: sede.nombre,
            pagados: sCobrado,
            pendientes: sPendiente,
            totalFacturado: sFacturado,
            servicios: sServicios,
            empleadosActivos: sEmpsActivos,
            empleadosBajas: sEmpsBajas,
            empleadosAltas: sEmpsAltas,
          };
        });
        setSedeStats(computedSedeStats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id, sedeFilter, currentMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold">Bienvenido, {user?.full_name || "Usuario"}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Rol: <span className="font-semibold uppercase text-primary">{user?.role || "Sin rol"}</span> · Resumen general de SERCO
          </p>
        </div>
        
        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg border shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[120px] text-center">
            {formatMes(currentMonth)}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Comunicados Section */}
      {comunicados.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary animate-bounce shrink-0" /> Comunicados Recientes
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {comunicados.map((com) => (
              <Card key={com.id} className="border-l-4 border-l-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-primary shrink-0" /> {com.titulo}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">{com.fecha}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{com.contenido}</p>
                  <div className="mt-3 text-right">
                    <span className="text-xs font-semibold text-muted-foreground italic">Publicado por: {com.autor_nombre || "Administración"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isCeoOrAdmin ? (
        <div className="space-y-8">
          {sedeStats.map(sede => (
            <div key={sede.sedeId} className="space-y-3 p-4 rounded-xl border bg-card/30">
              <h3 className="text-base font-bold text-primary border-b pb-2 capitalize">
                Sede: {sede.sedeNombre}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {showFinances && (
                  <>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{loading ? "—" : `$${sede.pagados.toLocaleString("es-MX")}`}</div>
                          <p className="text-xs text-muted-foreground">Cobrado (Pagados)</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{loading ? "—" : `$${sede.pendientes.toLocaleString("es-MX")}`}</div>
                          <p className="text-xs text-muted-foreground">Pendiente de Cobro</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                          <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{loading ? "—" : `$${sede.totalFacturado.toLocaleString("es-MX")}`}</div>
                          <p className="text-xs text-muted-foreground">Total Facturado</p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : sede.servicios}</div>
                      <p className="text-xs text-muted-foreground">Servicios Activos</p>
                    </div>
                  </CardContent>
                </Card>
                {showRH && (
                  <>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{loading ? "—" : sede.empleadosActivos}</div>
                          <p className="text-xs text-muted-foreground">Empleados Activos</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center shrink-0">
                          <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{loading ? "—" : sede.empleadosAltas}</div>
                          <p className="text-xs text-muted-foreground">Altas del Mes</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{loading ? "—" : sede.empleadosBajas}</div>
                          <p className="text-xs text-muted-foreground">Bajas del Personal</p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 1. FINANCIAL DASHBOARD (Jefe & Finanzas) */}
          {showFinances && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Resumen Financiero (Facturas del Mes)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : `$${stats.totalCobrado.toLocaleString("es-MX")}`}</div>
                      <p className="text-xs text-muted-foreground">Cobrado (Pagados)</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : `$${stats.pendientes.toLocaleString("es-MX")}`}</div>
                      <p className="text-xs text-muted-foreground">Pendiente de Cobro</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : `$${stats.totalFacturado.toLocaleString("es-MX")}`}</div>
                      <p className="text-xs text-muted-foreground">Total Facturado</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : stats.servicios}</div>
                      <p className="text-xs text-muted-foreground">Servicios Activos</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 2. RECURSOS HUMANOS DASHBOARD (Jefe & RH) */}
          {showRH && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Estadísticas de Personal (Recursos Humanos)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : stats.empleadosActivos}</div>
                      <p className="text-xs text-muted-foreground">Empleados Activos</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : stats.empleadosAltas}</div>
                      <p className="text-xs text-muted-foreground">Altas del Mes</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{loading ? "—" : stats.empleadosBajas}</div>
                      <p className="text-xs text-muted-foreground">Bajas del Personal</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}