# Módulo: Login

## 📌 Descripción

Página de autenticación de usuarios.
Permite a usuarios existentes iniciar sesión con email y contraseña.

---

## 👤 Actor

- Usuario no autenticado
- Cualquier persona con cuenta en el sistema

---

## 🔌 APIs Consumidas

### 🔹 siscom-admin-api (Autenticación)

| Endpoint             | Método | Uso                                   |
| -------------------- | ------ | ------------------------------------- |
| `/api/v1/auth/login` | POST   | Autenticar usuario con email/password |

**Request Body:**

```json
{
	"email": "string",
	"password": "string"
}
```

**Response:**

```json
{
  "user": {
    "id": "string",
    "email": "string",
    "full_name": "string",
    "email_verified": boolean,
    "role": "user|master"
  },
  "access_token": "string",
  "refresh_token": "string",
  "id_token": "string",
  "expires_in": number
}
```

---

## 🌐 Recursos Externos

| Recurso                            | Uso                                                                   |
| ---------------------------------- | --------------------------------------------------------------------- |
| `VITE_COMPANY_URL`                 | URL de la página principal para registro y recuperación de contraseña |
| `/vid/map-back-1.mp4`              | Video de fondo animado                                                |
| `/img/logo-nexus.png`              | Logo de Nexus                                                         |
| `/img/geminis-labs-logo-short.png` | Logo de Geminis Labs (footer)                                         |

---

## 🔁 Flujo funcional

1. Usuario accede a `/login`
2. Si ya está autenticado → Redirige a `/dashboard`
3. Usuario ingresa email y contraseña
4. Submit → POST `/api/v1/auth/login`
5. API valida credenciales
6. Si email no verificado → Muestra error
7. Si credenciales válidas:
   - Guarda tokens en `localStorage` (access, refresh, id)
   - Guarda datos de usuario en store
   - Redirige a `/dashboard`
8. Si error → Muestra mensaje según código HTTP:
   - 401: Credenciales inválidas
   - 403: Email no verificado
   - 400: Formato inválido

---

## ⚠️ Consideraciones

- No requiere autenticación previa
- Valida formato de email en el frontend
- Almacena tokens en `localStorage` para persistencia
- Redirige automáticamente si ya hay sesión activa
- Enlaces externos para registro y recuperación de contraseña apuntan a `VITE_COMPANY_URL`

---

## 🧭 Relación C4 (preview)

- **Container:** Web App (SvelteKit)
- **Component:** Login Module
- **Consumes:**
  - siscom-admin-api (REST)
- **Dependencies:**
  - `apiService.js` → SISCOM-ADMIN-API client
  - `auth.js` → Authentication store (user, authToken)
