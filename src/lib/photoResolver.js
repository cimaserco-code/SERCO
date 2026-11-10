import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const photoCache = new Map();

/**
 * Parsea una URL de Supabase Storage para extraer bucket y ruta del archivo
 */
export function parseSupabaseStorageUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      const publicPrefix = "/storage/v1/object/public/";
      const signPrefix = "/storage/v1/object/sign/";
      let pathPart = "";
      if (u.pathname.includes(publicPrefix)) {
        pathPart = u.pathname.slice(u.pathname.indexOf(publicPrefix) + publicPrefix.length);
      } else if (u.pathname.includes(signPrefix)) {
        pathPart = u.pathname.slice(u.pathname.indexOf(signPrefix) + signPrefix.length);
      }
      if (pathPart) {
        const decoded = decodeURIComponent(pathPart);
        const slashIdx = decoded.indexOf("/");
        if (slashIdx !== -1) {
          return {
            bucket: decoded.slice(0, slashIdx),
            path: decoded.slice(slashIdx + 1),
          };
        }
      }
    } else {
      if (trimmed.startsWith("fotos_empleados/")) {
        return { bucket: "fotos_empleados", path: trimmed.replace("fotos_empleados/", "") };
      }
      if (trimmed.startsWith("fotos/")) {
        return { bucket: "documentos", path: trimmed };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resuelve cualquier URL de fotografía (Data URL Base64, Storage de Supabase o URL externa)
 * a una URL lista para renderizar directamente en el navegador sin problemas de permisos.
 */
export async function resolvePhotoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 1. Data URLs y Blob URLs ya son directamente renderizables
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // 2. Caché en memoria
  if (photoCache.has(trimmed)) {
    return photoCache.get(trimmed);
  }

  // 3. URLs de Supabase Storage (incluso buckets privados con URL /public/)
  const sbInfo = parseSupabaseStorageUrl(trimmed);
  if (sbInfo) {
    try {
      const { data: signData, error: signErr } = await supabase.storage
        .from(sbInfo.bucket)
        .createSignedUrl(sbInfo.path, 60 * 60 * 24 * 7); // 7 días
      if (!signErr && signData?.signedUrl) {
        photoCache.set(trimmed, signData.signedUrl);
        return signData.signedUrl;
      }
    } catch {
      // Continuar al intento de descarga
    }

    try {
      const { data: blobData, error: dlErr } = await supabase.storage
        .from(sbInfo.bucket)
        .download(sbInfo.path);
      if (!dlErr && blobData) {
        const objUrl = URL.createObjectURL(blobData);
        photoCache.set(trimmed, objUrl);
        return objUrl;
      }
    } catch {
      // Ignorar
    }
  }

  // 4. Fallback: retornar URL directa
  photoCache.set(trimmed, trimmed);
  return trimmed;
}

/**
 * Hook de React para obtener la URL renderizable de una fotografía
 */
export function useResolvedPhoto(rawUrl) {
  const [resolved, setResolved] = useState(() => {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) return trimmed;
    if (photoCache.has(trimmed)) return photoCache.get(trimmed);
    return null;
  });

  useEffect(() => {
    if (!rawUrl || typeof rawUrl !== "string") {
      setResolved(null);
      return;
    }
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setResolved(null);
      return;
    }

    if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) {
      setResolved(trimmed);
      return;
    }

    if (photoCache.has(trimmed)) {
      setResolved(photoCache.get(trimmed));
      return;
    }

    let active = true;
    resolvePhotoUrl(trimmed).then((res) => {
      if (active) setResolved(res);
    });

    return () => {
      active = false;
    };
  }, [rawUrl]);

  return resolved;
}
