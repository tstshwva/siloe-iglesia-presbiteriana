# Página pública en GitHub Pages

Dirección: https://tstshwva.github.io/siloe-iglesia-presbiteriana/

Publicación desde main, carpeta /docs. El archivo .nojekyll conserva los archivos estáticos sin procesarlos. Los recursos usan rutas relativas para funcionar dentro del nombre del repositorio.

## Qué muestra

Información institucional, logo y portada configurados, horarios y contacto, eventos públicos, avisos ya publicados y ministerios públicos. Cada evento permite consultar ubicación con Google Maps/Apple Maps y compartir su enlace. Si falta una dirección no se inventa una ubicación. Sin eventos confirmados se muestra un mensaje de próxima publicación. La foto predeterminada es ilustrativa, no una fotografía de Siloé.

No hay inicio de sesión, solicitudes, confirmaciones de asistencia ni acceso administrativo en esta versión pública. La aplicación local conserva esas funciones. La página no realiza solicitudes a la API local y no está sincronizada en tiempo real.

## Actualizar la información pública

1. En la aplicación local, actualiza Configuración y marca como públicos los eventos, avisos o ministerios que quieras publicar. Mantén privada cualquier información interna.
2. Ejecuta npm run pages:build desde la carpeta del proyecto. El generador lee data/church.sqlite en modo de solo lectura. Si usas otra base indica DB_PATH en el entorno.
3. Revisa docs/website/content.json y sube los cambios de docs a GitHub. GitHub Pages publicará la actualización.

También puedes editar directamente los campos públicos de docs/website/content.json en GitHub. Una generación posterior los reemplazará por la información local: evita mezclar ambos métodos sin revisar los cambios.

Las cuentas, contraseñas, miembros, finanzas, responsables y listas de integrantes no se exportan. Solo se admiten publicaciones con visibility igual a publico; los registros anteriores sin esa opción quedan excluidos. No subas la base de datos ni archivos .env.

## Pruebas

La prueba test/pages.test.js comprueba la exclusión de datos privados y avisos futuros. El generador crea views.js y style.css desde las vistas de comunidad; site.js contiene la navegación estática. La base alojada de GitHub Pages es una copia pública en JSON, no una base de datos de administración.

## Botón Administrador

El botón abre el formulario de correo y contraseña dentro de la página, sin pedir direcciones ni abrir otra pestaña. En GitHub Pages se muestra deshabilitado y se explica que el acceso por internet está pendiente: no hay un servidor que pueda verificar credenciales.

En la aplicación completa el formulario verifica las credenciales con el servidor y comprueba el rol antes de entrar al panel, dentro del mismo sitio y pestaña. Una cuenta de miembro no obtiene acceso administrativo. Los permisos de cada API permanecen en el servidor.
