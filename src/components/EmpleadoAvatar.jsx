import React, { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Camera } from "lucide-react";
import { useResolvedPhoto } from "@/lib/photoResolver";

/**
 * Avatar circular para empleados en tablas y listas.
 * Resuelve automáticamente URLs Base64, Storage de Supabase o URLs públicas,
 * mostrando siempre la fotografía o sus iniciales estilizadas.
 */
export function EmpleadoAvatar({
  fotoUrl,
  nombre,
  className = "h-9 w-9 mx-auto border shadow-sm",
  fallbackClassName = "text-[10px] bg-muted font-bold text-muted-foreground",
}) {
  const resolvedUrl = useResolvedPhoto(fotoUrl);
  const [hasError, setHasError] = useState(false);

  // Iniciales limpias del empleado
  const initials = nombre
    ? nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <Avatar className={className}>
      {resolvedUrl && !hasError && (
        <AvatarImage
          src={resolvedUrl}
          alt={nombre || "Empleado"}
          className="object-cover"
          onError={() => setHasError(true)}
        />
      )}
      <AvatarFallback className={fallbackClassName}>
        {initials || <User className="w-4 h-4 text-muted-foreground" />}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Fotografía tipo perfil / hero para el diálogo de detalles del empleado.
 * Muestra la imagen nítida donde va en el perfil, y si el usuario tiene permisos,
 * permite cambiar o subir la foto directamente al interactuar con el recuadro.
 */
export function EmpleadoProfilePhoto({
  fotoUrl,
  nombre,
  className = "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-primary/20 shadow-md bg-background",
  fallbackClassName = "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shadow-xs font-heading font-bold text-lg select-none",
  canEdit = false,
  uploading = false,
  onUploadPhoto,
}) {
  const resolvedUrl = useResolvedPhoto(fotoUrl);
  const [hasError, setHasError] = useState(false);
  const fileInputRef = useRef(null);

  const initials = nombre
    ? nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <div className="relative shrink-0 group">
      {resolvedUrl && !hasError ? (
        <img
          src={resolvedUrl}
          alt={nombre || "Fotografía de empleado"}
          className={className}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className={fallbackClassName}>
          {initials || <User className="w-8 h-8" />}
        </div>
      )}

      {canEdit && onUploadPhoto && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadPhoto(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-2xl bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-semibold gap-1 cursor-pointer z-10 shadow-sm backdrop-blur-[1px]"
            title="Cambiar fotografía del empleado"
          >
            {uploading ? (
              <span className="text-[10px] animate-pulse">Guardando...</span>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>{resolvedUrl ? "Cambiar" : "Subir"}</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
