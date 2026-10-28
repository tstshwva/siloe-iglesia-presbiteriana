# Siloé - Iglesia Presbiteriana · versión 3.0

Administración de miembros, asistencia, eventos, ministerios, aportaciones y comunicados. Cinco roles con autorización en el servidor y base de datos SQLite persistente.

## Abrir en Windows

Instala Node.js 24 o posterior. Abre esta carpeta y haz doble clic en **iniciar.cmd**. Instala dependencias solo si faltan, busca un puerto libre, comprueba el servidor y abre el navegador. Mantén la ventana abierta mientras utilizas la aplicación.

En PowerShell, situado en esta carpeta:

```powershell
.\iniciar.cmd
```

La dirección habitual es http://127.0.0.1:3000. Si está ocupado por una versión anterior, el iniciador usa 3001 u otro puerto libre: **utiliza la dirección que muestra la ventana**, no una pestaña antigua. No necesitas permisos de administrador.

En la primera ejecución, crea el administrador. No hay cuentas ni contraseñas predeterminadas. Si ya usabas la versión anterior, se conserva tu base de datos y se añade el estado de usuarios automáticamente.

## Página pública en GitHub Pages

[Visitar Siloé — Iglesia Presbiteriana](https://tstshwva.github.io/siloe-iglesia-presbiteriana/). Sitio informativo con publicaciones públicas. El registro y el panel siguen en la aplicación local; Pages no los ejecuta. [Cómo actualizar esta web](docs/GITHUB-PAGES.md).

## Página de comunidad

Abre **Ver comunidad** desde el panel o agrega /comunidad a la dirección del iniciador. Administración: /admin. Ambas páginas comparten la base de datos.

Incluye eventos con Google Maps y Apple Maps, calendario descargable, confirmación de intención de asistir, avisos y ministerios. El registro aparece como solicitud en Miembros; después de verificar el correo, un responsable aprueba y vincula o crea el miembro. [Guía de comunidad](docs/COMUNIDAD.md).

## Mejoras incluidas

- Logo y nombre personalizados en acceso, menú, cabecera y reportes PDF; nombre institucional también en Excel.
- Fotografía de portada configurable, vista previa y opción para quitar imágenes.
- Registro rápido de miembros con nombre obligatorio y fecha automática; datos opcionales, familia y Guardar y agregar otro.
- Detección de duplicados por nombre normalizado o correo; confirmación explícita para homónimos.
- Importación Excel/CSV con plantilla, revisión previa, errores por fila y omisión de duplicados.
- Edición, roles y desactivación de usuarios; revocación de sesiones y protección del último administrador.
- Correo de recuperación y teléfono opcionales al crear/editar cuentas; actualización personal con contraseña actual. El enlace usa el correo alternativo si existe; el teléfono es contacto de apoyo, sin SMS.
- Cambio de contraseña personal y recuperación SMTP con enlace, caducidad y token de un solo uso.
- Asistencia con búsqueda y marcado de todos; historial y filtros por evento/periodo.
- Calendario mensual, cancelación conservando historial y actividades por ministerio.
- Aportaciones anónimas, ingresos mensuales y acceso financiero restringido.
- Reportes descargables en **PDF y Excel (.xlsx)**; participación por ministerio con actividades y asistencias del periodo.
- Gráficas de asistencia, nuevos miembros e ingresos (estos últimos según rol).
- Pruebas automatizadas y plantilla de GitHub Actions para Windows y Linux.

## Manuales

- [Uso de la aplicación](docs/MANUAL.md)
- [Matriz RF-01 a RF-10 y permisos](docs/REQUISITOS.md)
- [Arquitectura y API](docs/TECNICO.md)
- [Instalación, correo, respaldo y alojamiento](docs/OPERACION.md)
- [Validación y pendientes externos](docs/VALIDACION.md)
- [Ideas para próximas versiones](docs/IDEAS.md)

## Ejemplo real del PDF generado

![Reporte generado por la aplicación](docs/images/reporte-ejemplo.png)

Imagen de la primera página de un PDF generado con **datos ficticios y un logo de ejemplo**. No contiene datos de miembros reales. La foto predeterminada del acceso es ilustrativa de Unsplash; se puede reemplazar por una fotografía de la iglesia en Configuración.

## Desarrollo y pruebas

```sh
npm install
npm test
npm start
```

Para abrir automáticamente: npm run abrir. Para una instalación limpia de desarrollo o CI, usar npm ci con todas las instancias de la aplicación cerradas. **No ejecutar npm ci mientras un servidor esté usando las bibliotecas nativas en Windows.**

## Información privada

La base está en data/church.sqlite. data/, .env y node_modules/ están excluidos del repositorio. Detén las instancias de la aplicación antes de respaldar la carpeta data/ completa. No subas datos personales ni credenciales a GitHub.

## Qué necesita configuración externa

El código de correo está implementado y probado con un receptor SMTP local; para entregar correos reales hay que configurar el proveedor de la iglesia en .env. La aplicación incluye Dockerfile para alojamiento con disco persistente y HTTPS, pero **el repositorio de GitHub no es un servidor de la aplicación**. El despliegue requiere elegir y configurar un alojamiento. La revisión visual completa y capturas de las pantallas quedan pendientes de acceso del navegador al servidor local.

## Publicación web

[Preparar publicación de Siloé en Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftstshwva%2Fsiloe-iglesia-presbiteriana). Requiere una cuenta de Render y aprobar su servicio de pago con disco persistente. [Instrucciones](docs/OPERACION.md#publicar-en-render). Este botón prepara la instalación; no significa que ya exista una web publicada.
