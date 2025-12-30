# Módulo: Share Location

## 📌 Descripción
Vista pública para compartir ubicación de una unidad.
Permite a usuarios externos (sin autenticación) ver la ubicación en tiempo real de una unidad mediante un token temporal.

---

## 👤 Actor
- Usuario externo (no autenticado)
- Cualquier persona con un enlace de compartición válido

---

## 🔌 APIs Consumidas

### 🔹 siscom-api (Público - Sin autenticación)

| Endpoint | Método | Uso |
|--------|--------|-----|
| `/api/v1/public/share-location/init` | GET | Inicializar vista compartida con token |
| `/api/v1/public/share-location/stream` | WebSocket | Stream de ubicación en tiempo real |

**Init Request:**
```
GET /api/v1/public/share-location/init?token={share_token}
```

**Init Response:**
```json
{
  "device_id": "string",
  "name": "string",
  "alias": "string",
  "icon_type": "string",
  "expires_at": "ISO8601",
  "last_communication": {
    "latitude": number,
    "longitude": number,
    "speed": number,
    "course": number,
    "gps_datetime": "ISO8601",
    "engine_status": "string",
    "fix_status": "string",
    "satellites": number
  }
}
```

**WebSocket Events:**
- `message`: Nueva posición
- `expired`: Token expirado
- `ping`: Keep-alive

---

### 🔹 Google Maps API (Visualización)

| Recurso | Uso |
|---------|-----|
| Google Maps JavaScript API | Renderizado del mapa base |
| Markers API | Marcador de la unidad compartida |
| InfoWindow API | Información de la unidad |

---

## 🔁 Flujo funcional

1. Usuario accede a `/share/{token}`
2. Extrae token de la URL
3. Llama a `/api/v1/public/share-location/init?token={token}`
4. Si token inválido/expirado → Muestra error
5. Si token válido:
   - Obtiene datos de la unidad y última posición
   - Inicializa Google Maps
   - Renderiza marcador en la posición inicial
   - Abre WebSocket `/api/v1/public/share-location/stream?token={token}`
6. Actualiza posición en tiempo real con eventos del WebSocket
7. Si recibe evento `expired` → Cierra stream y muestra error

---

## ⚠️ Consideraciones
- **No requiere autenticación** (endpoints públicos)
- Token tiene fecha de expiración configurable
- WebSocket se cierra automáticamente si el token expira
- Solo muestra una unidad a la vez
- No permite acceso a funciones administrativas
- Ideal para compartir ubicación con clientes o terceros

---

## 🧭 Relación C4 (preview)

- **Container:** Web App (SvelteKit)
- **Component:** Share Location Module (Public)
- **Consumes:** 
  - siscom-api (REST + WebSocket - Endpoints públicos)
  - Google Maps API (JavaScript SDK)
- **Dependencies:**
  - `positionService.js` → SISCOM-API client (public methods)
  - `mapService.js` → Google Maps Engine wrapper
  - `vehicleStore.js` → State management (temporal)
