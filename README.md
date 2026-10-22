# TP 08 - Reservas de salas con HTTP y MongoDB

Esta es la app de reservas de salas de estudio que venía haciendo en el TP 06 y 07. Ahora las reservas se guardan en MongoDB Atlas y no en un arreglo, así que **no se pierden cuando reinicio el servidor**. Además del sitio HTML le agregué una API JSON. Las dos cosas usan el mismo servicio, así que muestran los mismos documentos.

Hecho con Node.js, Express 5, EJS y Mongoose. Alumno: Renato G. Trentini.

---

## 1. De dónde salió este proyecto

- Arranqué copiando mi **TP 07 individual** (que andaba).
- No copié el historial de Git, ni `node_modules`, ni el `.env`.
- Mantuve las versiones, el `package.json` y el `package-lock.json`.
- La carpeta del proyecto se llama `tp-08-salas-http-mongodb`. En el `package.json` el nombre quedó como `tp-08-salas-MongoDb-Postman`.

## 2. Versiones

| Herramienta | Versión |
| --- | --- |
| Node.js | v22.16.0 |
| Postman (escritorio) | 12.33.1 |
| Express | ^5.2.1 |
| Mongoose | ^9.11.2 |
| EJS | ^6.0.1 |
| express-ejs-layouts | ^2.5.1 |
| morgan | ^1.12.1 |
| ESLint (dev) | ^10.12.0 |
| @eslint/js (dev) | ^10.0.1 |
| Prettier (dev) | ^3.9.10 |

Las versiones las saqué de mi `package.json`. Las exactas que se instalaron quedan en el `package-lock.json`. Uso **CommonJS** (`require` / `module.exports`).

## 3. Preparar Atlas

1. Cluster gratuito **M0** en MongoDB Atlas.
2. Usuario de base de datos con contraseña (solo para este TP).
3. En *Network Access* agregué mi IP para poder conectarme.
4. Base `reservas_salas_u8`, colección `reservas` (Mongoose crea la colección sola cuando se guarda el primer documento).
5. Copié la URI de conexión y la pegué en mi `.env`, que **no se entrega**.

## 4. Variables de entorno y DNS

El `.env` no está en el repositorio. Dejé una plantilla `.env.example`:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@HOST_DEL_CLUSTER/reservas_salas_u8?retryWrites=true&w=majority
```

- `USUARIO`, `CLAVE` y `HOST_DEL_CLUSTER` son marcadores: hay que cambiarlos por los datos de cada uno. El host del ejemplo no sirve para conectarse.
- Para armar el `.env` se copia `.env.example` y se completa.
- **DNS:** usé la corrección que vimos en clase. Está en `src/config/base-datos.js`: `dns.setServers(["8.8.8.8", "1.1.1.1"])`. Se ejecuta una sola vez al arrancar (cuando se carga el archivo), no en cada solicitud. Sirve para que Node pueda resolver la dirección `mongodb+srv` de Atlas.

## 5. Cómo iniciar

```bash
npm install
npm run start:local
```

`npm run start:local` corre `node --env-file=.env src/index.js`, o sea que carga el `.env`. El `npm start` corre `node src/index.js` **sin** `--env-file`, por eso para este TP uso `start:local`. Después se abre `http://localhost:3000`.

El arranque hace esto en orden:

1. Lee la configuración del entorno.
2. **Espera** a que conecte con MongoDB.
3. Recién ahí abre el puerto.

Si falta la URI o falla la conexión, muestra el error y **no abre el puerto**. El servidor mantiene la conexión mientras está prendido y no desconecta después de cada petición. Con Ctrl+C (`SIGINT`) o `SIGTERM` cierra primero el servidor y después la conexión.

## 6. Cómo está organizado

```text
src/
  config/        entorno y conexión a la base
  modelos/       esquema de Mongoose
  servicios/     serviceReserva.js (habla con MongoDB, es async)
  controladores/ controlReserva.js (recibe req y arma la respuesta)
  rutas/         rutasReserva.js (HTML) y reservas-api.js (API)
  middlewares/   validación, errores, id de solicitud
  app.js         arma Express (vistas, rutas, errores)
  index.js       arranque: entorno, conexión, listen y cierre
scripts/         programas de terminal (cierran al terminar)
views/ public/   vistas EJS y CSS
capturas/        imágenes que respaldan las pruebas (ver sección 12)
```

