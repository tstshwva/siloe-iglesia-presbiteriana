# Instalación, operación y alojamiento

## Inicio local

Node.js >=24. Ejecutar iniciar.cmd (doble clic) o .\iniciar.cmd desde PowerShell en la carpeta. El iniciador busca dependencias; si faltan, usa npm install. Si ya existen, no las reinstala. Busca un puerto libre entre PORT y PORT+20, escucha únicamente en 127.0.0.1 y abre el navegador al comprobar /health. Mantener abierta la ventana.

Para desarrollo directo: npm install una vez y npm start. Esto usa PORT=3000 por defecto y no elige automáticamente otro puerto.

## Errores habituales

- PowerShell no reconoce iniciar.cmd: usar .\iniciar.cmd y comprobar la carpeta actual.
- Ruta inexistente / servidor de versión anterior: pestaña conectada a proceso viejo. Ejecutar el iniciador actualizado y usar la nueva dirección indicada.
- EPERM al reemplazar libvips DLL: npm ci intentó borrar una biblioteca abierta. Cerrar instancias de esta aplicación antes de una instalación limpia. El iniciador actualizado no realiza npm ci al arrancar.
- Puerto ocupado: el iniciador selecciona otro automáticamente; npm start solicita cambiar PORT o cerrar la instancia anterior.
- Navegador integrado sin acceso a localhost: probar el navegador del propio equipo. No modificar el firewall ni exponer la aplicación a toda la red como solución automática.

## Configuración privada

Copiar .env.example a .env y ajustar valores. El servidor y el iniciador lo cargan automáticamente. Variables ya definidas en el entorno tienen prioridad. .env nunca se sube a GitHub.

| Variable | Uso |
|---|---|
| HOST / PORT | Dirección / puerto del servidor; el iniciador local limita HOST a 127.0.0.1 |
| APP_URL | Dirección que recibirán los enlaces de recuperación |
| COOKIE_SECURE | true en HTTPS |
| NODE_ENV | production para alojamiento; development local |
| DB_PATH | Archivo SQLite; directorio padre debe existir |
| SETUP_TOKEN | Token privado para el alta inicial; el formulario lo solicita |
| SMTP_HOST / SMTP_PORT | Servidor y puerto de correo; habitual 587 o 465 |
| SMTP_USER / SMTP_PASSWORD | Credenciales privadas o contraseña de aplicación del proveedor |
| MAIL_FROM | Remitente autorizado por el proveedor |
| SMTP_REQUIRE_TLS | true; false solamente para receptor local de pruebas |
| RESET_WEBHOOK / RESET_WEBHOOK_SECRET | Alternativa de servicio privado que envía correo |

## Recuperación por correo real

Configurar SMTP, remitente y APP_URL. En puerto 465 se utiliza TLS desde el inicio; en 587 se solicita STARTTLS. No se deshabilita la validación de certificados. En producción se exige TLS. Reiniciar el servidor y revisar Configuración → Recuperación por correo. El indicador confirma que hay parámetros, no garantiza por sí solo la entrega al destinatario.

El mensaje contiene enlace al formulario y código. Se envía al correo de recuperación guardado en la cuenta; si no existe, al principal. El teléfono no es un canal automático de envío. Token de 30 minutos, un uso, almacenado como hash. La API responde de forma genérica para no revelar cuentas y registra fallos sin credenciales ni tokens. Sin proveedor, solo en desarrollo se imprime el código para pruebas. No se envió correo real durante la validación: se usó un receptor SMTP local.

## Respaldar y restaurar

Detener todas las instancias, copiar data/ completa a almacenamiento privado y reiniciar. Para restaurar, detener, conservar copia del estado actual, reemplazar data/ por el respaldo y abrir nuevamente. La migración añade active a cuentas antiguas con valor activo y conserva los registros. Probar la restauración antes de depender de ella.

## Alojamiento con Docker

Se incluye Dockerfile con Node.js 24, proceso sin privilegios, comprobación de salud y directorio /app/data. Elegir un servidor que admita disco persistente para SQLite. Montar un volumen en /app/data, configurar APP_URL HTTPS, COOKIE_SECURE=true, NODE_ENV=production, SETUP_TOKEN y SMTP desde secretos del proveedor. Configurar dominio y proxy HTTPS antes de uso real. No incluir .env ni la base en la imagen.

El Dockerfile no ha sido ejecutado en este equipo porque Docker no forma parte de la validación disponible. No se ha creado una cuenta, contratado un servicio ni desplegado en internet. GitHub Pages no ejecuta Node.js/SQLite. El repositorio y el despliegue son servicios distintos.

## Actualizar

Respaldar datos. Cerrar instancias, descargar los cambios, ejecutar npm install si hay nuevas dependencias y abrir iniciar.cmd. Para activar pruebas en GitHub, copiar docs/github-actions-ejemplo.yml a .github/workflows/tests.yml desde una sesión con permisos workflow. La autorización utilizada en esta entrega no permite crear workflows; la plantilla no está activa. Las subidas del agente son por entrega, no una automatización permanente.

## Publicar en Render

[Publicar Siloé en Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftstshwva%2Fsiloe-iglesia-presbiteriana)

La plantilla render.yaml ahora prepara un servidor Docker Free sin disco. Los registros deben almacenarse en Turso Free mediante las variables privadas TURSO_DATABASE_URL y TURSO_AUTH_TOKEN. Ver ALOJAMIENTO-GRATUITO.md. La plantilla anterior con disco de pago está en render-disk.yaml.

Inicia sesión en Render con GitHub, abre el enlace y revisa los recursos antes de confirmar. Una vez que el servicio indique Live, usa su dirección HTTPS: /comunidad para los hermanos y /admin para administración. El nombre solicitado es siloe-iglesia-presbiteriana; la dirección definitiva la asigna Render según disponibilidad.

La base alojada empieza vacía; los registros del equipo no se suben automáticamente. Configura primero la conexión privada de Turso. En Environment, consulta en privado SETUP_TOKEN, generado por Render, y úsalo para crear al primer administrador. No compartas ese valor en el chat. La URL de correo se obtiene automáticamente de RENDER_EXTERNAL_URL salvo que definas APP_URL.

Configura SMTP o el webhook para verificación y recuperación de contraseñas reales. No habilites registros de miembros hasta comprobar la entrega. Las actualizaciones se publican manualmente desde Render; la plantilla desactiva despliegues automáticos. Conserva respaldos privados antes de actualizar.
