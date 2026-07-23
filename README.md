# SERCO - Portal de Administración Interna

SERCO es un portal web administrativo premium diseñado para gestionar de manera integral la asignación de personal, control de asistencias, administración de servicios de seguridad privada, control de cobros/facturación, e inventario físico de insumos y uniformes.

Originalmente el proyecto estuvo vinculado a Base44, pero actualmente está migrado por completo para correr sobre **Vercel** en el frontend y **Supabase** como base de datos y sistema de almacenamiento.

---

## 📌 Arquitectura del Proyecto

El frontend está construido sobre **React + Vite**, utilizando **TailwindCSS** y componentes de **shadcn/ui**.

### Estructura de Directorios Clave
```
├── src/
│   ├── api/
│   │   └── sercoClient.js      # Adaptador principal que mapea entidades a tablas de Supabase
│   ├── components/            # Componentes reutilizables de UI (Tablas, Dialogs, Selectors)
│   ├── hooks/                 # Hooks personalizados (e.g., useSedeScope para filtrado regional)
│   ├── lib/
│   │   ├── AuthContext.jsx     # Manejo del estado de autenticación de Supabase
│   │   ├── PermissionsContext.jsx # Reglas y control de accesos basados en roles
│   │   └── supabaseClient.js   # Inicialización directa del SDK de Supabase
│   └── pages/                  # Vistas principales de la aplicación por módulos
├── public/                     # Recursos estáticos (e.g., favicon.png)
└── index.html                  # Plantilla HTML inicial
```

---

## ⚙️ Módulos de la Aplicación

La aplicación consta de los siguientes módulos funcionales:

### 1. Inicio (Dashboard)
Panel dinámico que adapta su contenido automáticamente según el rol del usuario conectado:
*   **Rol Jefe / Admin**: Vista consolidada de KPIs financieros (Total cobrado, facturado, pendiente) e indicadores de Recursos Humanos (total de colaboradores activos vs bajas).
*   **Rol RH**: Muestra únicamente los KPIs relacionados a la plantilla de personal.
*   **Rol Finanzas**: Enfocado puramente en cobros, montos facturados y estados de pago.

### 2. Empleados
Listado interactivo que separa los empleados en dos pestañas:
*   **Activos**: Permite añadir y editar perfiles con RFC, CURP, NSS, salario, uniforme y asignación de servicio. La asignación se realiza mediante una vinculación directa a los registros del módulo de Servicios.
*   **Bajas**: Listado histórico de personal desvinculado con una herramienta automática de estimación de finiquito proporcional basado en el sueldo y los días laborados.

### 3. Servicios
Catálogo de contratos y puntos de servicio activos. Registra la sede regional, ubicación, administrador responsable y estado operativo (Activo/Suspendido/Inactivo).

### 4. Turnos (Vacantes)
Control de distribución diaria de personal por servicio seleccionado, dividiendo la asignación en tres turnos operativos:
*   Matutino
*   Vespertino
*   Cubre Descansos
Los empleados se seleccionan directamente desde el catálogo de empleados de la base de datos para asegurar consistencia.

### 5. Asistencias
Parrilla mensual interactiva donde el supervisor puede marcar el estatus diario de asistencia para cada empleado activo:
*   **A** (Asistió)
*   **F** (Falta)
*   **D** (Descanso)
*   **E** (Extra)

### 6. Cobros
Gestión de facturación y cobranza organizada por mes. Permite vincular facturas a un servicio específico, definir la fecha de vencimiento y cambiar el estatus entre "Pendiente", "Vencido" o "Pagado".

### 7. Inventario
Listado de uniformes y papelería disponible en las oficinas centrales de la sede actual con control de stock numérico y categorías.

### 8. Documentos
Gestión de plantillas (RH, Finanzas, etc.). Cuenta con un componente de **subida de archivos físicos** conectado directamente a **Supabase Storage Buckets** (`documentos`). Los registros pueden visualizarse en pantalla si son texto o descargarse directamente en el dispositivo si corresponden a archivos subidos.

### 9. Área Administrativa (Sedes, Roles y Usuarios)
*   **Sedes**: Creación y edición de sedes físicas (e.g. Monterrey, Xalapa) para aplicar filtros de alcance.
*   **Roles**: Matriz de permisos detallada (Ver, Crear, Editar, Eliminar) para cada módulo.
*   **Usuarios**: Panel para asignar roles a perfiles de usuarios y definir a qué sedes regionales tienen acceso.

---

## 🔗 Relaciones y Modelo de Datos

Las tablas principales de Supabase se conectan de la siguiente manera:
*   **`profiles`**: Almacena los metadatos de los usuarios autenticados. Se vincula a **`roles`** mediante el campo `role` y a **`sedes`** a través de `sede_ids`.
*   **`empleados`**: Contiene la información personal. Se vincula al nombre de un `servicio` activo y filtra su visibilidad según la `sede_id`.
*   **`asignacion_turnos`**: Relaciona `empleados` y `servicios` en una sede y turno específico.
*   **`cobros`**: Vinculada dinámicamente a la tabla `servicios` para evitar registrar nombres manualmente.
*   **`asistencias`**: Vinculada por `empleado_id` registrando estados de asistencia por fecha.

---

## 🛠️ Configuración Local

### Prerrequisitos
*   Node.js (versión LTS)
*   Clonar el repositorio y ejecutar:
    ```bash
    npm install
    ```

### Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto con las siguientes credenciales:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

### Comandos de Ejecución
*   **Correr servidor local**:
    ```bash
    npm run dev
    ```
*   **Validar compilación de producción**:
    ```bash
    npm run build
    ```

---

## 🤖 Guía para Agentes de IA

Si eres un modelo de IA trabajando en este repositorio:
1.  **Supabase como Backend Único**: No uses APIs de Base44. Toda la lógica de entidades utiliza el adaptador `sercoApi` ubicado en [sercoClient.js](file:///c:/Users/Juan%20Marco/Documents/Emmanuel/SERCO/src/api/sercoClient.js), el cual realiza las peticiones directamente a las tablas públicas de Supabase mediante el cliente `@/lib/supabaseClient`.
2.  **No elimines compatibilidad**: El objeto `sercoApi` mantiene firmas de llamadas idénticas al cliente original para evitar romper los componentes visuales existentes.
3.  **Gestión de archivos**: Cualquier lógica de subida de archivos debe realizarse en el bucket público de almacenamiento llamado `documentos` mediante `supabase.storage.from('documentos')`.
