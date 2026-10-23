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
npm run test:impresion # formato, totales y Bluetooth simulado
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
    formasPagoRepository.ts | pedidoPagosRepository.ts
    impresoraRepository.ts # configuración tipada de impresora en parametros (JSON)
  services/
    exportService.ts       # checkpoint WAL + copia la BD a cache y la comparte
    passwordService.ts     # hash/verificación de SPECIAL_PASSWORD (usar siempre este servicio)
    printService.ts        # carga pedido/detalle, getTotalesPedido() y envía ticket ESC/POS
    bluetoothPrinterService.ts # permisos, vinculados, conexión SPP, envíos exclusivos por bloques
    totalesService.ts      # totales USD/COP/BS + propina; snapshot al finalizar (finalizarPedidoConTotales)
    pagosService.ts        # divisas, tasaDivisa(), resumirPagos() (pagado vs total, tolerancia 0.01 USD)
    moverService.ts        # moverProductos(): separar cuentas / pasar líneas a otro pedido (en transacción)
  utils/
    format.ts              # localDateString() (YYYY-MM-DD local), parseDecimal() (acepta coma)
    ticket.ts              # ticket 32/48 columnas, ajuste de líneas y codificación CP850
  navigation/
    RootNavigator.tsx      # Stack: Drawer | Pedido {pedidoId, tab?}
    DrawerNavigator.tsx    # Home | Mesas | Productos | Parametros | Reporte | FormasPago + acción "Exportar DB"; logo (`icon.png`) arriba del menú lateral; Home usa `assets/logo-horizontal.png` como título del header (solo ahí), las demás pantallas su título de texto
  screens/                 # una pantalla por archivo, lógica + UI juntas
  components/              # FloatingActionButton, ModalContainer, PasswordPrompt, SegmentedTabs, SelectPicker, TotalesResumen, PagosResumen
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
| `formas_pago` | id, nombre, divisa `USD/COP/BS`, status `Activo/Inactivo` | Configurables (menú Formas de pago). Seed con formas de Venezuela si la tabla está vacía (`formasPagoSeed`) |
| `pedido_pagos` | id, pedido_id, forma_pago_id, divisa, monto, tasa, monto_usd, status `Activo/Anulado` | `monto` en la divisa de la forma de pago; `divisa`, `tasa` (unidades por USD) y `monto_usd = monto / tasa` se copian al registrar. La tasa es la del pedido (snapshot si está finalizado, si no la actual) |

Parámetros sembrados: `COP_USD`, `BS_USD` (tasas de cambio), `TIP_SUGERIDO` (% de propina sugerida; se muestra en los totales y se congela en `propina_pct` al finalizar), `SPECIAL_PASSWORD` (clave para operaciones especiales; si está vacía, esas operaciones quedan bloqueadas), `IMPRESORA_CONFIG` (JSON tipado con `direccion`, `nombre`, `columnas` 32/48 y `encabezado`; se agrega también en BDs existentes con migración idempotente, sin sobrescribir ajustes). La configuración de impresora se edita solo con el formulario dedicado de Parámetros, no con el editor genérico.

`SPECIAL_PASSWORD` se guarda como hash `sha256$<salt>$<hash>` (ver `passwordService.ts`). `initDatabase` convierte a hash una clave antigua en texto plano. Nunca leer/comparar `valor` directamente: usar `verifySpecialPassword()` y `setSpecialPassword()`. Los parámetros numéricos se guardan normalizados con punto decimal y ≥ 0.

No hay borrados físicos: se "elimina" cambiando `status` (Inactivo / Anulado / Anulada / Movida).

## Funcionalidad por pantalla

