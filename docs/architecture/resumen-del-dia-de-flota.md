# Resumen del día de la flota: plan de backend

**Fecha:** 26/11/2026 · **Estado:** propuesta, sin implementar en el backend
**Contexto:** rediseño del seguimiento en escritorio (`feature/rediseno-seguimiento`)

Los paneles nuevos del seguimiento son tres: **Utilización de la flota**, **Kilómetros hoy** y
**Actividad de hoy**. Hoy se arman en el navegador con endpoints que ya existen. Este documento
explica qué se pide hoy, dónde deja de escalar y qué haría falta en el backend para que
siga funcionando bien con flotas grandes y con datos al minuto.

---

## 0. Las dos vistas del seguimiento

Los paneles viven en la **vista Panel**, que convive en producción con la **vista Clásica**
para validarla con usuarios y desarrolladores antes de decidir cuál queda.

- **Clásica** (por defecto): la de siempre, sin cambios visuales ni de distribución.
- **Panel**: columna de flota, columna de alertas y franja del día, con mapa y controles
  neutros. Cada panel se enciende y apaga desde el botón «Paneles» del riel. Si con lo
  encendido no cabe la franja, se pliega a una línea en lugar de desaparecer.
- Se elige en el menú del avatar («Vista del seguimiento»). La preferencia se guarda en el
  navegador (`nexus.seguimiento.vista`); guardarla por usuario necesitaría backend.
- Solo en escritorio (≥ 768 px). En móvil siempre se ve la Clásica.
- Los datos del día solo se piden con la vista Panel y algún panel que los pinte encendido.

Código: `src/lib/stores/trackingViewStore.js`, `src/lib/components/tracking/`.

## 1. Qué hace hoy el frontend (sin tocar el backend)

Código: `src/lib/services/fleetDayService.js` y `src/lib/stores/fleetDayStore.js`.

| Dato                           | Endpoint (admin-api v1.69.0)                                                    | Peticiones por refresco      |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------- |
| Km por hora, utilización       | `POST /telemetry/query` (`hour`, `odometer`, `moving_minutes`, `idle_minutes`)  | ⌈N / 50⌉                     |
| Tramos en ruta por unidad      | `GET /trips?start_date&end_date&limit=500` (sin `unit_id`, con cursor)          | ⌈trayectos / 500⌉ (tope 10)  |
| Marcas de alarma               | `GET /alerts` del día, que el dashboard **ya** carga                            | 0 extra                      |
| Mini-recorrido de cada tarjeta | Posiciones del stream desde que se abrió el panel (en memoria)                  | 0 extra                      |
| Encendidos y apagados          | `GET /api/v1/events` de siscom-api (lotes de 100 unidades, `limit=200`, cursor) | ⌈N / 100⌉ × páginas (tope 5) |

- Se refresca cada **5 min** y solo con la pestaña visible. Al volver a la pestaña, se refresca
  si los datos tienen más de 5 min. Nunca hay dos refrescos en vuelo.
- Solo se pide en la vista Panel, en escritorio, con «Flota» u «Hoy» encendidos.
- Con 13 unidades son **2 peticiones** por refresco. Con 500 unidades y ~3 000 trayectos al día
  serían 10 + 6 = **16**.

Los encendidos y apagados salen de los eventos del dispositivo, que llegan siempre. Las alarmas
de ignición del cliente solo existen si tiene una regla, así que con eventos se descartan. El
endpoint no filtra por `event_type` y devuelve todos los eventos del día para quedarse con dos
tipos. **Propuesta para siscom-api:** aceptar `event_type=ignition_on&event_type=ignition_off`,
así basta una página por lote.

`telemetry_hourly_stats` lo escribe `telemetry-consolidator` con un _upsert_ cada ~30 s
(`FLUSH_INTERVAL_SECS`), así que la hora en curso va casi al día. El retraso real lo pone el
refresco de 5 min del cliente, no el dato.

## 2. Dónde deja de escalar o falla

1. **Cada cliente repite la misma agregación.** Diez personas de la misma organización con
   el panel abierto hacen diez veces las mismas consultas cada 5 min.
2. **Los trayectos no traen `unit_id` ni `device_ref`** (`TripOut` solo tiene `device_id`, el
   IMEI). El cliente los cruza con `unit.deviceId`. Cuando `/units` deje de exponer el IMEI
   (la migración a referencias opacas lo pide), «Actividad de hoy» se queda vacía sin error.
3. **Trayectos que empezaron ayer y siguen hoy.** Con `start_date` el filtro es por
   `start_time ≥ medianoche`. Un trayecto que cruzó la medianoche no aparece. Con `day=` se
   filtra por `end_time` y tampoco salen los trayectos en curso.
4. **Paginación lineal.** Más de 5 000 trayectos en un día se recortan; la UI lo avisa.
5. **Datos a 5 min.** Aceptable para kilómetros; corto para «Actividad», donde un trayecto
   que empieza tarda hasta 5 min en verse.
6. **El mini-recorrido solo cubre lo recibido desde que se abrió el panel.** El recorrido
   completo del día necesitaría pedir los puntos de cada trayecto (`/trips/{id}?include_points`),
   una petición por trayecto: inviable. En la UI está marcado como «en construcción».

## 3. Propuesta

### 3.1 `GET /api/v1/fleet/day-summary` (nuevo, admin-api)

Una sola llamada con todo el día de la flota visible para el usuario.

