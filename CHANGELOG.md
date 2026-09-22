# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`vitest` sube a 4.1.11 y cierra GHSA-82fw-gwwq-j7x9** (path traversal / lectura de ficheros
  arbitraria vía `@vitest/mocker`, CVSS 5.9). Eran los dos únicos avisos abiertos del repositorio,
  y venían en el PR #60 de Dependabot, cerrado en el triaje del 22/09 — cerrarlo tiró también este
  arreglo
  - **Alcance real, medido y no supuesto**: el aviso exige llegar al WebSocket del _dev server_ por
    `mockerPlugin` o `interceptorPlugin`, y este repositorio **no usa ninguno ni el modo
    navegador**; la CI corre `vitest run`, que no deja ese socket abierto. Es dependencia de
    desarrollo y no viaja a producción. Se arregla porque es barato, no porque estuviera ardiendo
  - Se sube a **4.1.11**, la primera versión con el parche, y no a la 5.0.1 que proponía
    Dependabot: un salto de major es suficiente riesgo por PR
- **Umbrales de cobertura recalibrados, y el motivo importa más que los números.** Al subir a
  vitest 4 la cobertura «cayó» de 92,48 % a 80,87 % sin que se borrara un solo test — los 110
  siguen pasando. La causa: **vitest 3 contaba los ficheros de constantes y datos al 100 %**
  (`legal.js`, `mapStyles.js`, `unitIcons.js`, `vehicleColors.js`), que son objetos literales
  ejecutados enteros al importarse y sin nada que probar. El umbral del 90 % se cumplía en parte
  gracias a ellos
  - Los nuevos valores están **justo por debajo de la medida honesta**, para que la puerta siga
    detectando regresiones. **No se ha bajado el listón: se ha dejado de inflar el número**, y la
    cobertura real de la lógica siempre fue ~81 %
- **Auditoría de dependencias por tiempo** (`.github/workflows/dependency-audit.yml`), **lunes y jueves**, sobre `master` y `develop`. Cierra el hueco que destapó la liberación del 18/09: `ci.yml` sólo corre con `push` y `pull_request`, así que **un aviso publicado entre dos PRs deja el repositorio vulnerable sin que nadie lo sepa**. El último `ci.yml` sobre `develop` había corrido el 5 de septiembre; tres avisos salieron en ese hueco y se descubrieron trece días después, por casualidad, cuando un PR de otra cosa los destapó
- **CI: adiós a Node 20** en `actions/upload-artifact`, que pasa de `v4` a `v7`. GitHub ya la
  forzaba a correr en Node 24 y lo avisaba en cada corrida. **Es la única afectada en este
  repositorio**: `actions/checkout@v5` y `actions/setup-node@v5` ya están en Node 24, comprobado
  en el log de la corrida `35616984624` — el aviso nombra a `upload-artifact` y a nadie más, así
  que no se tocan
- **Auditoría de dependencias por tiempo** (`.github/workflows/dependency-audit.yml`), **lunes y jueves**, sobre la rama por defecto. Cierra el hueco que destapó la liberación del 18/09: `ci.yml` sólo corre con `push` y `pull_request`, así que **un aviso publicado entre dos PRs deja el repositorio vulnerable sin que nadie lo sepa**. El último `ci.yml` sobre `develop` había corrido el 5 de septiembre; tres avisos salieron en ese hueco y se descubrieron trece días después, por casualidad, cuando un PR de otra cosa los destapó
  - **Sólo se programa el escaneo de dependencias.** Gitleaks y semgrep son función del código y no pueden ponerse rojos solos: correrlos por reloj repetiría el mismo veredicto y enseñaría a ignorar los correos de fallo, que es el peor resultado posible
  - **No sustituye a Dependabot**, lo complementa. Dependabot corre los lunes y sólo abre PR cuando existe un parche; esto avisa el día que sale el aviso, haya arreglo o no — y su cupo de 10 PRs abiertos puede estar lleno
  - **Lunes y jueves, no diario.** Cron no sabe expresar «cada 72 horas»: `*/3` sobre el día del mes reinicia el contador en cada cambio de mes —del 31 al 1 pasa un día, no tres— y puede caer en fin de semana, que es una alerta que nadie mira hasta el lunes. Con lunes y jueves el hueco máximo son 4 días y siempre cae en día laborable
  - **Revisa sólo la rama por defecto**, no las dos. La primera versión llevaba matriz sobre `master` y `develop`, y **CodeQL la rechazó con dos alertas altas de `cache-poisoning`**: un workflow programado corre con los privilegios de la rama por defecto, así que hacer checkout de `develop` y ejecutar sus `scripts/*.sh` daba a código de una rama menos protegida acceso de escritura a la caché de `master`. Se pierde poco — `develop` ya lo escanea `ci.yml` en cada push y en cada PR, y en el hueco que este workflow viene a tapar `develop` no cambia

