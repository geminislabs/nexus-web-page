# Guía de contribución

Gracias por contribuir a **nexus-web-page**. Este documento define el flujo mínimo para mantener calidad y consistencia.

## Requisitos previos

- **Node.js 22** (ver `.nvmrc` y `engines` en `package.json`)
- npm (incluido con Node)

```bash
nvm use              # si usas nvm
bash scripts/setup.sh
```

`scripts/setup.sh` ejecuta `npm ci` y configura los hooks de Husky.

### 1. Rama base

Trabaja siempre desde `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b <tipo>/<descripcion-corta>
```

Prefijos de rama:

| Prefijo     | Uso                                         |
| ----------- | ------------------------------------------- |
| `feature/`  | Nueva funcionalidad                         |
| `fix/`      | Corrección de bug                           |
| `chore/`    | Tooling, docs, dependencias, CI             |
| `refactor/` | Cambio interno sin cambio de comportamiento |
| `test/`     | Solo tests                                  |

### 2. Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/). Husky valida el mensaje con commitlint.

Formato:

```text
<tipo>(<alcance opcional>): <descripción en imperativo>
```

Tipos habituales: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `perf`.

### 3. Antes de abrir un PR

Ejecuta localmente:

```bash
npm run validate   # lint + check + test + build
```

Equivalente manual:

```bash
npm run lint
npm run check
npm run test:coverage
npm run build
```

Opcional:

```bash
npm run audit
npm run scan:secrets
npm run test:coverage:e2e    # smoke Playwright (requiere: npx playwright install chromium)
```

### 4. Pull requests

- Base branch: **`develop`**
- Usa la plantilla de PR (`.github/pull_request_template.md`)
- Actualiza `CHANGELOG.md` en `[Unreleased]` si el cambio es visible para usuarios

## Hooks de Git (Husky)

- **pre-commit:** lint-staged (formato y lint en archivos staged)
- **commit-msg:** validación Conventional Commits (commitlint)
- **pre-push:** nombre de rama válido; changelog si el commit es `feat`/`fix`/etc.

## Variables de entorno

Copia `.env.example` a `.env` para desarrollo local.

En producción (Docker), las `VITE_*` se pasan como build-args; `ORIGIN` y `PORT` como variables de runtime del contenedor.