```
GET /api/v1/fleet/day-summary?from=2026-11-26T06:00:00Z&to=2026-11-26T20:20:00Z&tz=America/Mexico_City
If-None-Match: "c3f1…"
```

Respuesta (la misma forma que ya arma el cliente, para que el cambio en el front sea un flag):

```json
{
	"telemetry": {
		"kmByHour": [0, 0, 0, 0, 0, 0, 18.4, 46.2, null],
		"kmTotal": 412.6,
		"kmByUnit": { "<unit_id>": 96.4 },
		"currentHour": 14,
		"movingMinutes": 2903,
		"idleMinutes": 1518,
		"utilization": 65.7,
		"utilizationByHour": [null, null, 52.1]
	},
	"activity": {
		"nowHour": 14.33,
		"rows": [
			{
				"unitId": "<unit_id>",
				"name": "Reparto 04",
				"segments": [{ "start": 7.0, "end": 9.0, "ongoing": false, "km": 30.1 }],
				"marks": [{ "at": 12.0, "type": "zone", "label": "Salida de zona" }],
				"movingHours": 3.3
			}
		]
	},
	"tripsTruncated": false,
	"updatedAt": "2026-11-26T20:20:00Z"
}
```

- **Fuentes:** `telemetry_hourly_stats` (sumas por `bucket`), `trips` (solapamiento con el
  día: `start_time < to AND (end_time IS NULL OR end_time > from)`) y los eventos de alarma
  del día. Mismo filtro de visibilidad que `/trips` y `/telemetry`.
- **Costo:** con el índice `(device_id, bucket)`, 1 000 dispositivos × 24 filas es una consulta
  barata. No hace falta una tabla nueva al principio; se mide el p95 y, si pasa de ~300 ms,
  se agrega un rollup por organización y día.
- **ETag** calculado con `max(bucket actualizado)`, la última modificación de `trips` (o su equivalente) y
  `max(alerts.created_at)`. Con `If-None-Match`, lo normal es un **304 sin cuerpo**.
- **Caché del servidor por organización** de 15–30 s: diez pestañas de la misma organización
  cuestan una consulta, no diez.
- **Límites:** máximo 2 días por petición; `tz` en formato IANA.

Con esto el cliente baja a **1 petición por refresco sin importar el tamaño de la flota**, y
puede refrescar cada 60 s porque casi todas las respuestas serán 304.

### 3.2 Arreglos chicos en `/trips` (sirven con o sin el endpoint nuevo)

- Agregar `unit_id` y `device_ref` a `TripOut`. Arregla el punto 2 de §2.
- Parámetro `overlaps=true` para filtrar por solapamiento con el rango en lugar de por
  `start_time`. Arregla el punto 3.

### 3.3 Tiempo real: eventos por el stream que ya existe

Para que «Actividad de hoy» no espere al refresco, el stream de siscom-api
(`/api/v1/stream`, que el panel ya tiene abierto para las posiciones) puede emitir eventos de
dominio además de posiciones:

| Evento         | Datos                                  | Efecto en el panel                       |
| -------------- | -------------------------------------- | ---------------------------------------- |
| `trip_started` | `unit_id`, `trip_id`, `start_time`     | Abre un tramo «en curso»                 |
| `trip_ended`   | `unit_id`, `trip_id`, `end_time`, `km` | Cierra el tramo y suma km                |
| `alarm`        | `unit_id`, `type`, `at`, `message`     | Marca en la línea de tiempo y en Alertas |

El resumen por HTTP con ETag sigue siendo la fuente de verdad, y se pide al abrir y cada pocos
minutos para corregir cualquier evento perdido. Los eventos solo adelantan lo que el
siguiente resumen ya traería. **No hace falta un socket nuevo** ni SSE: se reutiliza la
conexión que ya está abierta, con el mismo data token.

Se descarta poner el resumen entero en el socket: obligaría a recalcularlo por cada mensaje de
posición y a mandarlo a cada cliente, aunque nada visible haya cambiado.

### 3.4 Recorrido reciente para las tarjetas (en construcción en la UI)

`GET /api/v1/fleet/recent-tracks?minutes=30&max_points=30`: los últimos N minutos de cada
unidad visible, ya simplificados en el servidor (Douglas-Peucker o 1 punto por minuto). Una
petición al abrir el panel; después el stream mantiene el recorrido al día como hoy.

## 4. Cómo se enciende en el frontend

- `VITE_FLEET_DAY_SUMMARY=true` hace que el panel pida `GET /fleet/day-summary` en lugar de
  armar el día con telemetría y trayectos (`isFleetDaySummaryEndpointEnabled`).
- Si el backend responde **404 o 501**, los paneles muestran «En construcción» en vez de un
  error (`EnConstruccionError`). Se puede encender en un entorno antes de que exista el
  endpoint sin romper nada.
- Al implementar §3.1, bajar `FLEET_DAY_REFRESH_MS` a 60 s y mandar `If-None-Match`.

## 5. Orden sugerido

1. §3.2 en admin-api (chico, sin migración de datos; `unit_id` sale del join con `unit_devices`).
2. §3.1 con ETag y caché por organización; encender el flag en el panel.
3. §3.3 en siscom-api y en el consumidor que detecta trayectos.
4. §3.4 cuando se quiera quitar el «en construcción» de las tarjetas.

## 6. Móviles (solo registro, no implementar ahora)

iOS y Android no tienen estos paneles. Si se agregan, deben consumir §3.1 directamente, no
replicar la agregación del cliente web.