- El **modelo** no tiene rutas HTTP y el **servicio** no responde nada: solo devuelve datos o lanza errores.
- Hay un router para el HTML y otro para la API, pero los dos usan **el mismo servicio**.

Scripts de terminal (todos cargan el `.env`):

| Comando | Qué hace |
| --- | --- |
| `npm run comprobardb` | Comprueba la conexión a Atlas |
| `npm run validar` | Prueba la validación de una reserva |
| `npm run crear` | Crea una reserva |
| `npm run listar` | Lista las reservas |

## 7. Modelo de reserva

| Campo | Regla |
| --- | --- |
| estudiante | String obligatorio, trim |
| email | String obligatorio, trim, tiene que tener `@` |
| sala | String obligatorio: `Sala Norte`, `Sala Sur` o `Sala Multimedia` |
| fecha | String obligatorio, trim |
| turno | String obligatorio: `Mañana`, `Tarde` o `Noche` |
| personas | Number obligatorio, entero entre 1 y 6 |
| estado | `pendiente` (por defecto) o `confirmada` |

- El cliente **no** manda `estado` al crear: siempre queda `pendiente`.
- Al crear, el servicio copia **uno por uno** los seis campos permitidos. No le paso `req.body` entero a Mongoose, así que si mandan `estado` o `_id` de más, se ignoran.
- Se rechazan cuerpos ausentes, texto sin parser, `personas` como booleano, arreglo u objeto, y datos vacíos.
- Además del middleware, **el modelo también tiene sus validaciones**.

Ejemplo de respuesta (datos ficticios):

```json
{
  "id": "65f0c0ffee0123456789abcd",
  "estudiante": "Ana Ejemplo",
  "email": "ana@example.com",
  "sala": "Sala Norte",
  "fecha": "2026-10-21",
  "turno": "Mañana",
  "personas": 2,
  "estado": "pendiente"
}
```

El `id` es un texto que sale del `_id` (ObjectId) de Mongo. No le aplico `Number`.

## 8. Endpoints

### API (responde JSON)

| Método y dirección | Resultado |
| --- | --- |
| `GET /api/reservas` | 200 y un arreglo (`[]` si no hay datos) |
| `GET /api/reservas?sala=Sala%20Norte` | 200 y solo las de esa sala (si no hay, `[]`) |
| `GET /api/reservas/:id` | 200 y la reserva |
| `POST /api/reservas` | 201, la reserva guardada y la cabecera `Location` |
| ID mal formado (ej. `1`) | 400 JSON |
| ID bien formado que no existe | 404 JSON |
| Datos inválidos o JSON mal formado | 400 JSON, sin guardar nada |
| `sala` repetida (`?sala=a&sala=b`) | 400 |
| Ruta `/api/...` que no existe | 404 JSON |
| Fallo inesperado | 500 JSON, sin traza ni secretos |

- El filtro arma el criterio a mano (`{ sala: ... }`). No paso `req.query` completo y no se aceptan operadores de Mongo.
- **No hice** PUT, PATCH ni DELETE (no lo pide esta entrega).

### Sitio HTML

| Dirección | Qué hace |
| --- | --- |
| `GET /` | Inicio |
| `GET /reservas` | Listado (lee de MongoDB) |
| `GET /reservas/nueva` | Formulario |
| `POST /reservas` | Guarda y redirige (302). Si es inválido responde 400 y deja los valores en el formulario |
| `GET /reservas/:id` | Detalle |
| `GET /estado` | JSON con la cantidad de reservas, contada desde MongoDB |
| Cualquier otra | Página 404 |

## 9. Cómo probar en Postman

Uso Postman de escritorio 12.33.1, con el servidor iniciado (`npm run start:local`) y sin cerrarlo mientras pruebo. Uso el puerto 3000.

| # | Método y URL | Body | Respuesta esperada |
| --- | --- | --- | --- |
| 1 | `GET http://localhost:3000/api/reservas` | none | 200 y un arreglo |
| 2 | `POST http://localhost:3000/api/reservas` | raw, JSON (abajo) | 201, `id`, `estado: "pendiente"` y `Location` en los Headers de la respuesta |
| 3 | `GET http://localhost:3000/api/reservas/ID_RECIBIDO` | none | 200 y la misma reserva |
| 4 | `GET http://localhost:3000/api/reservas/1` | none | 400 |
| 5 | `GET http://localhost:3000/api/reservas/000000000000000000000000` | none | 404 |
| 6 | `GET .../api/reservas` con Params `sala` = `Sala Norte` | none | 200, solo esa sala |
| 7 | Igual, con una sala que no existe | none | 200 y `[]` |
| 8 | Dos filas `sala` con valores distintos | none | 400 |

