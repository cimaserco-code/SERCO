import React from "react";
import { Link } from "react-router-dom";
import { Users, ShieldCheck, Building2, ArrowRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";

export default function Administracion() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Acceso restringido</h3>
          <p className="text-muted-foreground text-sm mt-1">
            No tienes permiso para ver esta sección.
          </p>
        </div>
      </div>
    );
  }

  const sections = [
    {
      label: "Usuarios",
      description: "Gestión de usuarios del sistema",
      icon: Users,
      to: "/administracion/usuarios",
      color: "bg-blue-500",
    },
    {
      label: "Roles",
      description: "Roles y permisos disponibles",
      icon: ShieldCheck,
      to: "/administracion/roles",
      color: "bg-indigo-500",
    },
    {
      label: "Sedes",
      description: "Ubicaciones y sedes operativas",
      icon: Building2,
      to: "/administracion/sedes",
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Administración</h2>
        <p className="text-muted-foreground text-sm mt-1">Gestión del sistema SERCO</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.to} to={card.to}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-lg ${card.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">{card.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}