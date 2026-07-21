import { Lock } from "lucide-react";

export default function AccessRestricted() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-lg">Acceso restringido</h3>
        <p className="text-muted-foreground text-sm mt-1">No tienes permiso para ver esta sección.</p>
      </div>
    </div>
  );
}