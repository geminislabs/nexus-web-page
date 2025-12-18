# Guía de Funcionalidad y Comportamiento del Proyecto Nexus

## Documentación para Diseño UX/UI y User Research

Este documento describe en detalle la funcionalidad, flujos de usuario y pautas estéticas de la plataforma, sirviendo como fuente de verdad para la creación de mockups y prototipos, con énfasis especial en la adaptación móvil.

---

### 1. Estética y Sistema de Diseño

La aplicación sigue una línea **futurista, minimalista y tecnológica**.

#### Temas (Themes)

El sistema permite cambiar entre 3 temas en tiempo real desde el panel de "Configuración".

1.  **Modern (Glass - Default):**
    - **Fondo:** Oscuro profundo (`#0b1524`) con video ambiental de fondo.
    - **Elementos:** Paneles translúcidos con desenfoque (glassmorphism), bordes sutiles blancos/transparentes.
    - **Acento:** Cyan brillante (`#00a6c0`).
2.  **Dark (Alto Contraste):**
    - **Fondo:** Gris casi negro (`#0f1115`).
    - **Elementos:** Gris oscuro sólido (`#1f2937`), sin transparencias.
    - **Acento:** Cyan neón (`#22d3ee`).
3.  **Classic (Light):**
    - **Fondo:** Blanco puro (`#ffffff`).
    - **Elementos:** Blanco con sombras suaves, bordes grises muy claros.
    - **Acento:** Azul corporativo estándar (`#2563eb`).

#### Tipografía

- **Títulos:** "Stack Sans Headline" (Peso 900) - Uso en encabezados grandes.
- **Cuerpo:** Sans-serif de sistema (Inter/Roboto) - Limpia y legible.

---

### 2. Login (Inicio de Sesión)

**Posición de Elementos:**

- **Fondo:** Video en bucle ("map-back-1") con capa oscurecida.
- **Centro:** Tarjeta de login flotante (Glassmorphism).
  - **Logo:** Imagen "Nexus" centrada arriba.
  - **Inputs:** Campos para Email y Contraseña. Estilo de linea o caja con fondo muy sutil.
  - **Recuperación:** Enlace "¿Olvidaste tu contraseña?" alineado a la derecha del label "Contraseña". **Importante:** No es alcanzable con TAB (`tabindex="-1"`), solo clic.
  - **Botón:** "Iniciar Sesión" (Ancho completo). Muestra spinner al cargar.
- **Pie:** Enlace "¿No tienes una cuenta? Regístrate aquí".

---

### 3. Navegación y Menú

La estructura cambia radicalmente según el dispositivo.

#### Iconografía del Menú

- **Usuario:** Silueta de persona/busto.
- **Vehículos:** Silueta de vehículo/camión.
- **Admin:** Escudo o Engranaje (Solo visible para usuarios Master).
- **Opciones:** Deslizadores (Sliders) de configuración.

#### Comportamiento Web (Escritorio)

- **Barra Lateral (Izquierda):** Fija.
- **Logo:** Visible en la parte superior de la barra (`logo-nexus-short.png`).
- **Items:** Iconos apilados verticalmente debajo del logo.
- **Cerrar Sesión:** Icono de "Power" o "Salida" ubicado al final de la barra (abajo del todo).
- **Paneles:** Al hacer clic en un icono, se despliega un panel lateral adyacente ("Drawer") con el contenido.

#### Comportamiento Móvil (iPhone/Android)

- **Barra Inferior (Bottom Bar):** La barra lateral desaparece. Se muestra una barra fija al pie de la pantalla (~70px alto).
- **Logo:** **Se oculta**. No aparece en la navegación móvil.
- **Items:** Los iconos se distribuyen horizontalmente de forma uniforme.
- **Cerrar Sesión (Logout):**
  - **NO** está en la barra principal.
  - **Reubicación:** Se mueve dentro del panel de "Usuario". Es el último ítem de la lista, destacado en rojo.
