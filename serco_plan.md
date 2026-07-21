En mi mente funciona así. Te lo presento por módulos, primero obvio empieza con el Login pero pues lo pondré porque termina siendo parte de la página y la principal. Cada módulo tendrá una descripción a como la pueda explicar yo sobre que funcione quiero que tenga. 

[**Login	2**](#login)

[**Inicio	2**](#inicio)

[**Empleados	2**](#empleados)

[**Servicios	3**](#servicios)

[**Vacantes	3**](#vacantes)

[**Asistencias	3**](#asistencias)

[**Cobros	3**](#cobros)

[**Inventario	4**](#inventario)

[**Documentos	4**](#documentos)

[**Cliente	4**](#cliente)

[**Administrativo	4**](#administrativo)

# Login {#login}

* Crear cuenta  
* Login

# Inicio {#inicio}

* Aquí pienso en tener como que 3 dashboards distintos  
  * JEFE  
    * Puede ver el dashboard de los dineros del mes, cuanto se pago cuanto falta etc  
    * Cuantos empleados hay, cuantos de baja, cuantos contratados  
  * RH  
    * Cuantos empleados hay, cuantos de baja, cuantos contratados  
  * Finanzas  
    * Puede ver el dashboard de los dineros del mes, cuanto se pago cuanto falta etc

# Empleados {#empleados}

* Cómo listado de excel, que se tenga la siguiente info:  
  * Nombre  
  * Servicio  
  * Sueldo  
  * RFC  
  * CURP  
  * NSS  
  * Fecha de ingreso  
  * Fecha de baja (aqui, idea que se me ocurrió, que dentro de este módulo exista otra pestana, pero que tenga únicamente a los que se dieron de baja, para que no sean parte de la lista actual, pero que exista que los tuvimos, porque funciona para ver cuanto se les ocupa dar de finiquito, cuantos dias, etc)  
  * Numero de Actas administrativas  
  * Que uniformes tienen  
  * Sede (este unicamente para filtrar por usuario de Xalapa y de Monterrey, no es necesario que se vea a los usuarios)  
* Existe la probabilidad que se le tenga que agregar mas informacion que ocupa tener el listado

# Servicios {#servicios}

* Igual es una lista sobre la informacion de los servicios.  
  * Nombre  
  * Direccion  
  * Administrador  
  * Correo  
  * Numero  
  * Inicio de servicio  
  * Contrato  
  * Sede (este unicamente para filtrar por usuario de Xalapa y de Monterrey, no es necesario que se vea a los usuarios)

# Vacantes {#vacantes}

* Es solo una seleccion por servicio, se vincula con los nombres que ya tenemos de servicio, y se tiene 3 secciones por servicio:  
  * Matutino  
  * Vespertino  
  * Cubredescansos

  En estos hay un boton de agregar, que muestra que empleados estan en que turno y la opcion de agregar, que se vincule a la lista de empleados

# Asistencias {#asistencias}

* No existe todavía este módulo, pero la idea es que el supervisor pueda acceder y editar esta. Es simplemente un listado como en las escuelas que utilizan los maestros para poder tomar asistencia, y que puedan marcar “Falta”, “Asistió”, “Descanso”, “Extra”   
* Igual que sea visto por mes  
* Que esté vinculado con la lista de empleados

# Cobros {#cobros}

* Lista similar a “Servicios”, de hecho quiero que este vinculado, pero únicamente el nombre, y ya en este se pueda editar:  
  * Fecha de Factura  
  * Fecha de Pago  
  * Fecha de Cobro  
  * Estatus (Como seleccionable de “Pendiente” y “Pagado”)  
  * Monto

  Tiene que ser por mes, asi que se me ocurre tener como un carrusel por mes, tipo unas flechitas en la esquina superior derecha, para cambiar de mes y que se tenga como título en el medio superior que mes es

# Inventario {#inventario}

* El mas simple, ya esta listo en el codigo de base44. Es una simple lista de que uniformes, y papeleria se tiene en la oficina, parece listado de excel. Se tiene:  
  * Nombre  
  * Sede  
  * Cantidad  
  * Categoria

# Documentos {#documentos}

* Es tener la opcion de subir archivo, y ponerle nombre ej: RH sube la plantilla para el contrato de inicio, y lo descarga cada que se vaya a ocupar.  
* Pero se me ocurre poder tener como que varias pestanas dentro. Estilo pestana de RH, de finanzas, extra. Y que se seleccione una pestana y este de que los contratos, plantilla de gafete, en finanzas por ejemplo plantilla de recibo. Etc (esta en vemos la idea)

# Cliente {#cliente}

* No tengo bien definido como esta este, pero la idea es que los administradores de los servicios puedan meterse y ver la informacion de sus servicios como:  
  * Listado de sus guardias en el servicio  
  * Fecha y cantidad de cobro

# Administrativo {#administrativo}

* Este en el sistema me parece que esta bien,   
  * Cread y editar SEDE  
  * Editar permisos de rol  
    * Aqui al seleccionar el rol, puedo hacer que puede ver cada uno, editar, eliminar, etc.  
  * Manejo de usuario  
    * Aqui les pongo que rol tienen, de que sede, puedo eliminar la cuenta, y mandar el passkey de contrasena en caso de que se les olvide para crear otra. Me gustaria poder editar el nombre nomas.