Body del POST (Body > raw > JSON; el header `Content-Type: application/json` lo pone Postman solo):

```json
{
  "estudiante": "Ana Ejemplo",
  "email": "ana@example.com",
  "sala": "Sala Norte",
  "fecha": "2026-10-21",
  "turno": "Mañana",
  "personas": 2
}
```

Cosas que tuve en cuenta:

- El POST válido lo mando **una sola vez**, porque cada envío crea una reserva nueva.
- Para los casos inválidos duplico el POST y cambio **un dato por vez**, y después miro con un GET sin filtros si cambió la cantidad.
- Para el cuerpo ausente pongo Body en `none`. Para el JSON mal formado mando uno sin cerrar, con `Content-Type: application/json`.
- Para los campos extra mando `estado: "confirmada"` y `_id` junto con los seis datos válidos. Ese POST **sí** crea una reserva.

## 10. Matriz de resultados

Todo lo que pongo en "Observado" lo vi yo en Postman o en el navegador. Cuando algo falló la primera vez, lo dejé escrito y también cómo lo arreglé (ver sección 11).

| Caso | Esperado | Observado | Cantidad |
| --- | --- | --- | --- |
| Listado inicial | 200 y arreglo (`[]` si la base es nueva) | 200 con 1 reserva (Ana Ejemplo). La base no era nueva, así que el caso de `[]` **no lo pude probar** y no borré la colección para forzarlo | Inicial: 1 |
| Creación válida | 201 y Location | Primer intento (Beto): 201 pero **sin Location**. Lo arreglé. Segundo intento (Carla): 201, `estado: "pendiente"` y Location `http://localhost:3000/api/reservas/6ad896fac93562943e87940a`. Como repetí el POST, quedaron dos reservas iguales de Carla | 4 en total (Ana, Beto y 2 de Carla) |
| Consulta por ID creado | 200, mismo recurso | Primero devolvía HTML. Lo arreglé. Ahora con el ID de Carla: **200 en JSON** con los mismos datos | - |
| Consulta tras reiniciar | 200, mismo ID | Cerré con Ctrl+C, arranqué de nuevo y sin hacer otro POST el GET a `/api/reservas/6ad896fac93562943e87940a` dio 200 con los mismos datos (captura: `capturas/captura_postman_carla.png`) | 7 |
| ID `1` | 400 | 400 en JSON: `{"error": "El identificador debe tener 24 caracteres hexadecimales.", "campos": []}` | - |
| ID válido que no existe | 404 | Primero daba 404 pero en HTML. Lo arreglé. Ahora **404 en JSON** | - |
| Estudiante vacío | 400, sin guardar | 400 en JSON: `{"error": "Datos inválidos. Verificá estudiante, email, sala (Norte/Sur/Multimedia), turno (Mañana/Tarde/Noche) y personas (1 a 6)."}` | 4 antes y 4 después (miré una vez, al terminar los cinco casos) |
| Email sin `@` | 400, sin guardar | 400, mismo mensaje | igual |
| Sala no permitida (`Sala Oeste`) | 400, sin guardar | 400, mismo mensaje | igual |
| Turno no permitido (`Madrugada`) | 400, sin guardar | 400, mismo mensaje | igual |
| Fecha vacía | 400 | 400, mismo mensaje | igual |
| Personas 0, 7, 2.5 y "abc" | 400 | Los cuatro dieron 400 con el mismo mensaje | No la miré tras cada caso |
| Personas `true`, `[2]` y objeto | 400 | Con `true` y `[2]` pasó algo malo: respondió **201** y guardó reservas con `personas: 1` (id `...e87940b`) y `personas: 2` (id `...e87940c`). El objeto sí dio 400. Lo arreglé y volví a probar: ahora `true` y `[2]` dan **400** | 4 → 6 por el error (esas dos quedaron en la base). Después del arreglo: se mantuvo en 7 |
| POST sin cuerpo | 400 JSON | 400 en JSON con el mensaje de datos inválidos | 6 antes de este caso y del de campos extra, 7 al terminar los dos |
| JSON mal formado | 400 JSON | 400 en JSON: `{"error": "Revisá los datos enviados.", "campos": []}` | no aumentó |
| Campos extra `estado` y `_id` | No los toma del cliente | 201. Mandé `estado: "confirmada"` y un `_id` inventado y los ignoró: creó la reserva con id propio `6ad89f98c93562943e87940d` y `estado: "pendiente"`. Esta es una creación válida | 6 → 7 |
| Filtro exacto por sala | Solo las de esa sala | Consulté `Sala Norte`: 200 con 1 resultado (Ana), de esa sala | - |
| Filtro sin coincidencias | 200 y `[]` | Consulté `Sala Inexistente`: 200 y `[]` | - |
| Sala repetida | 400 | Primero respondía 200 con 2 resultados. Lo arreglé. Ahora con `Sala Norte` y `Sala Sur` da **400** | - |
| Listar varias veces | La cantidad no cambia | Hice 3 GET seguidos sin filtros: los tres dieron 200 con 7 reservas | 7, 7 y 7 |
| Formulario válido | 302 | En la terminal: `POST /reservas 302`, seguido de `GET /reservas 200` (me lleva al listado). Quedaron 8 reservas | 7 → 8 |
| Formulario inválido | 400 y conserva valores | Con el estudiante vacío aparece el aviso con el mensaje y los demás campos siguen completos (captura: `capturas/reserva_invalida_formulario.png`). En la terminal: `POST /reservas 400` | 8 antes y 8 después |
| `/estado` y sitio | Conteo persistente | `/reservas` listó las reservas después de reiniciar, y el detalle abre bien. `/estado` primero no mostraba la cantidad, lo arreglé y ahora responde `{"cantidad": 7, "id": "SOL-0001"}` | 7 |
| Arranque sin URI | No abre el puerto | Corrí `npm start` (que no carga el `.env`): mostró "No se pudo iniciar la aplicación" y `Falta MONGODB_URI en el entorno.`. No dijo "Aplicación disponible" y el programa terminó | - |