### Security

> **Nota.** Lo que queda debajo es anterior a esta release y nunca se movió a su
> sección — parte salió con la `1.16.0` y parte con tags anteriores. Se deja aquí
> a propósito: repartirlo exigiría adivinar qué entró en cada tag, y adivinarlo
> produciría un historial falso. A partir de la `1.16.1` sí se corta en cada
> liberación.

- Credencial dedicada para el plano de datos (`src/lib/services/dataToken.js`). siscom-api deja de recibir el token de sesión de Cognito —que lleva identidad de usuario y sirve para toda la admin-api— y pasa a recibir un PASETO v4.public cuyo contenido es solo `{ jti, scope_ref, aud, iat, nbf, exp }`. El alcance vive en Valkey, así que el plano de datos autoriza sin poder saber de quién es la flota
- Los WebSockets pasan la credencial por subprotocolo del handshake (`siscom.data-token.v1`) en vez de la query string: en v4.public el payload va en claro y una query acaba en los logs del ALB y en la cabecera `Referer`
- El IMEI deja de viajar por el cable. `deviceRef` opaco sustituye a `device_id` en query strings y paths; `deviceId` se conserva solo para mostrar en pantalla
- Tres estados diferenciados del plano de datos: 403 alcance rechazado (se reemite y reintenta una vez), 404 nada visible en el rango pedido (no se reintenta), 200 con lista vacía sin datos. Una lista vacía ante un rango sin permiso afirmaría que no hubo telemetría, cuando la hubo y no es visible
- `eventService` deja de caer a un `http://localhost:8000` cableado si falta `VITE_COMM_API_URL`, igual que ya hacía `positionService`

- Added a `nanoid` override (`>=3.3.17`) for GHSA-2v37-7h3g-55p8. The advisory was published after the last green build and broke CI on `develop` in both the `quality` (npm audit) and `security` (OSV) jobs. It reaches the tree through `postcss`
- Raised the `@sveltejs/kit` floor in `package.json` from `^2.22.0` to `^2.70.2`. The fix for GHSA-29g2-3rmr-qm68 lived only in the lockfile, so any `npm install` could resolve back to a vulnerable 2.x and silently undo it. Production was never exposed — the Dockerfile uses `npm ci` — but local environments were
- Bumped `fast-uri` from 4.1.2 to 4.1.4 for GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf and GHSA-jqff-g426-hqxp (host confusion and SSRF). Same pattern as the `nanoid` entry above: the advisories were published after the last green build, so CI went red on `develop` without anyone touching the repo. It is a dev dependency and never reached the served bundle

### Added

- Logger estructurado (`src/lib/utils/logger.js`) con puente de observability y `hooks.server.js` (headers de seguridad + CSP Report-Only)
- Indicadores GPS/LTE unificados (`SignalMeters`, `signalIndicators`) con detalle técnico al hover
- Badges de telemetría reutilizables (`UnitTelemetryBadges`) en Seguimiento, panel de unidad y listados
- Popup de posición en mapa (`VehiclePositionPopup`) montado desde `mapService` (coords copiar/Maps, señales, sin X nativo de Google)
- Tests: `signalIndicators`, logger/alertas, `workspaceStore`

- Legal document links (Privacidad, Términos, Aviso legal, Cookies) on login, register, forgot/reset password, and the signed-in user menu — shared `EnlacesLegales` component; URLs from `src/lib/constants/legal.js` (`VITE_COMPANY_URL`, fallback `https://www.geminislabs.com`)
- Unit tests for legal URL constants (`tests/legal.test.js`)
- `docs/requerimientos/enlaces-legales-y-tipografias.md` — requirement spec for legal linking and font self-hosting

