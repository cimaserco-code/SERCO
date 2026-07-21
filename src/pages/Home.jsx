import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Users, Briefcase, Package, FileText, ArrowRight, Clock, CheckCircle, DollarSign, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { useSedeScope } from "@/hooks/useSedeScope";
import { usePermissions } from "@/lib/PermissionsContext";

export default function Home() {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const { sedeFilter } = useSedeScope();
  const [stats, setStats] = useState({
    empleadosActivos: 0,
    empleadosBajas: 0,
    servicios: 0,
    inventario: 0,
    documentos: 0,
    turnos: 0,
    pagados: 0,
    pendientes: 0,
    totalFacturado: 0,
    totalCobrado: 0,
  });
  const [loading, setLoading] = useState(true);

  // Normalize role matching to lowercase
  const role = (user?.role || "").toLowerCase();
  
  // Decide which dashboard components to show
  const showFinances = role === "jefe" || role === "finanzas" || role === "admin" || !user;
  const showRH = role === "jefe" || role === "rh" || role === "admin" || !user;

  useEffect(() => {
    async function load() {
      try {
        const [emp, serv, inv, docs, turnos, cobros] = await Promise.all([
          canView("empleados") ? base44.entities.Empleado.filter(sedeFilter) : Promise.resolve([]),
          base44.entities.Servicio.filter(sedeFilter),
          base44.entities.InventarioItem.filter(sedeFilter),
          base44.entities.Documento.list(),
          base44.entities.AsignacionTurno.filter(sedeFilter),
          base44.entities.Cobro.filter(sedeFilter)
        ]);

        const empsActivos = emp.filter(e => !e.fecha_baja).length;
        const empsBajas = emp.filter(e => e.fecha_baja).length;

        const cobrosPagados = cobros.filter(c => c.estado === 'pagado');
        const cobrosPendientes = cobros.filter(c => c.estado === 'pendiente' || c.estado === 'vencido');

        const totalFacturado = cobros.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const totalCobrado = cobrosPagados.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const totalPendiente = cobrosPendientes.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);

        setStats({
          empleadosActivos: empsActivos,
          empleadosBajas: empsBajas,
          servicios: serv.length,
          inventario: inv.length,
          documentos: docs.length,
          turnos: turnos.length,
          pagados: totalCobrado,
          pendientes: totalPendiente,
          totalFacturado: totalFacturado,
          totalCobrado: totalCobrado,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id, sedeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-heading font-bold">Bienvenido, {user?.nombre || "Usuario"}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Rol: <span className="font-semibold uppercase text-primary">{user?.role || "Sin rol"}</span> · Resumen general de SERCO
          </p>
        </div>
      </div>

      {/* 1. FINANCIAL DASHBOARD (Jefe & Finanzas) */}
      {showFinances && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resumen Financiero (Cobros del Mes)
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
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Estadísticas de Personal (Recursos Humanos)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
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
                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold">{loading ? "—" : stats.empleadosBajas}</div>
                  <p className="text-xs text-muted-foreground">Personal de Baja (Histórico)</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold">{loading ? "—" : stats.empleadosActivos + stats.empleadosBajas}</div>
                  <p className="text-xs text-muted-foreground">Total Registrados</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. ACCESS SHORTCUTS */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Enlaces Rápidos</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canView("empleados") && (
            <Link to="/empleados">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-blue-500 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">Ver Empleados</div>
                  <p className="text-xs text-muted-foreground mt-1">Expedientes, bajas y uniformes</p>
                </CardContent>
              </Card>
            </Link>
          )}

          {canView("asistencias") && (
            <Link to="/asistencias">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">Asistencias</div>
                  <p className="text-xs text-muted-foreground mt-1">Control diario y asistencia extra</p>
                </CardContent>
              </Card>
            </Link>
          )}

          {canView("servicios") && (
            <Link to="/servicios">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-slate-500 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">Servicios</div>
                  <p className="text-xs text-muted-foreground mt-1">Lista de clientes y contratos</p>
                </CardContent>
              </Card>
            </Link>
          )}

          {canView("cobros") && (
            <Link to="/cobros">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-purple-500 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">Facturación</div>
                  <p className="text-xs text-muted-foreground mt-1">Monitoreo de cobros y facturas</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}