# Módulo: Admin Panel

## 📌 Descripción
Panel administrativo para gestión de usuarios, unidades y dispositivos.
Accesible desde el Dashboard mediante componentes de administración (Sidebar, AdminPanel, UserPanel, VehiclePanel, etc.).

---

## 👤 Actor
- Usuario autenticado
- Rol: master (funciones completas) / user (funciones limitadas)

---

## 🔌 APIs Consumidas

### 🔹 siscom-admin-api (Administrativo)

#### Gestión de Usuarios

| Endpoint | Método | Uso | Rol |
|--------|--------|-----|-----|
| `/api/v1/users` | GET | Listar usuarios del cliente | master |
| `/api/v1/users/invite` | POST | Invitar nuevo usuario | master |
| `/api/v1/users/resend-invitation` | POST | Reenviar invitación | master |
| `/api/v1/auth/password` | PATCH | Cambiar contraseña propia | user/master |

#### Gestión de Unidades

| Endpoint | Método | Uso | Rol |
|--------|--------|-----|-----|
| `/api/v1/units` | GET | Listar unidades | user/master |
| `/api/v1/units` | POST | Crear nueva unidad | master |
| `/api/v1/units/{unit_id}` | PATCH | Actualizar unidad | master |
| `/api/v1/units/{unit_id}` | DELETE | Eliminar unidad | master |
| `/api/v1/units/{unit_id}/profile` | GET | Obtener perfil de unidad | user/master |
| `/api/v1/units/{unit_id}/profile` | PATCH | Actualizar perfil (color, icono) | master |
| `/api/v1/units/{unit_id}/share-location` | POST | Generar token de compartición | master |

#### Gestión de Dispositivos

| Endpoint | Método | Uso | Rol |
|--------|--------|-----|-----|
| `/api/v1/devices/my-devices` | GET | Listar dispositivos del cliente | user/master |
| `/api/v1/devices/unassigned` | GET | Dispositivos sin asignar | master |
| `/api/v1/units/{unit_id}/device` | POST | Asignar dispositivo a unidad | master |
| `/api/v1/user-units/{assignment_id}` | DELETE | Desasignar dispositivo | master |

#### Gestión de Trips (Trayectos)

| Endpoint | Método | Uso | Rol |
|--------|--------|-----|-----|
| `/api/v1/trips` | GET | Listar trips (con filtros) | user/master |
| `/api/v1/trips/{trip_id}` | GET | Detalles de trip (puntos, alertas) | user/master |

#### Cliente

| Endpoint | Método | Uso | Rol |
|--------|--------|-----|-----|
| `/api/v1/clients` | GET | Datos del cliente actual | user/master |

---

## 🔁 Flujo funcional

### Gestión de Usuarios (Master)
1. Abre AdminPanel desde Sidebar
2. Carga lista de usuarios con `/api/v1/users`
3. Puede invitar nuevo usuario con `/api/v1/users/invite`
4. Puede reenviar invitación con `/api/v1/users/resend-invitation`

### Gestión de Unidades (Master)
1. Abre VehiclePanel desde Sidebar
2. Carga unidades con `/api/v1/units`
3. Puede crear unidad con `/api/v1/units` (POST)
4. Puede editar unidad con `/api/v1/units/{unit_id}` (PATCH)
5. Puede actualizar perfil (color, icono) con `/api/v1/units/{unit_id}/profile` (PATCH)
6. Puede eliminar unidad con `/api/v1/units/{unit_id}` (DELETE)
7. Puede generar enlace de compartición con `/api/v1/units/{unit_id}/share-location`

### Asignación de Dispositivos (Master)
1. Abre AssignUnits component
2. Carga dispositivos sin asignar con `/api/v1/devices/unassigned`
3. Asigna dispositivo a unidad con `/api/v1/units/{unit_id}/device`
4. Puede desasignar con `/api/v1/user-units/{assignment_id}` (DELETE)

### Visualización de Trips (User/Master)
1. Selecciona unidad en el mapa
2. Abre panel de trips
3. Carga lista de trips con `/api/v1/trips?unit_id={id}&day={date}`
4. Selecciona trip específico
5. Carga detalles con `/api/v1/trips/{trip_id}?include_points=true&include_alerts=true`
6. Renderiza trayecto en el mapa con animación

---

## ⚠️ Consideraciones
- Funciones administrativas requieren rol **master**
- Usuarios con rol **user** solo pueden ver y consultar
- Todas las operaciones requieren token JWT válido
- Los perfiles de unidades incluyen configuración visual (color, icono)
- Los enlaces de compartición tienen expiración configurable
- La eliminación de unidades es soft-delete (recuperable por master)

---

## 🧭 Relación C4 (preview)

- **Container:** Web App (SvelteKit)
- **Component:** Admin Panel Module
- **Consumes:** 
  - siscom-admin-api (REST - CRUD completo)
- **Dependencies:**
  - `apiService.js` → SISCOM-ADMIN-API client
  - `auth.js` → Authentication store (validación de rol)
  - `vehicleStore.js` → State management
  - Componentes: AdminPanel, UserPanel, VehiclePanel, AssignUnits, InviteUser, OptionPanel
