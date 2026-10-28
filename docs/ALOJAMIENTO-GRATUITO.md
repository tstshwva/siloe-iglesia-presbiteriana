# Opción gratuita: Render y Turso

La aplicación completa puede usar Render Free y una base SQLite compatible alojada en Turso Free. Para las personas que visitan Siloé sigue siendo un solo sitio: portada, inicio de sesión y administración integrada.

## Configuración

render.yaml y render-free.yaml definen únicamente un servidor Free, sin disco de pago ni base temporal de Render. La alternativa anterior con disco de pago se conserva en render-disk.yaml; no se utiliza para esta opción.

En Turso crea una base libSQL del plan Free. Configura exclusivamente en las variables privadas del servidor:

- TURSO_DATABASE_URL: dirección libsql:// de la base.
- TURSO_AUTH_TOKEN: clave privada con acceso a esa base.
- DB_REQUIRE_REMOTE=true: impide iniciar con una base local vacía si faltan las variables.
- SETUP_TOKEN: valor generado por Render que protege el alta inicial.

El navegador no recibe la clave de Turso. No se guarda en GitHub, en la página pública ni en un archivo JSON. APP_URL se obtiene de RENDER_EXTERNAL_URL. No se suben automáticamente los datos personales del equipo; la base remota empieza vacía.

La aplicación local sigue utilizando SQLite. DB_DRIVER=libsql permite probar el mismo controlador con una base temporal local, sin tocar la base real.

## Límites comprobados el 28 de octubre de 2026

Render Free se suspende después de 15 minutos sin tráfico y puede tardar cerca de un minuto en despertar. No tiene disco permanente; por eso los registros deben quedar en Turso. Render Free no permite SMTP por los puertos habituales 25, 465 y 587: para verificar correos y recuperar contraseñas hace falta configurar un proveedor HTTPS mediante el webhook de correo existente. No habilites registros de miembros hasta comprobar la entrega real.

Turso Free anuncia 5 GB de almacenamiento y cuotas mensuales. Revisa el uso y conserva respaldos privados. No se garantiza disponibilidad permanente ni que los proveedores mantengan las mismas condiciones. Render describe su plan gratuito como apropiado para pruebas y proyectos pequeños, no para aplicaciones de producción.

Referencias oficiales:

- https://render.com/docs/free
- https://turso.tech/pricing
- https://github.com/tursodatabase/libsql-js

## Validación

Las ocho pruebas automatizadas pasan con el controlador SQLite local y con libSQL local, incluidas transacciones, permisos, migraciones, importación, aprobación y reportes. Esto no sustituye la prueba real de escritura y lectura contra Turso ni la publicación en Render. El estado final del alojamiento debe comprobarse antes de compartir un enlace nuevo o redirigir GitHub Pages.
