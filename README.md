# 1%

Juego de razonamiento lógico para iPhone, instalable en la pantalla de inicio (PWA).
Un solo fallo y se acaba la partida.

- **Normal y Difícil**, partidas de hasta **100 preguntas** en 5 fases de 20. Llegar a 20 ya es una victoria;
  cada fase sube mucho la dificultad (y dentro de cada fase sube cada 4 preguntas). Cada fase tiene su color:
  verde, azul, amarillo, rosa y rojo.
- **Contrarreloj**: igual, pero cada pregunta tiene un tiempo límite ajustado a lo larga y difícil que es.
- **Aventura**: 5 mundos de 100 niveles (del 100 % al 1 %) en un mapa, con un **jefe final** muy difícil en
  cada mundo que abre el siguiente.
- Más de **3800 preguntas** de 7 niveles de dificultad y más de 80 tipos: lógica, adivinanzas, pensamiento
  lateral, paradojas, filosofía y falacias, palabras, cálculo cotidiano (nunca álgebra), patrones visuales y
  **juegos táctiles** (ordenar tocando, tocar la casilla, memoria, pintar cuadrículas) con vibración.
- 100 % local y offline: sin backend, sin APIs, sin anuncios, sin coste. Se actualiza sola.

## Probarlo en local

```bash
npm install
npm run dev        # desarrollo
npm run build      # build de producción en dist/
npm run preview    # sirve dist/ (con service worker)
```

## Instalar en el iPhone

1. Publica la carpeta `dist/` en cualquier hosting estático con HTTPS (abajo, opción gratuita).
2. Abre la URL en **Safari** en el iPhone.
3. Botón **Compartir** → **Añadir a pantalla de inicio**.
4. Abre **1%** desde el icono: se ejecuta a pantalla completa, sin barras de Safari.

Tras la primera carga completa, el juego funciona en **modo avión**: todos los recursos
(código, tipografías, iconos y preguntas) quedan en la caché del service worker y el progreso
se guarda en `localStorage`.

> En Safari normal (sin instalar) el navegador mantiene sus barras: la experiencia inmersiva
> se obtiene al abrir la app desde la pantalla de inicio.

### Hosting gratuito con GitHub Pages

El workflow `.github/workflows/deploy.yml` publica la app en cada push a la rama principal.
Actívalo una vez en **Settings → Pages → Source: GitHub Actions**.
GitHub Pages es gratuito para repositorios públicos. La build usa rutas relativas,
así que funciona igual en cualquier subruta o en otros hostings estáticos gratuitos.

## Pruebas

```bash
npm test           # banco de preguntas + motor del juego (Vitest)
npm run build && npm run e2e   # recorrido completo en Chromium a tamaño iPhone, incluido offline
```

El test e2e comprueba: partida completa 20/20, derrota, reinicio, abandono, récords por modo,
persistencia al recargar, reanudar una partida a medias, dobles toques, funcionamiento sin
conexión, fondo a pantalla completa, zonas seguras y ausencia de errores de consola.

## Estructura

```
src/
  data/
    types.ts              Tipos y helper de autoría de preguntas
    questions/            Banco: facil.ts … experto.ts, enigmas.ts (escritas a mano) y generated.json
    gen/                  Generadores con solucionador: cada pregunta generada tiene una única respuesta
  engine/
    difficulty.ts         Modos, progresión de 20 huecos por nivel (tiers)
    selector.ts           Selección aleatoria controlada de cada partida
    game.ts               Motor: iniciar, responder, ganar, perder, abandonar
    rng.ts                Aleatoriedad (crypto) y PRNG con semilla para tests
  storage/persistence.ts  Guardado local versionado y tolerante a datos corruptos
  components/             Logo, selector de dificultad, progreso, glifos vectoriales…
  screens/                Inicio, Pregunta, Fin de partida, Victoria
  styles/                 Tokens de diseño, animaciones (respeta prefers-reduced-motion)
scripts/
  generate-icons.mjs      Genera iconos y pantallas de arranque de iOS
  e2e.mjs                 Prueba de extremo a extremo
```

## Añadir preguntas

Añade entradas al archivo del modo correspondiente. La **respuesta correcta se escribe siempre
primero**; el juego baraja las opciones en cada partida.

```ts
q('n61', 3, 'deductiva', 'Enunciado…', ['Correcta', 'Distractor 1', 'Distractor 2', 'Distractor 3'],
  'Explicación breve.'),
```

- `tier` (1–6) fija en qué tramo de la partida puede aparecer:
  1 → preguntas 1-4, 2 → 5-8, 3 → 9-12, 4 → 13-16, 5 → 17-19, 6 → pregunta 20.
- Preguntas visuales: añade un array de filas. `{ci}`, `{sqo}`, `{tr}`, `{ar-r}`, `{hc-t}`,
  `{g-101010101}` (cuadrícula 3×3), etc. dibujan figuras vectoriales; `?` marca el hueco.
- `npm test` valida ids únicos, 4 opciones distintas, figuras válidas y cantidad suficiente por tramo.

## Preguntas generadas

`npm run gen` regenera `src/data/questions/generated.json` a partir de las plantillas de `src/data/gen/`
(más de 50 tipos: carreras y colas, quién tiene qué, caballeros y bribones, cajas con etiquetas, sospechosos, silogismos,
condicionales, secuencias de cuadrículas, matrices, figuras y flechas, figura distinta, intrusos, analogías,
anagramas, palíndromos, códigos, series de letras y números, porcentajes, horas, balanzas, minisudokus,
orientación, recorridos, espejos, giros, simetrías, analogías visuales, sopas de letras, sinónimos…). Cada pregunta se comprueba con un solucionador por fuerza
bruta: solo se guarda si tiene una única respuesta. Se generan una vez y la app las incluye como datos fijos.

## Selección de preguntas

Cada partida se genera localmente:

- 20 preguntas sin repetición, respetando el tramo de dificultad de cada posición.
- Prioridad alta a preguntas no vistas; las vistas en las últimas partidas pierden peso.
- Nunca repite un mismo tipo de pregunta en una partida ni pone dos de la misma categoría seguidas.
- Equilibrio de categorías a lo largo de la partida.
- Rechazo de partidas casi idénticas a las 8 más recientes (nunca la misma secuencia).
- Orden de respuestas barajado en cada pregunta.

## Actualizaciones automáticas

Cada cambio publicado se despliega solo. La app comprueba si hay versión nueva cada vez que se
abre o vuelve a primer plano (con conexión) y la aplica con una recarga rápida **solo en la
pantalla de inicio**: nunca interrumpe una partida ni la pantalla de resultado. El progreso
y los récords se conservan.
