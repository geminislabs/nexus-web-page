# Módulo: Dashboard

## 📌 Descripción
Vista principal del usuario autenticado.
Muestra mapa interactivo con posiciones en tiempo real de todas las unidades asignadas, con actualizaciones vía WebSocket.

---

## 👤 Actor
- Usuario autenticado
- Rol: user / master

---

## 🔌 APIs Consumidas

### 🔹 siscom-admin-api (Administrativo)

| Endpoint | Método | Uso |
|--------|--------|-----|
| `/api/v1/users/me` | GET | Obtener datos del usuario actual |
| `/api/v1/devices/my-devices` | GET | Listar dispositivos del cliente |
| `/api/v1/units` | GET | Listar unidades del cliente |
| `/api/v1/units/{unit_id}/profile` | GET | Obtener perfil de unidad (color, icono) |

---

### 🔹 siscom-api (Comunicaciones GPS)

| Endpoint | Método | Uso |
|--------|--------|-----|
| `/api/v1/communications/latest` | GET | Últimas comunicaciones por device_ids |
| `/api/v1/devices/{device_id}/communications/latest` | GET | Última comunicación de un dispositivo |
| `/api/v1/stream` | WebSocket | Stream de posiciones en tiempo real |

---

### 🔹 Google Maps API (Visualización)

| Recurso | Uso |
|---------|-----|
| Google Maps JavaScript API | Renderizado del mapa base |
| Markers API | Marcadores de vehículos con iconos SVG personalizados |
| InfoWindow API | Ventanas de información al hacer clic en marcadores |

---

## 🔁 Flujo funcional

1. Dashboard carga → Inicializa autenticación
2. Obtiene `/api/v1/users/me` para validar sesión
3. Carga dispositivos con `/api/v1/devices/my-devices`
4. Carga unidades con `/api/v1/units`
5. Obtiene últimas comunicaciones con `/api/v1/communications/latest`
6. Combina datos: devices + units + communications
7. Inicializa Google Maps con `@jesusCabrera84/map-engine`
8. Renderiza marcadores en el mapa
9. Abre WebSocket `/api/v1/stream?device_ids={ids}`
10. Actualiza marcadores en tiempo real con datos del stream
11. Carga perfiles de unidades en segundo plano (color, icono)

---

## ⚠️ Consideraciones
- Depende de token JWT válido (auto-refresh implementado)
- WebSocket se reconecta automáticamente con backoff exponencial (máx 5 intentos)
- Cache de posiciones con timeout de 30 segundos
- Los marcadores usan iconos SVG personalizados con colores configurables
- Animación de movimiento en tiempo real con `LiveMotion` del map-engine

---

## 🧭 Relación C4 (preview)

- **Container:** Web App (SvelteKit)
- **Component:** Dashboard Module
- **Consumes:** 
  - siscom-admin-api (REST)
  - siscom-api (REST + WebSocket)
  - Google Maps API (JavaScript SDK)
- **Dependencies:**
  - `mapService.js` → Google Maps Engine wrapper
  - `positionService.js` → SISCOM-API client
  - `apiService.js` → SISCOM-ADMIN-API client
  - `vehicleStore.js` → State management
  - `auth.js` → Authentication store
