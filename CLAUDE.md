# ORDENA — contexto del proyecto

App móvil para llevar comandas (pedidos) y ventas de un restaurante. **Todo es local**: no hay backend ni API; los datos viven en SQLite dentro del dispositivo. Idioma de la UI, del código de dominio y de la BD: **español**.

## Stack

- **Expo SDK 54** (`expo-dev-client`, se usa *development build*, no Expo Go) · React Native 0.81 · React 19.1 · New Architecture activada
- **TypeScript** estricto (`tsconfig.json` extiende `expo/tsconfig.base`)
- **Navegación**: `@react-navigation` v7 — native-stack + drawer
- **Persistencia**: `expo-sqlite` (API síncrona `openDatabaseSync`, BD `ordena.db`)
- **Otros**: `@react-native-picker/picker`, `expo-file-system` (API nueva `File`/`Paths`; la API legacy como `copyAsync` lanza error en SDK 54) + `expo-sharing` (exportar BD), `expo-crypto` (hash de la clave especial), `react-native-reanimated` 4 + `react-native-worklets` (requeridos por el drawer)
- **Impresión Android**: `react-native-bluetooth-classic` (SPP/RFCOMM + ESC/POS), excluido del autolinking iOS en `react-native.config.js`. Permisos declarados en `app.json`; Android 12+ pide dispositivos cercanos (CONNECT/SCAN). Solo se listan dispositivos ya vinculados, sin descubrimiento ni permisos de ubicación.
- **Icono y splash**: `assets/icon.png` (1024, fondo blanco), `assets/adaptive-icon.png` (logo al ~62% por la zona segura de Android), `assets/splash-icon.png` vía plugin `expo-splash-screen` en `app.json` (`imageWidth: 140` para que el logo quepa en la máscara circular de Android 12+). Cambiarlos exige `npx expo prebuild --clean` + recompilar.
- `babel.config.js` solo usa `babel-preset-expo`, que ya agrega el plugin de worklets; no añadir `react-native-reanimated/plugin` a mano.
- Dependencias nativas nuevas → instalar con `npx expo install` y recompilar el dev build.
- Sin librería de estado global (solo `useState` por pantalla), sin UI kit ni linter. Pruebas de impresión con el runner de Node y TypeScript ya instalado, sin módulos nativos.
- `android/` e `ios/` son carpetas nativas **generadas** (prebuild) e ignoradas en git: no editarlas a mano, configurar vía `app.json`.

## Comandos

```bash
npm install
npm run start          # expo start (dev client)
npm run android        # expo run:android (compila nativo)
npm run ios            # expo run:ios
npx tsc --noEmit       # verificación de tipos; correrla tras cada cambio
npm run test:impresion # formato, totales, reportes de pagos y Bluetooth simulado
```

## Estructura

```
index.ts / App.tsx         # entrada: initDatabase() → muestra spinner → RootNavigator dentro de SafeAreaView edges=['bottom'] (edge-to-edge: evita que la barra de navegación de Android tape FAB/listas)
src/
  db/
    connection.ts          # getDb(), executeSql(sql, params), nowIso(), runInTransaction()
    schema.ts              # CREATE TABLE/INDEX + seed de parámetros
    migrations.ts          # initDatabase(): aplica schema, migraciones ad-hoc y seed
    types.ts               # interfaces y uniones de status/tipo (fuente de verdad de tipos)
  repositories/            # TODO el SQL vive aquí; una función async por operación
    mesasRepository.ts | productosRepository.ts | parametrosRepository.ts
    pedidosRepository.ts | pedidoDetalleRepository.ts
    formasPagoRepository.ts | pedidoPagosRepository.ts | pedidoDescuentosRepository.ts
    impresoraRepository.ts # configuración tipada de impresora en parametros (JSON)
  services/
    exportService.ts       # checkpoint WAL + copia la BD a cache y la comparte
    passwordService.ts     # hash/verificación de SPECIAL_PASSWORD (usar siempre este servicio)
    printService.ts        # ticket de pedido y reporte de pagos consultado (sin volver a consultar); envía ESC/POS
    bluetoothPrinterService.ts # permisos, vinculados, conexión SPP, envíos exclusivos por bloques
    totalesService.ts      # totales USD/COP/BS + propina; snapshot al finalizar (finalizarPedidoConTotales)
    pagosService.ts        # divisas, tasaDivisa(), resumirPagos() (pagado vs total, tolerancia 0.01 USD)
    reportePagosService.ts # valida fechas, consulta pagos vigentes y agrupa por forma/divisa guardada; snapshot para UI/impresión
    reportePedidosService.ts # snapshot de pedidos, líneas, descuentos, pagos y totales históricos para reporte e impresión
    reporteVentasService.ts # solo finalizados por fecha de creación; agrupa líneas activas por tipo/producto, descuentos globales
    descuentosService.ts   # descuentos fijos en USD, solo pedidos activos sin pagos vigentes; valida límites y líneas
    moverService.ts        # moverProductos(): separar cuentas / pasar líneas a otro pedido (en transacción)
  utils/
    format.ts              # localDateString() (YYYY-MM-DD local), parseDecimal() (acepta coma)
    ticket.ts              # ticket 32/48 columnas, ajuste de líneas y codificación CP850
  navigation/
    RootNavigator.tsx      # Stack: Drawer | Pedido {pedidoId, tab?} | Reporte (ReporteFiltro opcional) | ReportePagos | ReporteVentas
    DrawerNavigator.tsx    # Home | Mesas | Productos | Parametros | Reportes | FormasPago + acción "Exportar DB"; logo (`icon.png`) arriba del menú lateral; Home usa `assets/logo-horizontal.png` como título del header (solo ahí), las demás pantallas su título de texto
  screens/                 # una pantalla por archivo, lógica + UI juntas
  components/              # FloatingActionButton, ModalContainer, PasswordPrompt, SegmentedTabs, SelectPicker, TotalesResumen, PagosResumen, DescuentosResumen
  styles/                  # theme.ts (colors, spacing, radius) y common.ts (commonStyles)
```