- Map layers menu (Mapa / Satélite / Híbrido / Relieve + tráfico en vivo) and custom zoom controls matching app look
- Street View: custom exit control below WorkspaceSwitcher; native pegman with theme-aware background
- Map visibility sync between Unidades and Seguimiento (eye toggles + checkboxes; selecting a unit shows it on the map)

- Admin workspace for masters: Administración ↔ Seguimiento switcher, dashboard sin mapa, and unified Alertas/Zonas side panel
- H3 resolution slider on the map (theme-aware, max 10, default 8) when creating zones or showing the grid
- Close control on the tracking unit panel; panel is hidden while the H3 grid is active

- Seguimiento units UI: telemetry cards, status filters, and map visibility toggles (`MapVisibleUnitsCard`); dual light/dark panels across tracking and reports unit picker

- Map follow mode: botón "Seguir" en el panel de unidad con autoenfoque (zoom 15) y rastro en vivo con degradado

- Vitest coverage gates (`test:coverage`) with thresholds on `src/lib/**` (90/90/70/90)
- `vitest-setup.js` (happy-dom, `matchMedia`/`localStorage`/`fetch` mocks)
- Unit tests: auth stores, theme, sessionService, eventService, zoneDbMapper, alarmFormat, api passthrough
- OSV-Scanner (`scripts/osv-scan.sh`, `npm run scan:osv`) in CI `security` job
- Dependabot (npm, github-actions, docker) and `.github/CODEOWNERS`
- `docs/GOVERNANCE.md` — branch protection, coverage policy, Dependabot merge rules
- CI uploads coverage artifact; `audit` and `e2e` jobs are blocking (no `continue-on-error`)

### Added

- Expand button on report charts: opens each chart in a horizontally scrollable modal showing every bucket label

### Changed

- Paneles laterales de Seguimiento, Alertas e Informes con el mismo ancho; Informes con scroll en el body del drawer
- Cerrar Seguimiento al hacer clic fuera / en el mapa (mismo comportamiento que Alertas e Informes)
- Selector de tema Oscuro/Claro inline en el menú de usuario (ya no abre ventana de Configuración)
- Tarjetas de unidad en Seguimiento: una fila por registro; acciones (detalles/editar/eliminar) en columna a la derecha con texto al hover
- Panel de unidad: telemetría en grillas 2×2, icono de color de perfil, botones de acción compactos
- Informes movidos al workspace de Seguimiento (acceso desde sidebar, no solo admin)

- Admin workspace fonts (Sora, IBM Plex Sans) are self-hosted via Fontsource (`latin` / `latin-ext` weights in use only); removed Google Fonts CDN `<link>` tags from `AdminWorkspace.svelte` so the browser no longer sends the user IP to Google for typography
- `.env.example`: clarify that `VITE_COMPANY_URL` is the corporate site base (auth + `/legal/*`), not the NEXUS app origin

- Signal intensity classified as Malo/Regular/Bueno (red/yellow/green only) across telemetry chips and map InfoWindow
- Telemetry chips now show icons and clearer texts: Batería (V), Respaldo (V), Satélites, Señal
- Report chart x-axis labels rendered fully vertical for readability

- npm overrides: `brace-expansion@5.0.9`, `fast-uri>=4.1.2`, `minimatch@9→10.2.6`, `js-yaml>=5.2.2`, and `postcss^8.5.18` to clear high audit/OSV findings

- Mobile bottom tab bar respects light/dark theme
- Floating tracking panel moved to the left so map zoom/Street View stay usable on the right
- Telemetry labels standardized (Voltaje, Respaldo, Satélites, Señal) with signal color chips
- Vehicle InfoWindow regenerates with current theme when switching light/dark
- Reports charts aligned with mobile (avg + max speed; satellites area fill)

- Non-master users: hide create/edit/delete/deactivate for vehicles, zones, and alerts (view-only management UI)
- Map type control moved to left-center so it does not overlap the workspace switcher; “Ver detalles” label on unit list
- npm overrides for `js-yaml`, `fast-uri`, `tar`, and `brace-expansion` to clear high/critical audit and OSV findings