**Fallo inesperado (500):** lo probé con una simulación en mi compu, sin tocar la base ni el clúster. Puse temporalmente un `throw new Error("Fallo simulado para probar el 500")` como primera línea de `listar()` en `serviceReserva.js`.

- `GET /api/reservas`: dio **500** con `{"error": "Error interno al obtener las reservas."}`, sin traza ni datos de conexión.
- `GET /reservas` en el navegador: se mostró la vista de error (`no-encontrado.ejs`) sin trazas. No anoté el código de estado exacto de esa página.
- Después borré la línea, reinicié y comprobé que la API volvía a dar 200 con las 8 reservas y que `/reservas` las mostraba.

(El `GET /favicon.ico 404` que sale en la terminal lo pide el navegador solo, no tiene que ver con la prueba.)

## 11. Cosas que fallaron al probar y cómo las arreglé

| Qué pasaba | Por qué | Cómo lo arreglé |
| --- | --- | --- |
| El POST no devolvía `Location` | El controlador solo hacía `res.status(201).json(...)` | Agregué `.location(...)` con `req.baseUrl` y el id de la reserva nueva |
| `GET /api/reservas/:id` devolvía una página HTML | `obtenerApi` apuntaba a `mostrarDetalle`, que renderiza la vista | Hice una función `obtenerApi` aparte que responde JSON (200 o 404) |
| `personas: true` y `[2]` se guardaban | Convertía con `Number(...)`, y `Number(true)` es 1 y `Number([2])` es 2. Mongoose también los convierte | Ahora solo convierte si `personas` es número o texto no vacío |
| `sala` repetida devolvía 200 | Pasaba `req.query.sala` tal cual y el arreglo se tomaba como "cualquiera de estas salas" | `listarApi` responde 400 si `sala` no es un único texto |
| `/estado` no mostraba `cantidad` | Usaba `listar().length`, pero `listar()` ahora devuelve una promesa | La ruta pasó a ser `async` y espera `listar()` |
| El formulario `/reservas/nueva` daba error 500 | La vista recorre `salas` y `turnos` y el controlador no se los pasaba | El controlador recibe `salasPermitidas` y `turnosPermitidos` y se los pasa a la vista |
| El formulario inválido no mostraba bien el error | La vista hace `errores.forEach`, pero el middleware mandaba un texto | Ahora manda `errores` como arreglo, y también `salas` y `turnos` |

## 12. Prueba de reinicio (que los datos no se pierdan)

