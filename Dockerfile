# Usar imagen base de Node.js
FROM node:22-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
ARG NODE_AUTH_TOKEN
RUN echo "@JesusCabrera84:registry=https://npm.pkg.github.com/" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" >> .npmrc && \
    npm ci --ignore-scripts

# Copiar el código fuente
COPY . .

# Permitir inyectar variables de entorno en tiempo de build (para Vite)
ARG VITE_COMPANY_URL
ENV VITE_COMPANY_URL=$VITE_COMPANY_URL

ARG VITE_COMM_API_URL
ENV VITE_COMM_API_URL=$VITE_COMM_API_URL

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_ADMIN_API_URL
ENV VITE_ADMIN_API_URL=$VITE_ADMIN_API_URL

# Docker avisa de esta y de la de arriba con SecretsUsedInArgOrEnv. Para la
# clave de Maps el aviso es técnicamente correcto y estratégicamente irrelevante:
# Vite hornea toda variable `VITE_*` en el bundle del cliente, así que esta clave
# **ya viaja al navegador de todo el mundo**. Que además quede en una capa de la
# imagen no añade exposición.
#
# El control que sí la protege es la restricción por referente HTTP en la consola
# de GCP, no la higiene del Dockerfile. Y lo que hará desaparecer el aviso de
# verdad es mover la configuración de build a runtime con `$env/dynamic/public`,
# que es trabajo de la Fase 4 del white-label — un build ya no podrá equivaler a
# una configuración cuando haya varias marcas sobre el mismo despliegue.
#
# El aviso de `NODE_AUTH_TOKEN` de más arriba es harina de otro costal: ése sí es
# un secreto de verdad y se arregla con un secreto de BuildKit.
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# Sincronizar SvelteKit (genera .svelte-kit/tsconfig.json y tipos)
RUN npx svelte-kit sync

# Construir la aplicación
RUN npm run build

# Instalar solo dependencias de producción para la etapa final
RUN npm ci --only=production --ignore-scripts

# Etapa de producción
FROM node:22-alpine AS runner

# Instalar dumb-init para manejo de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sveltekit

# Establecer directorio de trabajo
WORKDIR /app

# Cambiar propietario del directorio
RUN chown sveltekit:nodejs /app
USER sveltekit

# Copiar archivos necesarios desde el builder
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./package.json
COPY --from=builder --chown=sveltekit:nodejs /app/static ./static

# Exponer puerto
EXPOSE 3340

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3340
ENV HOST=0.0.0.0

# Comando de inicio
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build"]
