# Validación · versión 3

## Evidencia automatizada

npm test ejecuta cinco pruebas: formato Excel, integración original, escenarios ampliados, calendario y comunidad. Se usan bases temporales y no se cambian los datos reales.

Escenarios comprobados: configuración inicial, inicio/cierre, contraseñas, cinco roles, bloqueo financiero (también reportes), desactivación de miembros, prevención de asistencias duplicadas, montos positivos, migración desde tabla users sin estado, identidad pública limitada, imágenes válidas/dañadas, duplicados normalizados, importación .xlsx con filas válidas/duplicadas/erróneas, consumo único de revisión, participación por ministerio, periodos inválidos, total financiero, descarga PDF, último administrador protegido, cambio de rol con revocación, usuario inactivo y **entrega de recuperación a un receptor SMTP local** con canje del enlace.

## PDF y Excel

Libro .xlsx comprobado por pruebas de estructura y apertura con openpyxl en la primera entrega. PDF de 25 miembros ficticios: cuatro páginas, todos los nombres extraídos y primera página renderizada e inspeccionada con Poppler. Incluye logo, nombre, datos institucionales y numeración. La imagen en images/reporte-ejemplo.png procede de ese PDF, no de una pantalla inventada.

## Inicio local

El iniciador se ejecutó con 3000 ocupado: seleccionó 3001 y comprobó satisfactoriamente /health. Se corrigió la reinstalación automática npm ci que causaba EPERM al encontrar una DLL abierta. Ahora las dependencias existentes se conservan y únicamente se instalan si faltan.

## Límites de validación

El navegador integrado no accedió a procesos locales de prueba. Por ello, no se certifica aún la revisión completa de pantallas, flujos ni tamaños móviles, y no se presentan capturas ficticias como evidencia. La adaptación móvil está implementada en CSS pero requiere comprobación visual. El error de versión anterior recibió una explicación específica en pantalla y un iniciador que evita puertos ocupados.

No se ha probado el correo de la iglesia con credenciales reales, ni un despliegue público o la imagen Docker. Esas comprobaciones requieren proveedor SMTP y alojamiento. Están documentadas como pendientes externos.

## Revisión manual pendiente en equipo del usuario

Acceso → subir logo/portada → verificar identidad → registro rápido y Guardar y agregar otro → duplicados → importar plantilla → editar/desactivar usuario → registrar/cancelar evento → asistencia → ministerio → aportaciones → comunicados → filtros y descargas → pantalla pequeña. Capturar esas pantallas sin información personal para completar el manual ilustrado.

## Verificación 2.1: contactos de recuperación

Alta con correo alternativo/teléfono, migración de cuentas anteriores, rechazo de formatos inválidos, actualización personal con contraseña actual, aislamiento de datos por usuario, entrega SMTP al alternativo, revocación de enlaces al cambiar contactos y uso del correo principal si no hay alternativo. Todos los correos de prueba usan buzones ficticios y un receptor SMTP local.

## Comunidad 3.0

Pruebas HTTP con bases temporales: registro sin elevar permisos, correo verificado de uso único, aprobación obligatoria, vínculo sin duplicados, creación de miembros, bloqueo de API administrativas, filtrado público/miembros/privado, anuncios futuros, bajas, confirmación idempotente, cancelación y calendario ICS con escape y plegado UTF-8. El usuario confirmó que la página abre sin error; sigue pendiente la revisión visual completa.

## Publicación GitHub Pages · 28 de octubre de 2026

Publicación comprobada en https://tstshwva.github.io/siloe-iglesia-presbiteriana/ con estado built en GitHub. En el navegador se comprobaron inicio, eventos, calendario mensual y datos de la iglesia. No se detectaron errores de consola durante esa revisión. La captura images/pagina-publica.png corresponde a la web publicada; su fotografía de fondo es ilustrativa. No se han validado aún todos los tamaños móviles ni eventos reales con direcciones, porque no hay publicaciones públicas en la base local. Las seis pruebas automatizadas pasaron, incluida la exclusión de datos privados del generador.
