# Requerimiento · Enlaces legales en la app y auto-alojado de tipografías

**Producto:** NEXUS (`nexus-web-page`)
**Fecha:** 7 de agosto de 2026
**Prioridad:** alta — hay una obligación legal incumplida hoy en producción
**Esfuerzo estimado:** medio día

---

## Contexto

GeminisLabs publicó el 6 de agosto de 2026 su juego documental legal, redactado bajo la Ley
Federal de Protección de Datos Personales en Posesión de los Particulares publicada en el DOF el
20 de marzo de 2025. Los cuatro documentos ya están en línea y accesibles:

| Documento                    | URL                                             |
| ---------------------------- | ----------------------------------------------- |
| Aviso de Privacidad Integral | `https://www.geminislabs.com/legal/privacidad`  |
| Términos de Uso              | `https://www.geminislabs.com/legal/terminos`    |
| Aviso Legal                  | `https://www.geminislabs.com/legal/aviso-legal` |
| Política de Cookies          | `https://www.geminislabs.com/legal/cookies`     |

**El problema:** desde la aplicación NEXUS no hay forma de llegar a ninguno de ellos. No existe
un solo enlace legal en login, registro, recuperación de contraseña ni en el menú de usuario.

Esto importa porque **NEXUS escribe en el dispositivo del usuario antes incluso de que exista
sesión**: al abrir la pantalla de login ya se leen y escriben preferencias de tema, y al
autenticarse se guardan tokens y datos de perfil. La normativa mexicana no exige un panel de
consentimiento para almacenamiento técnico, pero **sí exige informar de forma visible**, y hoy
esa información no es alcanzable desde donde ocurre el almacenamiento.

---

## Alcance 1 · Enlazar los documentos legales desde la app

### Qué hay que hacer

Añadir enlaces a los cuatro documentos legales en los puntos donde el usuario está antes y
después de autenticarse.

**Puntos obligatorios** (antes de la sesión, que es donde ya se escribe en el dispositivo):

| Ruta               | Archivo                                   | Dónde encaja                                |
| ------------------ | ----------------------------------------- | ------------------------------------------- |
| `/login`           | `src/routes/login/+page.svelte`           | Bajo el texto `by GeminisLabs` (línea ~111) |
| `/register`        | `src/routes/register/+page.svelte`        | Bajo el equivalente `by GeminisLabs`        |
| `/forgot-password` | `src/routes/forgot-password/+page.svelte` | No tiene pie; hay que añadirlo              |
| `/reset-password`  | `src/routes/reset-password/+page.svelte`  | No tiene pie; hay que añadirlo              |

**Punto obligatorio** (con sesión iniciada):

| Ubicación                                | Archivo                                            |
| ---------------------------------------- | -------------------------------------------------- |
| Menú de usuario, junto a «Cerrar sesión» | `src/lib/components/UserPanel.svelte` (~línea 143) |

### Cómo

Crear **un componente compartido**, por ejemplo `src/lib/components/EnlacesLegales.svelte`, y
usarlo en los cinco sitios. No repetir los enlaces a mano: son cuatro URLs que van a cambiar
juntas y repetirlas garantiza que un día queden desincronizadas.

El componente debe aceptar al menos una variante compacta —para el pie de las pantallas de
autenticación— y otra de lista —para el menú de usuario—.

```
Privacidad · Términos · Aviso legal · Cookies
```

### Requisitos

- Los enlaces abren en **pestaña nueva** (`target="_blank"` con `rel="noopener noreferrer"`),
  para no perder un formulario de login a medio rellenar.
- Deben ser **alcanzables por teclado** y tener contraste suficiente en tema claro y oscuro.
  Es texto legal: no vale gris sobre gris.
- Las URLs se leen de **una única constante**, no incrustadas en cada plantilla. Sugerido:
  `src/lib/constants/legal.js`.
- Considerar usar `VITE_COMPANY_URL`, que ya existe en el `.env`, como base de las URLs en vez
  de escribir el dominio a mano.

### Criterios de aceptación

