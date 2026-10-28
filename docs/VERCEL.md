# Adaptador para Vercel Hobby (pendiente de publicar)

La misma aplicación puede atender todas las rutas mediante api/index.js, que utiliza el controlador HTTP compartido de server.js. No se abre un puerto adicional en Vercel. vercel.json dirige las solicitudes al controlador y empaqueta vistas y dependencias nativas. La base debe ser remota: el sistema no inicia con una base temporal local en Vercel.

Este adaptador está preparado, pero todavía no se ha creado ni desplegado un proyecto en Vercel. Las pruebas locales no confirman por sí solas una publicación funcional en ese proveedor.

Para configurar una publicación Hobby gratuita se necesita iniciar sesión en Vercel, utilizar Node.js 24 y guardar TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NODE_ENV=production, COOKIE_SECURE=true y un SETUP_TOKEN privado en el servidor. Las claves no se suben al repositorio. La carpeta de datos, .env, las pruebas y documentación quedan excluidas de una eventual subida con la CLI mediante .vercelignore.

La URL de los correos usa APP_URL o VERCEL_PROJECT_PRODUCTION_URL. La recuperación y la verificación siguen necesitando un proveedor de correo configurado. Deben comprobarse tamaño del paquete, dependencias nativas, conexión remota, sesiones, carga de imágenes y reportes antes de presentar el nuevo enlace como terminado.

Límites de Hobby: cuotas de ejecución y transferencia; uso individual y proyectos no comerciales según las condiciones del proveedor. No se contratará Pro ni se introducirán datos de pago.

Referencias oficiales:

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