- **Home** — Indicadores del día (pedidos del día, pedidos activos, unidades de tipo `Principal` vendidas hoy) y lista de pedidos activos. Tocar "Pedidos del día" abre Reporte filtrado por hoy/Todos; "Pedidos activos" abre Reporte con status Activo desde la fecha del activo más antiguo. FAB → modal "Nuevo pedido": elegir mesa activa o escribir nombre libre; valida que no exista otro pedido **activo** con el mismo nombre (case-insensitive). Al crear navega a `Pedido`.
- **Pedido** (stack con header propio "Pedido #id" y flecha de volver, recibe `pedidoId` y `tab` opcional) — Si el pedido no está `Activo`, la pantalla es de **solo lectura** (sin agregar/editar líneas, finalizar ni anular; solo Imprimir). Nombre de mesa editable (guarda en `onBlur`, valida vacío y duplicado activo). Tabs:
  - *Productos*: líneas activas; FAB → agregar producto (filtro por tipo, orden Principal→Bebidas→Postres→Entrada, luego nombre). Tocar un producto lo agrega con cantidad 1 y cierra el modal (sin botón Aceptar); si ya hay una línea activa de ese producto le suma 1. Cada línea tiene botones − / + (de uno en uno, actualización optimista con `detalleRef`); bajar de 1 pide anular la línea. Tocar el centro de la línea abre el modal para editar la cantidad a mano (debe ser > 0). Anular línea requiere `SPECIAL_PASSWORD`. Botón **Separar / mover productos** (solo pedido activo): destino = pedido activo existente o "Nuevo pedido…" (valida nombre duplicado), cantidad a mover por línea con − / +; sin clave; avisa si el origen tiene pagos; al terminar ofrece ir al destino (`navigation.push`). Las líneas recibidas muestran "Movido de <mesa>".
  - *Pagos*: lista de pagos activos + total/pagado/pendiente o excedente (propina) en las 3 divisas. FAB → agregar pago (forma de pago + monto, prellenado con lo pendiente en esa divisa). Se permiten pagos mayores o menores al total, pero si el pagado resultante ≠ total se pide confirmación. Cada pago tiene botón Anular (confirmación + clave). Se pueden registrar pagos en pedidos `Activo` **y `Finalizado`** (no en `Anulado`).
  - *General*: tabla `TotalesResumen` (total y propina sugerida por divisa USD/COP/BS; valores guardados si el pedido está finalizado, si no con tasas actuales), cantidades por tipo, botones Imprimir (Bluetooth Android), Finalizar (confirmación; si los pagos no cuadran con el total lo indica y ofrece "Agregar pago") y Anular pedido (requiere clave).
- **Mesas** / **Productos** — CRUD simple con lista + FAB + modal (crear/editar, cambiar status). Precio de producto ≥ 0.
- **Parámetros** — Lista y edición del `valor`; valida numérico ≥ 0 si `tipo = Numerico`. La clave especial se muestra como "Configurada/Sin configurar"; cambiarla pide la clave actual (si existe) y confirmación.
  - **Impresora y ticket** (Android): modal `ImpresoraConfig` para elegir dispositivo vinculado, abrir ajustes Bluetooth, comprobar conexión, seleccionar 32/48 columnas, editar encabezado multilinea (1–240 caracteres), imprimir prueba y guardar. Predeterminado: 32 columnas, encabezado ORDENA, sin impresora. La prueba usa el formulario; Pedido/Reporte usan la configuración guardada.
- **Reporte** — Filtro por rango de fechas locales (texto `YYYY-MM-DD`) y status. Acepta params opcionales `ReporteFiltro` (se aplican y luego se limpian con `replaceParams`). Al tocar un pedido abre su detalle (líneas activas `cantidad x precio`, monto y `TotalesResumen`) y sus pagos, con Imprimir, Pagos (abre `Pedido` en la pestaña Pagos; no para anulados) y, si no está activo, Reactivar (requiere clave y que no haya otro pedido activo con esa mesa).
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
- Estilos: `commonStyles` + tokens de `theme.ts`; estilos específicos en `StyleSheet.create` al final del archivo. No introducir colores sueltos si existe token.
- Nueva pantalla de menú → registrar en `DrawerNavigator.tsx` y en `DrawerParamList`; pantalla con parámetros → `RootNavigator.tsx` y `RootStackParamList`.
- Textos de UI en español.

## Pendientes conocidos

- **Impresión de tickets**: implementada para Android con ESC/POS/SPP; falta validación física con Digital POS DIG-P501A (32 columnas, 48 mm imprimibles, fuente A). Formato alternativo de 48 columnas para equipos compatibles. Ticket con líneas activas, precios del pedido, fecha/hora local de creación y totales de `getTotalesPedido()`; propina aparte. CP850 (`ESC t 2`) admite español, rechaza caracteres no representables y neutraliza controles en los textos. Envía por bloques con espera proporcional a las líneas, sin corte automático ni reintento de escrituras fallidas. Éxito de envío no confirma papel/impresión física. Sin soporte de impresión para iOS/web.
- La clave especial está hasheada, pero la app es local y "Exportar DB" entrega la BD completa: es protección básica, no fuerte.
- `expo`, `expo-dev-client` y `expo-file-system` tienen actualizaciones de parche pendientes (`npx expo install --check`).

## Mantener este archivo

Si un cambio altera stack, esquema, pantallas, convenciones o resuelve/crea una deuda de la lista anterior, actualizar este `CLAUDE.md` en el mismo cambio.