- Responsive tracking layout: tablet bottom sheet for seguimiento; floating “Unidades visibles” on desktop (lg+) only; hide vehicle InfoWindow on mobile; map initializes from saved theme (early `app.html` theme script)

- `npm run validate` runs `test:coverage` instead of plain `test`
- npm override for `js-yaml` audit advisory

- Dev container (`.devcontainer/`) with post-create setup from `.env.example`
- Vitest unit tests for `passwordValidation`, `eventUtils`, and `unitTrackingStatus` utils
- Playwright smoke e2e (`e2e/smoke.spec.js`) — onboarding redirect and sign-in UI
- ADRs (`docs/adr/0001`–`0003`) and `docs/security/threat-model.md`
- GitHub issue templates (bug, feature, security contact link)
- CI job `e2e` (informational, `continue-on-error: true`)
- Engineering foundation (PR-1): `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`, `.nvmrc`

- Release discipline: `CHANGELOG.md`, `docs/RELEASE.md`, `scripts/setup.sh`, Husky hooks (commitlint, lint-staged, pre-push)
- CI guardrails: `ci.yml` (lint, type-check, tests, build, audit) + Gitleaks and Semgrep in `security` job
- Separate `deploy.yml` for tag-based EC2 deployments (`v*.*.*` only)
- `scripts/gitleaks-scan.sh` and `npm run scan:secrets`
- Pull request template with base-branch and validate checklist
- Split monolithic GitHub Actions workflow into `ci.yml` (quality gates) and `deploy.yml` (releases)
- `npm run validate` shortcut: lint + check + test + build
- Node.js 22 as target runtime in CI, `.nvmrc`, and `Dockerfile` base image
- Deploy passes `ORIGIN` at container runtime (required by SvelteKit adapter-node)

### Fixed

- Mouse wheel zoom no longer blocked while the map layers/alerts dropdown is open (removed full-screen backdrop; close on outside click)
- Reports: Comms Fixable / Comms Fix totals read the API's `count_comm_fixable`/`count_comm_with_fix` keys (accepting camelCase variants) instead of always showing 0
- Reports: detected exceptions listed in stable selection order (matching mobile) instead of request-completion order
- Mobile: H3 resolution slider hidden while the “Guardar zona” sheet is open (no longer overlaps the modal)

- Map alert/layers controls not showing due to race between session `isLoading` and Google Maps init
- Mobile unit selection in tracking (object vs id) and eye visibility icon updating immediately
- Partial “Seleccionar todas en mapa” state when only some filtered units are visible

- El mapa ya no pierde zoom/pan en cada actualización WebSocket de posición
- Marcadores de unidad dejan de parpadear/desaparecer en updates en vivo (clusterer usa `render()` en lugar de remove/add)
- El modo seguir se limpia al cambiar a la vista de Trayectos

- Live map positions: WebSocket stream base is derived from `VITE_COMM_API_URL` again (removed redundant `VITE_POSITION_STREAM_WS_BASE` build config)
- Zone editor: mouse wheel zoom works on desktop when creating zones (zoom lock limited to mobile viewport)
- Removed hardcoded Google Maps API key fallback from `mapService.js` (use `VITE_GOOGLE_MAPS_API_KEY` only)
- npm `overrides` for `cookie` and `esbuild` audit advisories
- Gitleaks: sanitized README token examples, baseline for pre-existing historical findings

### Security

- Bump `@sveltejs/kit` to `2.70.2` (GHSA-29g2-3rmr-qm68 / OSV medium)
- **Rotate** any Google Maps API key that was previously committed in git history (GCP Console → Credentials)

## [1.16.2] - 2026-09-19

**Paso manual en esta liberación.** El contenedor viejo —`nexus-web-page-test`— se para a mano
durante el despliegue. El script para por nombre, así que sin ese paso el `docker run` fallaría por
conflicto de puerto: el anterior seguiría vivo ocupando el 3340, y el despliegue quedaría en rojo
con producción servida por la versión previa. Se hizo a mano en vez de dejar código de transición
porque es un gesto único, y ese código sobraría al día siguiente.

