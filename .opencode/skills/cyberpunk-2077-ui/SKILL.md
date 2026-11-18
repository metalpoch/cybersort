---
name: cyberpunk-2077-ui
description:Generar interfaces web y componentes con estética Cyberpunk 2077 (neón amarillo/cian, cortes angulares, efectos glitch y animaciones HUD) cuando el usuario pida un diseño futurista, distopico o estilo Cyberpunk.
version: 1.0.0
---

# Objetivo Principal
Transformar cualquier requerimiento de interfaz web (landing pages, dashboards, portafolios o componentes) en una experiencia visual inmersiva inspirada en la UI de *Cyberpunk 2077*. Debe sentirse como un HUD (Heads-Up Display) de alta tecnología: agresivo, de alto contraste, con cortes geométricos y micro-interacciones reactivas.

## Cuándo activar esta skill (Triggers)
Activa estas instrucciones **únicamente** cuando el usuario:
- Pida explícitamente un estilo "Cyberpunk", "Cyberpunk 2077", "Night City", "futurista distópico" o "estética HUD/Sci-Fi".
- Solicite rediseñar o estilizar una web existente hacia una temática neón oscura con animaciones agresivas.

## Sistema de Diseño (Design Tokens)
**OBLIGATORIO** utilizar estas variables CSS base en todo proyecto generado:

```css
:root {
  --cp-yellow: #fcee0a;       /* Color primario característico (Cyber Yellow) */
  --cp-cyan: #00f0ff;         /* Acento secundario y bordes HUD */
  --cp-red: #ff003c;          /* Alertas, errores y aberración cromática */
  --cp-bg-dark: #0a0a0f;      /* Fondo principal profundo */
  --cp-bg-panel: #12121c;     /* Fondo de tarjetas/contenedores */
  --cp-text-main: #e2e8f0;    /* Texto legible */
  --cp-text-muted: #64748b;   /* Metadatos y códigos de sistema */
}
```

### Tipografía
- **Títulos / Display:** Importar `'Orbitron'` o `'Rajdhani'` (en mayúsculas, `letter-spacing: 0.08em`, `font-weight: 800`).
- **Cuerpo / Código / HUD:** Importar `'Share Tech Mono'` o `'JetBrains Mono'`.

## Reglas Estrictas de UI y Animación
- **CERO bordes redondeados:** **NUNCA** uses `border-radius` en tarjetas o botones. Usa `clip-path` para crear esquinas recortadas en ángulo de 45° (ej. `clip-path: polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%);`).
- **Textura de Pantalla:** **SIEMPRE** incluye un overlay sutil de *scanlines* (líneas de escaneo CRT) sobre el fondo con `pointer-events: none;`.
- **Animaciones Obligatorias:**
  1. **Efecto Glitch en Hover:** Los botones principales y títulos `<h1>` deben tener una animación `@keyframes glitch` que desplace capas pseudo-elementos (`::before` y `::after`) en colores `--cp-cyan` y `--cp-red` usando `clip-path` aleatorios.
  2. **Pulso HUD:** Los indicadores de estado ("SYS.ONLINE", "NET_LINK") deben parpadear suavemente con `opacity` o `box-shadow`.
  3. **Barrido de Escáner:** Al pasar el cursor sobre tarjetas, un haz de luz diagonal o borde brillante debe recorrer el contenedor.
- **Micro-detalles de inmersión:** Añade etiquetas decorativas estilo terminal en las esquinas de los contenedores (ej. `// V.2077.89`, `SEC_LVL: MAX`, códigos de barras en CSS o coordenadas falsas).
- **Autocontenido:** Entrega el código listo para ejecutar (HTML + CSS en un solo bloque o componentes claros con Tailwind/CSS puro sin depender de librerías pesadas externas).

## Flujo de Trabajo
1. **Estructura:** Define el layout semántico con contenedores tipo HUD.
2. **Estilizado Base:** Aplica los tokens de color, fuentes de Google Fonts y el fondo con *scanlines*.
3. **Geometría:** Aplica `clip-path` en botones, tarjetas y barras de navegación.
4. **Animaciones:** Implementa los `@keyframes` de glitch, parpadeo y transiciones `cubic-bezier(0.23, 1, 0.32, 1)`.

## Ejemplo de Referencia (Componente Botón)
Cuando generes botones de acción principal, usa este patrón como estándar de calidad:

```html
<button class="cp-btn" data-text="INICIAR CONEXIÓN">
  INICIAR CONEXIÓN
</button>

<style>
.cp-btn {
  position: relative;
  background: var(--cp-yellow, #fcee0a);
  color: #000;
  font-family: 'Orbitron', sans-serif;
  font-weight: 800;
  padding: 14px 32px;
  border: none;
  cursor: pointer;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
  transition: background 0.2s, color 0.2s;
}
.cp-btn:hover {
  background: var(--cp-cyan, #00f0ff);
  animation: cp-glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite;
}
@keyframes cp-glitch {
  0% { transform: translate(0); }
  20% { transform: translate(-3px, 2px); }
  40% { transform: translate(-3px, -2px); }
  60% { transform: translate(3px, 2px); }
  80% { transform: translate(3px, -2px); }
  100% { transform: translate(0); }
}
</style>
```
