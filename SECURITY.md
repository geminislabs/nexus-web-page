# Política de seguridad

## Versiones soportadas

| Versión         | Soportada | Notas                             |
| --------------- | --------- | --------------------------------- |
| Último tag `v*` | Sí        | Releases desplegados a producción |
| `develop`       | Sí        | Rama de integración activa        |
| Otras ramas     | No        | Sin garantía de parches           |

## Reportar una vulnerabilidad

**No reportes vulnerabilidades de seguridad mediante issues públicos de GitHub.**

Envía un reporte privado a:

**[security@geminislabs.com](mailto:security@geminislabs.com)**

Si el buzón no está disponible, usa **[contacto@geminislabs.com](mailto:contacto@geminislabs.com)** con asunto `SECURITY: nexus-web-page`.

Incluye en tu reporte:

1. Descripción del problema y el impacto potencial
2. Pasos para reproducir (o prueba de concepto)
3. Versión o commit afectado
4. Tu contacto para seguimiento

## Buenas prácticas del proyecto

Este panel consume APIs de comunicación/admin y Google Maps:

- **Nunca** commitees API keys ni tokens en el repositorio
- Las variables `VITE_*` son **públicas** en el bundle del cliente
- Los tokens de sesión se persisten en `localStorage` — no loguear tokens en consola
- Si una API key estuvo en el historial de git, **rótala** en el proveedor (p. ej. GCP Credentials) aunque ya no esté en el código actual
- `npm run scan:secrets` usa `.gitleaks-baseline.json` solo para hallazgos **históricos** ya conocidos; nuevos secretos siguen bloqueando el scan

## Dependencias

Las vulnerabilidades en dependencias npm se gestionan vía `npm audit` en CI.