1. Desde `/login`, `/register`, `/forgot-password` y `/reset-password` se puede llegar a los
   cuatro documentos.
2. Con sesión iniciada, se puede llegar a los cuatro desde el menú de usuario.
3. Los cuatro enlaces resuelven con HTTP 200 (no 404, no redirección a la portada).
4. Navegación por teclado funcional y contraste AA en ambos temas.
5. Las URLs aparecen definidas **una sola vez** en el código.

---

## Alcance 2 · Auto-alojar las tipografías

### Qué hay que hacer

`src/lib/components/admin/AdminWorkspace.svelte`, líneas ~61-65, carga las tipografías **Sora** e
**IBM Plex Sans** desde el CDN de Google:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
<link
	href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
	rel="stylesheet"
/>
```

Cada carga **transfiere la dirección IP del usuario a Google**. Hay jurisprudencia europea
sancionando exactamente esto, y aunque el marco aquí es mexicano, es una transferencia
perfectamente evitable.

Hay que servir las tipografías **desde el propio dominio** y eliminar las tres etiquetas.

### Cómo

Instalar los paquetes de Fontsource, que es lo que ya usa Signum en esta organización:

```bash
npm install @fontsource/sora @fontsource/ibm-plex-sans
```

E importar únicamente los pesos que se usan hoy —Sora 500/600/700 e IBM Plex Sans 400/500/600—.
No importar la familia entera: son varios cientos de kilobytes de pesos que nadie usa.

### Requisitos

- **Ninguna petición a `fonts.googleapis.com` ni a `fonts.gstatic.com`** en toda la aplicación.
  Verificable en la pestaña Red del navegador con el filtro `google`.
- La interfaz de administración se ve **idéntica** a como se ve hoy.
- Sin parpadeo de texto sin estilo al cargar (usar `font-display: swap`, que Fontsource ya trae).

### Criterios de aceptación

1. Cargar `/dashboard` y el workspace de administración con la pestaña Red abierta: cero
   peticiones a dominios de Google para tipografías.
2. Comparación visual antes/después sin diferencias apreciables.
3. `npm run build` y `npm run check` sin errores nuevos.

### Efecto secundario deseable

Al eliminar esta carga, **desaparece el apartado 6.2 de la Política de Cookies** («Google
Fonts»). Avisar cuando esté hecho para regenerar el documento y quitar esa sección.

---

## Alcance 3 · Borrar documentos obsoletos

En `docs/legal/` de este repositorio quedan tres `.docx` **sin versionar** que fueron
sustituidos por el juego corporativo:

```
docs/legal/01-Politica-de-Cookies-NEXUS-GeminisLabs-MX.docx
docs/legal/02-Aviso-de-Privacidad-Integral-NEXUS-GeminisLabs-MX.docx
docs/legal/03-Aviso-Legal-y-Terminos-de-Uso-NEXUS-GeminisLabs-MX.docx
```

Su contenido pasó al cuerpo principal y al **Anexo A** del aviso corporativo, que vive en
`geminis-labs-web-page/docs/legal/`. Mantener ambos juegos es exactamente el problema que este
trabajo vino a resolver: dos versiones vivas del mismo texto que acaban divergiendo.

**Acción:** borrar la carpeta `docs/legal/` de este repositorio. No hay que versionarla antes;
nunca estuvo en git.

---

## Lo que NO entra en este requerimiento

- **No hay que redactar ni modificar textos legales.** Los documentos están redactados,
  revisados y publicados. Este trabajo es solo de enlazado y de infraestructura.
- **No hay que implementar un banner de cookies.** La normativa mexicana no lo exige para
  almacenamiento técnico; el régimen es de transparencia. Añadirlo sería trabajo inútil y
  además empeora la experiencia.
- **No hay que crear páginas legales dentro de NEXUS.** Los documentos son corporativos y
  viven en `geminislabs.com`. Se enlaza, no se duplica.

---

## Contacto

Dudas sobre el contenido legal: **privacidad@geminislabs.com**
Dudas técnicas: el equipo de NEXUS.
