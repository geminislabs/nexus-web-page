# Módulo: Register

## 📌 Descripción

Página de registro de nuevos clientes.
Redirige automáticamente al sistema centralizado de registro de Geminis Labs.

---

## 👤 Actor

- Usuario no autenticado
- Persona interesada en crear una cuenta nueva

---

## 🌐 Recursos Externos

| Recurso                               | Uso                                              |
| ------------------------------------- | ------------------------------------------------ |
| `VITE_COMPANY_URL/auth?mode=register` | Sistema centralizado de registro de Geminis Labs |

---

## 🔁 Flujo funcional

1. Usuario accede a `/register`
2. Componente se monta
3. Redirige automáticamente a `{VITE_COMPANY_URL}/auth?mode=register`
4. Usuario completa registro en sistema centralizado
5. Tras registro exitoso, usuario puede volver a `/login`

---

## ⚠️ Consideraciones

- No consume APIs directamente
- Actúa como proxy de redirección
- El registro real se maneja en el sistema centralizado de Geminis Labs
- Muestra pantalla de carga mientras redirige
- Proporciona enlace manual si la redirección automática falla

---

## 🧭 Relación C4 (preview)

- **Container:** Web App (SvelteKit)
- **Component:** Register Module (Redirect)
- **Consumes:**
  - Sistema externo de Geminis Labs (redirección)
- **Dependencies:**
  - Ninguna (módulo de redirección simple)
