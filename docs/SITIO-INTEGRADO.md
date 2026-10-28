# Un solo sitio: comunidad y administración

La aplicación completa abre la comunidad en su dirección principal. Administrador muestra el formulario en esa página. El servidor verifica correo, contraseña y rol; una cuenta de miembro no puede entrar al panel del personal.

El panel se presenta en un marco del mismo origen dentro de la página. La dirección visible, el sitio y la pestaña permanecen iguales. Sus estilos se mantienen aislados de la portada. Volver a la comunidad conserva la sesión; Cerrar sesión elimina la sesión del servidor y devuelve a la vista pública.

La configuración inicial del primer administrador se abre en el mismo espacio y continúa protegida por SETUP_TOKEN en el alojamiento. No hay contraseñas predeterminadas.

## Límites de acceso

Las API siguen comprobando autenticación y roles. El documento del panel puede enmarcarse únicamente desde el propio origen; otros sitios están bloqueados por CSP. La página principal acepta el aviso de salida solo del marco administrativo que abrió y con el mismo origen. No se transfieren contraseñas ni datos de miembros mediante mensajes entre ventanas.

/admin se conserva por compatibilidad y soporte; no es necesario abrirlo para el uso habitual. Todos los módulos, la comunidad, los eventos y las cuentas usan el mismo servidor y la misma base de datos.

## Publicación

GitHub Pages continúa siendo la copia informativa. No puede ejecutar el servidor. El acceso no se activa en esa copia hasta disponer del alojamiento completo. La plantilla Render prepara el sitio completo con disco persistente. En la revisión del 28 de octubre de 2026, Render permitió iniciar sesión, pero exigió registrar un método de pago antes de crear los recursos. No se ha contratado ni desplegado el servidor.

Una vez publicado y comprobado el servidor, se podrá actualizar el enlace público y redirigir la copia informativa al sitio completo. No se configura una redirección hacia una dirección que todavía no existe.