## Modelo de datos (SQLite)

Todas las tablas tienen `created_at`, `updated_at` (ISO string UTC vía `nowIso()`) y `pending_sync INTEGER DEFAULT 1`. `pending_sync` se pone en 1 en cada insert/update: está **preparado para una futura sincronización con backend** que aún no existe. Mantener esa convención en tablas y escrituras nuevas.

| Tabla | Campos clave | Notas |
|---|---|---|
| `mesas` | id, codigo, nombre, status `Activo/Inactivo` | Solo catálogo de sugerencias; no hay FK desde pedidos |
| `productos` | id, nombre, tipo, status, precio (USD) | tipo: `Entrada/Bebidas/Postres/Principal` |
| `parametros` | **codigo (PK)**, descripcion, tipo `Texto/Numerico`, valor (TEXT) | Seed fijo; no se crean desde la UI, solo se edita `valor` |
| `pedidos` | id, mesa_nombre (texto libre), status `Activo/Finalizado/Anulado`, tasa_cop, tasa_bs, propina_pct, total_usd, total_cop, total_bs | `mesa_nombre` libre **a propósito** (permite cualquier mesa/nombre). Regla: no puede haber dos pedidos `Activo` con el mismo nombre (case-insensitive). Las columnas de tasas/totales son un snapshot (NULL hasta finalizar) que se guarda al **Finalizar** y se borra al **Reactivar**; si es NULL se calcula con los parámetros actuales |
| `pedido_detalle` | id, pedido_id, producto_id, linea, cantidad, precio, monto, status `Activa/Anulada/Movida`, origen_pedido_id, origen_detalle_id | `precio` se copia del producto al agregar; `monto = cantidad * precio` se guarda. Al mover productos: mover parte baja la cantidad en el origen, mover todo deja la línea `Movida` (no es anulación); en el destino se crea línea con el precio original y `origen_*` (o se suma a una del mismo producto/precio/origen) |
| `pedido_descuentos` | id, pedido_id, pedido_detalle_id (opcional), descripcion, monto_usd, status `Activo/Anulado` | Monto fijo positivo en USD; puede asociarse a una línea o al pedido completo. Solo se agrega/anula con pedido `Activo` y sin pagos `Activo`; requiere clave especial. No puede superar el subtotal disponible. |
| `formas_pago` | id, nombre, divisa `USD/COP/BS`, status `Activo/Inactivo` | Configurables (menú Formas de pago). Seed con formas de Venezuela si la tabla está vacía (`formasPagoSeed`) |
| `pedido_pagos` | id, pedido_id, forma_pago_id, divisa, monto, tasa, monto_usd, status `Activo/Anulado` | `monto` en la divisa de la forma de pago; `divisa`, `tasa` (unidades por USD) y `monto_usd = monto / tasa` se copian al registrar. La tasa es la del pedido (snapshot si está finalizado, si no la actual) |