1. GET sin filtros: 200 y 1 reserva al principio (Ana, id `6ad768bffe4656963c3da2b4`, que ya estaba en la base).
2. POST de una reserva: Carla Prueba, id `6ad896fac93562943e87940a`, Location `http://localhost:3000/api/reservas/6ad896fac93562943e87940a`.
3. GET a esa dirección: mismos datos y `estado: "pendiente"`.
4. Cerré el servidor (Ctrl+C) y lo arranqué de nuevo con la misma base.
5. GET con el **mismo id**: la encontré, sin hacer otro POST. También la vi en el sitio.
6. Listé tres veces seguidas: 200 y 7 reservas en cada una.
7. Abrí MongoDB Compass, conectado a la misma base de Atlas (`reservas_salas_u8` / `reservas`): estaban las 7 reservas y el `_id` de Carla coincide con el de Postman (captura: `capturas/captura_mongodb_carla.png`).

### Evidencias

Las capturas están en la carpeta `capturas/` del proyecto. Son recortadas, con datos ficticios y sin credenciales.

**1. Postman: consulta de Carla después de reiniciar el servidor.** `GET http://localhost:3000/api/reservas/6ad896fac93562943e87940a`, Body en none, 200 OK y el JSON con `estado: "pendiente"`.

![GET de la reserva de Carla en Postman](capturas/captura_postman_carla.png)

**2. MongoDB Compass: la misma reserva en la base.** Base `reservas_salas_u8`, colección `reservas`, con 7 documentos en ese momento. El `_id` es el mismo que el de Postman.

![Reserva de Carla en MongoDB Compass](capturas/captura_mongodb_carla.png)

**3. Formulario inválido.** Dejé el estudiante vacío: aparece el mensaje de error y los demás campos conservan lo que escribí.

![Formulario con estudiante vacío](capturas/reserva_invalida_formulario.png)

El resto de los resultados es lo que fui viendo en Postman, en el navegador y en la terminal, y están anotados en la matriz de la sección 10.

## 13. Qué dejé de importar del servicio en memoria

- El arranque ya **no** usa el servicio en memoria ni carga la semilla del JSON.
- `index.js` ahora crea solamente `crearServicioReservasMongo`.
- El arreglo `reservas` con las cuatro semillas sigue escrito en `index.js`, pero solo como referencia: no lo uso para responder nada. La única fuente de reservas que está activa es MongoDB.
- No se inserta ni se borra nada al iniciar ni al listar.

## 14. Lo que no valida mi app

- Que el email esté completo y sea real (solo pide que tenga `@`).
- Que la fecha sea real o futura (es solo texto obligatorio).
- Solapamientos de horario, cupos compartidos ni reservas duplicadas (no hay índice único). Por eso en la base hay reservas repetidas de Carla.
- Autenticación ni permisos: que `estado` sea `pendiente` por defecto no es seguridad.
- No hay migración de documentos viejos.


## 15. Comparación con el TP 07

| | TP 07 | TP 08 |
| --- | --- | --- |
| Datos de la app web | Arreglo en memoria cargado desde un JSON (la semilla). Si cerraba Node, desaparecían las reservas nuevas y al arrancar solo leía la semilla | MongoDB Atlas, base `reservas_salas_u8`. Los datos siguen al reiniciar |
| MongoDB | Solo lo usaban los scripts de terminal (base `reservas_salas_u7`). Web y base estaban separadas | Lo usan el sitio y la API, a través del mismo servicio |
| Servicio | Trabajaba con el arreglo en memoria | Servicio asíncrono sobre MongoDB (devuelve promesas) |
| Interfaz | Sitio HTML y una ruta `/api/reservas` para consultar | Sitio HTML y API JSON (listado, consulta por ID y creación) |
| Campos | Seis | Seis más `estado` |
| Validación | Estaba en el modelo y se probaba desde los scripts. Me quedaron pendientes los casos inválidos (estudiante vacío, email, sala, turno, fecha y personas) | Validación en el middleware y en el modelo, con todos esos casos probados en Postman |
| Arranque | `npm start` | `npm run start:local`, y espera la conexión antes de abrir el puerto, con cierre ordenado |

## 16. Calidad

- `npm run format` (Prettier) y `npm run check` (que corre `format:check` y `lint` con ESLint) sobre `src` y `scripts`. Prettier dijo que todo tiene el estilo correcto y ESLint no mostró errores. También `npm run comprobardb` respondió que la conexión con MongoDB se estableció.

