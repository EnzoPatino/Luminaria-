# Arquitectura del Backend - Luminaria Monitoring System

¡Hola! Como tu desarrollador backend, te explico lo que hizo Claude (el asistente anterior) para dejar lista la base de nuestro servidor.

Básicamente, Claude estructuró un proyecto estándar y escalable usando **Node.js** y **Express**. Esta estructura es ideal para mantener el código ordenado a medida que el proyecto crezca.

## ¿Qué hizo exactamente?

1. **Inicializó el proyecto (`package.json`)**:
   - Definió el proyecto como `luminaria-backend`.
   - Instaló dependencias clave: `express` (el framework para el servidor), `cors` (para permitir que el frontend se comunique con el backend sin problemas de seguridad de origen cruzado) y `dotenv` (para manejar variables de entorno como puertos o contraseñas).

2. **Punto de entrada (`server.js`)**:
   - Creó el archivo principal que levanta el servidor. Se encarga de cargar las variables de entorno, importar la aplicación y ponerla a escuchar en el puerto especificado (por defecto 3000).
   - Añadió un manejador de errores global (`unhandledRejection`) para que si algo falla críticamente, el servidor se apague de forma segura.

3. **Configuración de la App (`src/app.js`)**:
   - Aquí configuró Express. Añadió los *middlewares* necesarios para entender formato JSON (`express.json()`) y configuró el CORS.
   - Centralizó todas las rutas bajo el prefijo `/api`.
   - Añadió un manejador de errores personalizado al final de las rutas (`errorHandler`).

4. **Arquitectura de carpetas (dentro de `src/`)**:
   Claude armó una estructura basada en el patrón Modelo-Vista-Controlador (MVC) y capas de servicio:
   - **`config/`**: Para guardar configuraciones globales (variables, conexiones a bases de datos).
   - **`controllers/`**: Aquí irá la lógica de qué hacer cuando llega una petición HTTP.
   - **`middlewares/`**: Funciones que se ejecutan antes del controlador (ej. verificar si un usuario está autenticado).
   - **`models/`**: Donde definiremos los esquemas de la base de datos (ej. cómo es una "Luminaria").
   - **`routes/`**: Donde se definen las URLs (endpoints). Ya dejó listo un `healthRoutes.js` (probablemente un `/api/health`) para comprobar que el servidor está vivo.
   - **`services/`**: Aquí pondremos la lógica de negocio pesada, separándola de los controladores para que el código sea más reutilizable.

En resumen, dejó los cimientos perfectos para que ahora podamos empezar a programar la lógica real (crear luminarias, actualizarlas, conectarnos a la base de datos) sin preocuparnos por configurar el servidor desde cero. ¡Estamos listos para picar código!

## Próximos pasos y División de Tareas

Como somos un equipo de 2 desarrolladores backend, podemos dividirnos el trabajo de la siguiente manera para avanzar en paralelo:

### Desarrollador 1 (El otro desarrollador - Especialista en Datos y Lógica Core)
- **Base de Datos y Modelos**: Integrar el ORM/ODM (ej. Mongoose para MongoDB o Prisma/Sequelize para SQL) en `config/` y crear los esquemas en `models/` (ej: `Luminaria.js`, `Usuario.js`).
- **Scripts de Prueba (Seeds)**: Crear un script para poblar la base de datos con datos falsos de luminarias, para que el frontend y nosotros podamos probar la API rápidamente.
- **Servicios de Negocio**: Implementar la lógica compleja en `services/` (por ejemplo, los algoritmos de asignación o cálculos de estado).

### Desarrollador 2 (Tú - Endpoints, Seguridad y Arquitectura)
- **Controladores y Rutas (CRUD)**: Desarrollar las rutas en `routes/` y las funciones en `controllers/` para manejar las peticiones HTTP (listar, crear, actualizar, eliminar luminarias).
- **Validaciones y Seguridad**: Crear interceptores en `middlewares/` para validar los datos de entrada e implementar el sistema de login y tokens JWT para proteger las rutas.
- **Documentación de la API**: Configurar Swagger u otra herramienta para documentar los endpoints. Esto es vital para que el equipo de frontend sepa cómo conectarse.

¡Con esta división de tareas podemos atacar distintos frentes sin generar conflictos en el código del otro!
