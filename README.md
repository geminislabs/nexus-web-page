# Tracker Monitor App

Una aplicación SvelteKit con autenticación y Google Maps que permite a los usuarios hacer login y ver un mapa que cubre toda la pantalla.

## Características

- Autenticación completa (login/registro)
- Gestión de sesiones con localStorage
- Google Maps integrado a pantalla completa
- Rutas protegidas
- Interfaz moderna con Tailwind CSS
- Integración lista para APIs de FastAPI

## Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita el archivo `.env`:

```env
# ===========================================
# CONFIGURACIÓN DE APIs
# ===========================================

# URL base de la API administrativa SISCOM-ADMIN-API
# (Para gestión de usuarios, clientes, dispositivos, etc.)
VITE_ADMIN_API_URL=http://localhost:8000

# URL base de la API de comunicaciones SISCOM-API
# (Para obtener comunicaciones y datos de rastreo GPS)
VITE_COMM_API_URL=http://34.237.30.30:8080

# ===========================================
# CONFIGURACIÓN DE LA APLICACIÓN
# ===========================================

# URL de la página principal de la compañía
VITE_COMPANY_URL=http://localhost:5174

# Google Maps API Key - Obtén tu clave en Google Cloud Console
VITE_GOOGLE_MAPS_API_KEY=tu_clave_de_google_maps_aqui
```

### 3. Obtener Google Maps API Key

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Maps JavaScript
4. Crea credenciales (API Key)
5. Copia la clave al archivo `.env`

## Desarrollo

Inicia el servidor de desarrollo:

```bash
npm run dev

# o abre automáticamente en el navegador
npm run dev -- --open
```

## Estructura del Proyecto

```
src/
├── lib/
│   ├── stores/
│   │   └── auth.js          # Store de autenticación
│   └── services/
│       └── api.js           # Servicio para llamadas a FastAPI
├── routes/
│   ├── +layout.svelte       # Layout principal
│   ├── +page.svelte         # Página de inicio (redirección)
│   ├── login/
│   │   └── +page.svelte     # Página de login
│   ├── register/
│   │   └── +page.svelte     # Página de registro
│   └── dashboard/
│       ├── +layout.svelte   # Layout protegido
│       └── +page.svelte     # Dashboard con Google Maps
└── app.css                  # Estilos de Tailwind
```

## Integración con SISCOM-ADMIN-API

La aplicación está configurada para trabajar con SISCOM-ADMIN-API (FastAPI). Los endpoints utilizados son:

### Autenticación

- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/logout` - Cerrar sesión (requiere autenticación)
- `POST /api/v1/auth/forgot-password` - Solicitar código de recuperación
- `POST /api/v1/auth/reset-password` - Restablecer contraseña con código
- `PATCH /api/v1/auth/password` - Cambiar contraseña (requiere autenticación)

### Usuarios

- `GET /api/v1/users/me` - Obtener datos del usuario actual
- `GET /api/v1/users/` - Listar usuarios del cliente
- `POST /api/v1/users/invite` - Invitar nuevo usuario (solo maestros)

### Clientes

- `POST /api/v1/clients/` - Crear nuevo cliente (registro público)
- `GET /api/v1/clients/` - Obtener datos del cliente actual

### Ejemplo de respuesta de login:

```json
{
	"access_token": "eyJhbGciOiJSUzI1...",
	"id_token": "eyJhbGciOiJSUzI1...",
	"refresh_token": "eyJjdHkiOiJKV1Q...",
	"expires_in": 3600,
	"token_type": "Bearer",
	"user_id": "123e4567-e89b-12d3-a456-426614174000",
	"email": "usuario@ejemplo.com",
	"email_verified": true
}
```

### Arquitectura Multi-tenant

La aplicación soporta múltiples clientes (organizaciones):
- Cada cliente tiene sus propios usuarios y datos
- El aislamiento de datos se maneja automáticamente por el backend
- Los usuarios maestros pueden invitar a otros usuarios

## Uso

1. **Página de inicio**: Redirecciona automáticamente según el estado de autenticación
2. **Login**: Formulario de autenticación con validación completa
   - Enlace a registro centralizado en Geminis Labs
   - Enlace a recuperación de contraseña centralizada
3. **Registro**: Redirige automáticamente a la página centralizada de Geminis Labs (`VITE_COMPANY_URL/auth?mode=register`)
4. **Dashboard**: Mapa de Google Maps a pantalla completa con:
   - Header con información del usuario
   - Botón de logout
   - Detección automática de ubicación
   - Marcador en ubicación actual

### Autenticación Centralizada

La aplicación utiliza un sistema de autenticación centralizado:
- **Registro de usuarios**: Se realiza en la página principal de Geminis Labs (`/auth?mode=register`)
- **Recuperación de contraseña**: Se gestiona desde la página principal de Geminis Labs (`/auth?mode=recover`)
- **Login**: Se realiza directamente en la aplicación usando SISCOM-ADMIN-API

Esto permite tener cuentas de usuario centralizadas para todos los productos de la compañía, similar a los sistemas de Microsoft o Google.

## Personalización

### Cambiar ubicación por defecto del mapa

Edita `src/routes/dashboard/+page.svelte`:

```javascript
const mapOptions = {
	center: { lat: TU_LATITUD, lng: TU_LONGITUD },
	zoom: 13
	// ...
};
```

### Agregar nuevos endpoints de API

Edita `src/lib/services/api.js` y agrega nuevos métodos según necesites.

## Construcción

Para crear una versión de producción:

```bash
npm run build
```

Previsualizar la construcción:

```bash
npm run preview
```

## Despliegue

La aplicación puede desplegarse en cualquier plataforma que soporte aplicaciones SvelteKit como Vercel, Netlify, o un servidor tradicional.

Para desplegar, asegúrate de:

1. Configurar las variables de entorno en tu plataforma
2. Instalar un [adapter](https://svelte.dev/docs/kit/adapters) apropiado si es necesario