- **Interacción:** Al tocar un icono, el panel correspondiente sube desde abajo (tipo "Sheet" o modal de pantalla completa) cubriendo el mapa, con un botón/barra para minimizar.

---

### 4. Paneles y Funcionalidades

Cada sección del menú abre un panel específico.

#### A. Panel de Usuario

- **Cabecera:** Muestra "INFORMACIÓN DEL USUARIO".
- **Datos:** Tarjeta con Nombre y Email.
- **Acciones:**
  - **Cambiar Contraseña:** Acordeón desplegable (Inputs: Actual, Nueva).
  - **Invitar Usuario:** (Solo Master) Formulario simple para enviar invitación por email.
  - **Cerrar Sesión (Solo Móvil):** Botón rojo visible aquí.

#### B. Panel de Vehículos (Nexus)

El núcleo de la operación.

- **Lista:** Tarjetas de vehículos asignados al usuario. Muestra Nombre y Estado.
- **Selección:** Al tocar un vehículo:
  1.  Cierra/Minimiza el panel (en móvil) para ver el mapa.
  2.  Centra el mapa en la última posición.
  3.  Abre/Muestra la sección de "Trayectos" del día.
- **Compartir (Share):** (Solo Master) Botón en la tarjeta del vehículo para generar un enlace público temporal. Muestra fecha de expiración y botón de copiar.

**Sub-sección: Trayectos (Replay)**

- **Selector de Fecha:** Un input de fecha simple. Selección de **un solo día**.
- **Lista de Trayectos:** Muestra hora inicio y fin de cada viaje detectado.
- **Reproducción:**
  - Al seleccionar un trayecto, se dibuja la ruta en el mapa.
  - Aparecen controles flotantes o integrados: **Play, Pause, Stop**.
  - **Animación:** Un marcador recorre la línea trazada.

#### C. Panel de Administración (Solo Master)

Gestión de flota y dispositivos.

- **Gestionar Dispositivos:**
  - Lista de dispositivos GPS físicos (Hardware).
  - Muestra ID y Estado (bolita de color: verde=asignado, gris=nuevo, etc.).
- **Gestionar Unidades:**
  - Crear nueva unidad (Nombre).
  - **Edición de Perfil:** Al seleccionar una unidad, permite editar:
    - **Icono:** Selector visual de tipo de vehículo (Sedán, Camión, Moto, etc.).
    - **Datos:** Nombre, Descripción, Marca, Modelo, Año, Placa, VIN.
    - **Color:** Selector de color (paleta predefinida) para el icono en el mapa.
  - **Asignación:**
    - Vincular un Dispositivo GPS a la Unidad (Dropdown de libres).
    - Desasignar dispositivo.
- **Asignar Unidades a Usuarios:** (Puede estar en una vista separada o integrada) Permite seleccionar un Usuario y marcar qué Vehículos puede ver.

#### D. Panel de Opciones

- **Tema:** Botones para cambiar entre Modern, Dark, Light.

---

### 5. Mapa y Marcadores (Map Engine)

La capa visual principal detrás de la interfaz.

#### Visualización

- **Vista:** Pantalla completa (`100vh`).
- **Viñeta:** En temas oscuros, hay un oscurecimiento radial en las esquinas para centrar la atención.

#### Marcadores de Vehículos

- **Icono:** Determinado por el tipo de vehículo configurado (ej. silueta de auto visto desde arriba).
- **Color:** El icono se tiñe del color configurado (ej. Azul, Rojo, Gris).
- **Etiqueta:** Algunos diseños muestran el nombre del vehículo debajo o encima del marcador.
- **Info Window (Click):** Al tocar un marcador, se abre una burbuja con:
  - ID / Nombre.
  - Estado (En movimiento, Detenido - con badges de color).
  - Velocidad (km/h).
  - Voltajes de batería (Vehículo y Dispositivo).
  - Última actualización (Fecha/Hora).
  - Coordenadas.