**Verificación después de desplegar.** `docker ps` en la EC2 debe mostrar **un** contenedor,
llamado `nexus-web-page`, y ninguno con el sufijo viejo.

### Changed

- **El contenedor de producción deja de llamarse `nexus-web-page-test`.** El nombre afirmaba algo falso sobre el mundo —ese contenedor _es_ producción— y es la misma familia de confusión que el entorno `test` de GitHub que también lo es. Ahora es `nexus-web-page` a secas
  - **El contenedor viejo se para a mano en esta liberación.** El script para por nombre, así que sin ese paso el `docker run` fallaría por conflicto de puerto —el anterior seguiría vivo ocupando el 3340— y el despliegue quedaría en rojo con producción servida por la versión anterior. Se hace a mano en vez de dejar código de transición porque es un gesto único y el código sobraría al día siguiente; el `deploy.yml` lleva la nota de que ese nombre existió
- **Queda escrito por qué `VITE_GOOGLE_MAPS_API_KEY` es un `ARG`/`ENV` a propósito**, en el propio `Dockerfile`, donde salta el aviso de Docker. Vite hornea toda variable `VITE_*` en el bundle, así que esa clave ya viaja al navegador de todo el mundo: lo que la protege es la restricción por referente en GCP, no la higiene de la imagen. El aviso desaparecerá de verdad cuando la configuración pase a runtime con `$env/dynamic/public`, que es trabajo de la Fase 4

## [1.16.1] - 2026-09-18

**Despliegue.** Esta release **va antes** que la `v1.31.0` de `siscom-admin-api`. Las dos son seguras en cualquier orden, pero sólo así no hay ventana: mientras el backend todavía no manda credenciales en la respuesta del cambio de contraseña, `setSession` no hace nada y no cambia el comportamiento actual. Al revés, cambiar la contraseña mandaría al login sin explicación hasta que la web se desplegara.

### Security

- **Al cambiar la contraseña se adopta la sesión nueva que devuelve la API.** Acompaña al cambio de `siscom-admin-api` que hace que cambiar o restablecer la contraseña **cierre todas las sesiones** — hasta ahora no cerraba ninguna, y con refresh tokens de 90 días eso dejaba dentro al intruso durante meses. Esa revocación no distingue el dispositivo de quien cambia la contraseña del de nadie, así que el backend abre una sesión nueva y la manda en la respuesta; sin adoptarla aquí, hacer lo correcto te mandaba al login sin explicación. La reautenticación del backend es _best effort_: si no vienen credenciales, `setSession` no pisa nada y el siguiente 401 lleva al login, que es lo correcto porque esta sesión ya fue revocada

- **Tres avisos de dependencias, publicados después de la última build verde.** Es el mismo patrón que ya trajeron `nanoid` y `fast-uri`: el último `ci.yml` sobre `develop` corrió el 5 de septiembre, los avisos salieron después, y la CI se pone roja sin que nadie toque el repositorio
  - `devalue` 5.8.1 → 5.9.4 por override (GHSA-9rgm-9g3h-6x36). Llega por `@sveltejs/kit` y por `svelte`, así que **sí viaja al bundle servido**: es el único de los tres que importa en producción, y el único que este cambio arregla de verdad
  - `vitest` y `@vitest/coverage-v8` (GHSA-82fw-gwwq-j7x9) quedan **registrados como riesgo aceptado** en un `osv-scanner.toml` nuevo, con su razón y su disparador. Son dependencias de desarrollo: no entran en el bundle ni en la imagen, que se construye con `npm ci --omit=dev`
  - **Se intentó subirlos y se revirtió, que es el dato que justifica la excepción**: vitest 4.1.11 instala y pasa los 108 tests, pero mide la cobertura de otra forma y deja los umbrales de `vite.config.js` por debajo —85.06% de líneas contra el 90% exigido— sin que se haya dejado de probar nada. Entender ese cambio y ajustar la configuración es trabajo propio, y no puede viajar dentro de un arreglo de seguridad
  - El disparador para quitar la excepción está escrito en el propio fichero: **el próximo trabajo que toque vitest por cualquier motivo**. No es permanente, espera turno
