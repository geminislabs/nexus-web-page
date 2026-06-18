# AGENTS.md — Guía para agentes de código

Instrucciones para asistentes de IA (Cursor, Copilot, etc.) que trabajen en este repositorio.

## Proyecto

**nexus-web-page** (`tracker-monitor-app`) — panel de monitoreo SvelteKit de Geminis Labs: mapa en vivo, vehículos, zonas H3, eventos y sesiones.

## Stack

| Capa        | Tecnología                     |
| ----------- | ------------------------------ |
| Framework   | SvelteKit 2, Svelte 5          |
| Build       | Vite 7                         |
| Estilos     | Tailwind CSS 4                 |
| Lint/format | ESLint 9 flat, Prettier (tabs) |
| Runtime     | Node.js 22                     |
| Deploy      | Docker + adapter-node → EC2    |

## Estructura

```text
src/lib/services/     # api, mapService, positionService, eventService, …
src/lib/stores/       # auth, theme, h3, zonas
src/lib/components/   # UI reutilizable (ZonasPanel, mapa, …)
src/routes/           # dashboard, auth, …
tests/                # Vitest (api, auth, servicios)
```

## Convenciones

- **Lenguaje:** JavaScript (`.js`, `.svelte`). No migrar a TypeScript sin RFC explícito.
- **Formato:** Tabs, comillas simples, `printWidth: 100` (ver `.prettierrc`).
- **Imports:** Usar alias `$lib/` de SvelteKit.
- **Env públicas:** prefijo `VITE_*` (se inyectan en build de Vite).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
- **Alcance:** Cambios mínimos y enfocados. No reformatear código no relacionado.

## Comandos obligatorios antes de terminar

```bash
npm run validate
```

Equivalente: `npm run lint`, `npm run check`, `npm run test`, `npm run build`.

## Módulos sensibles

- `src/lib/services/mapService.js` — Google Maps, marcadores, editor de zonas
- `src/lib/services/vehiclePositionStream.js` — WebSocket de posiciones
- `src/lib/components/ZonasPanel.svelte` — flujo de creación/edición de zonas H3

## Deploy

- CI en PR/push a `develop`/`master` (`.github/workflows/ci.yml`)
- Deploy automático al pushear tag `v*.*.*` (`.github/workflows/deploy.yml`)
- **Runtime:** configurar secret `ORIGIN` con la URL pública del panel (CSRF de SvelteKit adapter-node)