Parámetros sembrados: `COP_USD`, `BS_USD` (tasas de cambio), `TIP_SUGERIDO` (% de propina sugerida; se muestra en los totales y se congela en `propina_pct` al finalizar), `SPECIAL_PASSWORD` (clave para operaciones especiales; si está vacía, esas operaciones quedan bloqueadas), `IMPRESORA_CONFIG` (JSON tipado con `direccion`, `nombre`, `columnas` 32/48 y `encabezado`; se agrega también en BDs existentes con migración idempotente, sin sobrescribir ajustes). La configuración de impresora se edita solo con el formulario dedicado de Parámetros, no con el editor genérico.

`SPECIAL_PASSWORD` se guarda como hash `sha256$<salt>$<hash>` (ver `passwordService.ts`). `initDatabase` convierte a hash una clave antigua en texto plano. Nunca leer/comparar `valor` directamente: usar `verifySpecialPassword()` y `setSpecialPassword()`. Los parámetros numéricos se guardan normalizados con punto decimal y ≥ 0.

No hay borrados físicos: se "elimina" cambiando `status` (Inactivo / Anulado / Anulada / Movida).

## Funcionalidad por pantalla

- **Home** — "Pedidos del día" cuenta pedidos creados hoy (fecha local) con status Activo/Finalizado, sin anulados. "Productos principal" suma cantidades solo de tipo `Principal`, líneas `Activa`, en esos mismos pedidos del día; excluye pedidos anulados y líneas Anulada/Movida. "Pedidos activos" y su lista incluyen activos de cualquier fecha. Tocar "Pedidos del día" abre Reporte filtrado por hoy/**Sin anulados** (nuevo `StatusPedidoFiltro`, Activo + Finalizado; `Todos` sigue incluyendo anulados); "Pedidos activos" abre Reporte con status Activo desde la fecha del activo más antiguo. FAB → modal "Nuevo pedido": elegir mesa activa o escribir nombre libre; valida que no exista otro pedido **activo** con el mismo nombre (case-insensitive). Al crear navega a `Pedido`.
- **Pedido** (stack con header propio "Pedido #id" y flecha de volver, recibe `pedidoId` y `tab` opcional) — Si el pedido no está `Activo`, la pantalla es de **solo lectura** (sin agregar/editar líneas, finalizar ni anular; solo Imprimir). Nombre de mesa editable (guarda en `onBlur`, valida vacío y duplicado activo). Tabs:
  - *Productos*: líneas activas; FAB → agregar producto (filtro por tipo, orden Principal→Bebidas→Postres→Entrada, luego nombre). Tocar un producto lo agrega con cantidad 1 y cierra el modal (sin botón Aceptar); si ya hay una línea activa sin descuento asociado le suma 1, si no crea otra línea. Cada línea tiene botones − / + (de uno en uno, actualización optimista con `detalleRef`); bajar de 1 pide anular la línea. Tocar el centro de la línea abre el modal para editar la cantidad a mano (debe ser > 0). Anular línea requiere `SPECIAL_PASSWORD`. Las líneas con descuentos asociados quedan bloqueadas para editar/mover hasta anular el descuento. Se pueden agregar descuentos de monto fijo en USD con descripción y asociación opcional a una línea; agregar/anular requiere `SPECIAL_PASSWORD` y solo está permitido en pedidos activos sin pagos vigentes. El descuento total no puede superar el subtotal. Botón **Separar / mover productos** (solo pedido activo): destino = pedido activo existente o "Nuevo pedido…" (valida nombre duplicado), cantidad a mover por línea con − / +; sin clave; avisa si el origen tiene pagos; al terminar ofrece ir al destino (`navigation.push`). Las líneas recibidas muestran "Movido de <mesa>".
  - *Pagos*: lista de pagos activos + total/pagado/pendiente o excedente (propina) en las 3 divisas. FAB → agregar pago (forma de pago + monto, prellenado con lo pendiente en esa divisa). Se permiten pagos mayores o menores al total, pero si el pagado resultante ≠ total se pide confirmación. Cada pago tiene botón Anular (confirmación + clave). Se pueden registrar pagos en pedidos `Activo` **y `Finalizado`** (no en `Anulado`).
  - *General*: tabla `TotalesResumen` (subtotal, descuento, total y propina sugerida por divisa USD/COP/BS; valores guardados si el pedido está finalizado, si no con tasas actuales), detalle de descuentos, cantidades por tipo, botones Imprimir (Bluetooth Android), Finalizar (confirmación; si los pagos no cuadran con el total lo indica y ofrece "Agregar pago") y Anular pedido (requiere clave).
- **Mesas** / **Productos** — CRUD simple con lista + FAB + modal (crear/editar, cambiar status). Precio de producto ≥ 0.
- **Parámetros** — Lista y edición del `valor`; valida numérico ≥ 0 si `tipo = Numerico`. La clave especial se muestra como "Configurada/Sin configurar"; cambiarla pide la clave actual (si existe) y confirmación.
  - **Impresora y ticket** (Android): modal `ImpresoraConfig` para elegir dispositivo vinculado, abrir ajustes Bluetooth, comprobar conexión, seleccionar 32/48 columnas, editar encabezado multilinea (1–240 caracteres), imprimir prueba y guardar. Predeterminado: 32 columnas, encabezado ORDENA, sin impresora. La prueba usa el formulario; Pedido/Reporte usan la configuración guardada.
- **Reportes** — Pantalla de entrada del menú lateral con **Reporte de pedidos**, **Reporte de pagos** y **Análisis de ventas**. Los reportes se abren en el stack con flecha para volver.
  - **Reporte de pedidos** (`ReporteScreen`, ruta `Reporte`) — Filtro por rango de fechas locales (texto `YYYY-MM-DD`) y status. Acepta params opcionales `ReporteFiltro` desde Home (se aplican y luego se limpian con `replaceParams`). Al tocar un pedido abre su detalle (líneas activas `cantidad x precio`, descuentos, monto y `TotalesResumen`) y sus pagos, con Imprimir, Pagos (abre `Pedido` en la pestaña Pagos; no para anulados) y, si no está activo, Reactivar (requiere clave y que no haya otro pedido activo con esa mesa). Los tickets incluyen cada descuento y sus equivalencias USD/COP/BS.
  - **Reporte de pagos** (`ReportePagosScreen`) — Rango por `date(pp.created_at, 'localtime')`, no fecha del pedido; fechas válidas y rango inclusivo. Todas las formas de pago o una, incluyendo inactivas. Solo pagos `Activo`, sin excluir pedidos anulados: estos cobros se incluyen y se advierten. Presentación **Consolidado / Detallado / Ambos** en pantalla e impresión Bluetooth 32/48 columnas. Agrupa por `forma_pago_id` + `pp.divisa` histórica; totales separados USD/COP/BS y equivalente USD sumando `pp.monto_usd`, nunca tasas actuales. Detalle con fecha, pago, pedido, mesa, estado, monto y tasa guardada, con subtotales por grupo. Al cambiar fechas/forma se invalida la consulta e impresión hasta volver a consultar; cambiar presentación usa el mismo resultado. Imprime el snapshot consultado con filtros y fecha/hora, sin reconsultar pagos. No es un cierre de caja.
  - **Impresión del reporte de pedidos** — Consolidado: cada pedido con mesa, fecha, estado y total USD; detallado: añade líneas activas, descuentos, totales por divisa y pagos vigentes. Total general USD de todos los pedidos seleccionados, con advertencia si incluye anulados (no representa ventas netas). Snapshot consultado, sin reconsultar al imprimir; filtros editados invalidan resultado y botón hasta consultar otra vez. El ticket individual sigue disponible en el modal.
  - **Análisis de ventas** (`ReporteVentasScreen`) — Solo pedidos `Finalizado`, por fecha local de creación del pedido. Reutiliza la consulta de pedidos. Consolidado por defecto: productos por tipo (Principal/Bebidas/Postres/Entrada), suma de cantidades e importes originales USD. Detallado: una fila por línea activa de pedido (5 y 2 unidades en pedidos distintos son 2 filas), fecha del pedido/mesa/cantidad/precio/importe. Excluye líneas Anulada/Movida; cuenta recibidas en el destino finalizado. Nombres/tipos actuales del catálogo, precios y montos guardados en líneas. Pantalla e impresión 32/48 columnas finalizan con resumen por tipo, cantidad total, venta bruta, descuentos vigentes de los pedidos una sola vez y neto USD; sin reparto de descuentos por producto/tipo ni propina. Sin cambios de esquema. Cambiar fechas invalida resultado e impresión; cambiar presentación reutiliza snapshot.
- **Formas de pago** — CRUD (nombre único case-insensitive, divisa, status). Solo las activas aparecen al agregar pagos.
- **Menú lateral → Exportar DB** — Acción (no pantalla) que comparte una copia de `ordena.db`.

## Convenciones a seguir

- **SQL solo en `src/repositories/`**, siempre con parámetros `?` y vía `executeSql` (detecta `SELECT`/`PRAGMA` por regex y devuelve `rows._array`; para otros comandos devuelve `insertId`/`changes`). Si un SQL nuevo devuelve filas y no empieza por esas palabras, ampliar la regex o llegará vacío. Las pantallas nunca llaman a `getDb()` directamente.
- Tipos nuevos o valores de status/tipo → agregarlos en `src/db/types.ts` y reutilizarlos.
- **Cambios de esquema**: agregar `CREATE TABLE IF NOT EXISTS` en `schema.ts`; para alterar tablas existentes, añadir una migración idempotente en `migrations.ts` (patrón usado: revisar `PRAGMA table_info` / `sqlite_master` y migrar solo si hace falta). No hay tabla de versión de esquema; los dispositivos pueden tener datos reales, nunca asumir BD vacía.
- Nuevos parámetros: añadirlos a `parametrosSeed` **y** tener en cuenta que el seed solo corre si la tabla está vacía → en BDs existentes hay que insertarlos con una migración (`INSERT ... WHERE NOT EXISTS`).
- **Fechas**: guardar siempre en UTC con `nowIso()`; al filtrar/agrupar por día usar `date(created_at, 'localtime')` en SQL y `localDateString()` en JS. Nunca `toISOString().slice(0,10)` para "hoy".
- **Números ingresados por el usuario**: parsear con `parseDecimal()` (acepta coma) y validar rango; teclado `decimal-pad`.
- Pantallas: componente funcional exportado con nombre (`export const XScreen`), carga datos en `loadData` con `useFocusEffect(useCallback(...))`, recarga tras cada escritura, modales con `ModalContainer`, alta con `FloatingActionButton`, selects con `SelectPicker` (nunca `Picker` directo: en Android con el sistema en modo oscuro el texto sale blanco sobre blanco; `userInterfaceStyle: light` no basta sin `expo-system-ui`), operaciones sensibles con `PasswordPrompt` + `verifySpecialPassword()`.
- Scroll en pantallas pequeñas: pantallas de lista con FAB usan `[commonStyles.screen, commonStyles.screenWithFab]` y la tarjeta de lista `[commonStyles.card, commonStyles.listCard]` (la lista hace scroll interno sin quedar bajo el "+"). Pantallas largas (Pedido, Reporte) usan un `ScrollView` raíz y renderizan listas con `.map` (no `FlatList` anidado). `ModalContainer` hace scroll por defecto y respeta las áreas seguras; pasar `scroll={false}` si el contenido ya tiene su propia lista/ScrollView (con `flexShrink: 1`).
- Estilos: `commonStyles` + tokens de `theme.ts`; estilos específicos en `StyleSheet.create` al final del archivo. No introducir colores sueltos si existe token.
- Nueva pantalla de menú → registrar en `DrawerNavigator.tsx` y en `DrawerParamList`; pantalla con parámetros → `RootNavigator.tsx` y `RootStackParamList`.
- Textos de UI en español.

## Pendientes conocidos

- **Impresión de tickets**: implementada para Android con ESC/POS/SPP; falta validación física con Digital POS DIG-P501A (32 columnas, 48 mm imprimibles, fuente A). Formato alternativo de 48 columnas para equipos compatibles. Ticket con líneas activas, precios del pedido, fecha/hora local de creación y totales de `getTotalesPedido()`; propina aparte. CP850 (`ESC t 2`) admite español, rechaza caracteres no representables y neutraliza controles en los textos. Envía por bloques con espera proporcional a las líneas, sin corte automático ni reintento de escrituras fallidas. Éxito de envío no confirma papel/impresión física. Sin soporte de impresión para iOS/web.
- La clave especial está hasheada, pero la app es local y "Exportar DB" entrega la BD completa: es protección básica, no fuerte.
- `expo`, `expo-dev-client` y `expo-file-system` tienen actualizaciones de parche pendientes (`npx expo install --check`).

## Mantener este archivo

Si un cambio altera stack, esquema, pantallas, convenciones o resuelve/crea una deuda de la lista anterior, actualizar este `CLAUDE.md` en el mismo cambio.
