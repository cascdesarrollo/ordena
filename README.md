# ORDENA

Aplicación móvil para llevar las **comandas (pedidos) y ventas de un restaurante**: mesas, productos, pedidos, pagos en varias divisas y reportes.

Funciona **100 % local**: no requiere servidor ni conexión a internet. Todos los datos se guardan en SQLite dentro del dispositivo.

## Características principales

- Pedidos por mesa o por nombre libre, con control de duplicados activos.
- Agregar productos con un toque y ajustar cantidades con − / +.
- Separar cuentas o mover productos entre pedidos.
- Pagos en **USD, COP y BS** con tasas de cambio configurables, más propina sugerida.
- Totales congelados al finalizar el pedido (snapshot de tasas y propina).
- Operaciones sensibles protegidas con una clave especial (anular, reactivar).
- Menú **Reportes** con pedidos por fecha/estado y pagos por fecha/forma de pago.
- Consulta e impresión de pagos en modo **Consolidado**, **Detallado** o **Ambos**, con totales por divisa.
- Exportación de la base de datos para respaldo.
- Impresión de tickets por Bluetooth clásico ESC/POS en Android, con formatos de 32 y 48 columnas.

## Módulos

### Home
- **Pedidos del día:** pedidos creados hoy (fecha local) activos o finalizados, sin anulados.
  Al tocarlo abre el reporte de hoy con el filtro **Sin anulados**.
- **Pedidos activos:** todos los pedidos activos, incluso de días anteriores.
- **Productos principal:** suma de unidades de tipo `Principal` en líneas activas de pedidos
  creados hoy que estén activos o finalizados; excluye pedidos anulados y líneas anuladas/movidas.
- Lista de pedidos activos.
- Botón **+** para crear un pedido: se elige una mesa o se escribe un nombre libre. No se permiten dos pedidos activos con el mismo nombre.

### Pedido
Detalle de un pedido, con nombre de mesa editable y tres pestañas:

| Pestaña | Funciones |
|---|---|
| **Productos** | Agregar productos (filtro por tipo), sumar/restar cantidades, editar cantidad a mano, anular líneas (requiere clave) y **separar / mover productos** a otro pedido existente o a uno nuevo. |
| **Pagos** | Registrar pagos con cualquier forma de pago activa (el monto se prellena con lo pendiente), ver total / pagado / pendiente o excedente en las 3 divisas y anular pagos (requiere clave). |
| **General** | Totales y propina sugerida por divisa, cantidades por tipo de producto, **Finalizar** pedido, **Anular** pedido (requiere clave) e Imprimir. |

Los pedidos finalizados o anulados se muestran en modo solo lectura. A los finalizados todavía se les pueden registrar pagos.

### Mesas
Catálogo de mesas (código, nombre, estado activo/inactivo). Sirve como lista de sugerencias al crear pedidos.

### Productos
Catálogo de productos con nombre, tipo (`Entrada`, `Bebidas`, `Postres`, `Principal`), precio en USD y estado.

### Formas de pago
Configuración de formas de pago (efectivo, pago móvil, transferencia, etc.) con su divisa (`USD`, `COP`, `BS`). Solo las activas aparecen al registrar pagos.

### Parámetros
| Código | Uso |
|---|---|
| `COP_USD` | Tasa de cambio pesos colombianos por dólar |
| `BS_USD` | Tasa de cambio bolívares por dólar |
| `TIP_SUGERIDO` | Porcentaje de propina sugerida |
| `SPECIAL_PASSWORD` | Clave para operaciones especiales (se guarda como hash) |
| `IMPRESORA_CONFIG` | Impresora, columnas y encabezado; se edita desde **Impresora y ticket**, no como texto libre |

### Impresión Bluetooth (Android)

1. Instalar un build actualizado con el módulo nativo: `npm install` y `npm run android`.
   Recargar JavaScript en un build anterior no agrega Bluetooth.
2. Encender la impresora y vincularla desde los ajustes Bluetooth de Android.
3. Abrir **Parámetros → Impresora y ticket → Actualizar lista** y conceder el permiso
   de dispositivos cercanos (Android 12 o superior). No se solicita ubicación ni se
   descubren dispositivos desde la app: se listan los ya vinculados.
4. Seleccionar la impresora. La lista también puede incluir otros dispositivos
   Bluetooth clásico: elegir únicamente una impresora compatible con ESC/POS/SPP.
5. Elegir **32 columnas** para la Digital POS DIG-P501A (48 mm de ancho imprimible,
   aproximadamente 384 puntos y fuente A de 12 puntos). El perfil de **48 columnas**
   es para impresoras con ese ancho disponible, habitualmente de 80 mm; no amplía
   el ancho físico de una impresora pequeña.
6. Escribir el encabezado (hasta 240 caracteres, admite varias líneas), comprobar
   la conexión, imprimir una prueba y pulsar **Guardar configuración**. La prueba
   usa los valores del formulario aunque todavía no se hayan guardado.
7. Usar **Imprimir** en la pestaña General del pedido, en **Reportes → Reporte de pedidos**
   o en **Reportes → Reporte de pagos** después de consultar.
   La conexión se reutiliza mientras esté disponible; si se perdió, se intenta
   conectar de nuevo al imprimir.

El ticket incluye encabezado, número de orden, mesa, estado, fecha/hora local de
creación, productos activos, cantidades, precios e importes en USD, totales en
USD/COP/Bs y tasas usadas. Los nombres largos pasan a varias líneas sin recortarse.
Los pedidos con snapshot conservan sus tasas y totales históricos; los demás usan
los parámetros actuales. La propina sugerida se muestra aparte y **no se suma al total**.
Las órdenes anuladas se identifican como tales.

Se utiliza fuente A normal y página de caracteres **PC850 (ESC t 2)** para español.
El ticket de prueba permite validar acentos y alineación con el firmware real.
Caracteres no representables en CP850, como emojis, producen un aviso en lugar de
enviar texto corrupto. No se envía corte automático, ya que la impresora portátil
puede no disponer de cortador.

No se reintenta automáticamente una escritura fallida para evitar duplicar tickets.
Si hay un error después de comenzar, revisar el papel antes de volver a imprimir.
Enviar los datos por Bluetooth **no confirma** que haya papel ni que la impresión
física haya terminado. La conexión SPP y el resultado en la DIG-P501A deben probarse
con la impresora real. La impresión no está habilitada para iOS ni web.

### Reportes
La entrada **Reportes** del menú lateral permite elegir entre pedidos, pagos y análisis de ventas.

#### Reporte de pedidos
- Filtro por rango de fechas y estado del pedido.
- **Sin anulados** incluye activos y finalizados; **Todos** conserva la consulta de todos los estados.
- Detalle de cada pedido: líneas, totales y pagos.
- Acceso a los pagos del pedido y opción de **Reactivar** un pedido finalizado o anulado (requiere clave).
- Los indicadores de Home siguen abriendo este reporte directamente con sus filtros.
- Seleccionar **Consolidado** o **Detallado**, consultar y pulsar **Imprimir reporte**.
  El consolidado identifica cada pedido con mesa, fecha, estado e importe USD, y un total general.
  El detallado añade productos (una fila por línea), descuentos, totales por divisa y pagos vigentes.
- El total general suma los pedidos seleccionados. Si incluye pedidos anulados, se advierte
  expresamente: ese total no representa ventas netas.
- Cambiar fechas o estado invalida los resultados hasta consultar nuevamente.
  La impresión usa los datos consultados y conserva los totales históricos de pedidos finalizados.

#### Reporte de pagos
1. Elegir fechas inicial/final (`YYYY-MM-DD`) y **Todas** o una forma de pago.
   El rango usa la **fecha local del pago**, no la fecha de creación del pedido.
2. Seleccionar **Consolidado**, **Detallado** o **Ambos** y pulsar **Consultar**.
3. Pulsar **Imprimir consolidado / detallado / ambos** para enviar los mismos resultados
   a la impresora Bluetooth configurada (Android, 32/48 columnas).

- Consolidado: cantidad de pagos e importe por forma de pago y divisa.
- Detallado: fecha/hora, número de pago y pedido, mesa, estado del pedido, importe,
  tasa guardada y equivalente USD; subtotales por grupo.
- Solo suman pagos vigentes. Las formas de pago inactivas siguen disponibles para
  consultar sus cobros históricos.
- Los pagos vigentes de pedidos anulados **se incluyen y se señalan con una advertencia**.
- Los totales USD, COP y BS se muestran separados. El equivalente total USD suma
  el `monto_usd` guardado de cada pago; no usa tasas actuales.
- Se agrupa por la divisa guardada en el pago, aunque la forma de pago cambie de divisa después.
- Cambiar fechas o forma de pago exige una nueva consulta antes de imprimir.
  Cambiar la presentación reutiliza la misma consulta. El ticket identifica el rango,
  la forma de pago y el momento de consulta.

Es un reporte de cobros: no sustituye un cierre de caja con aperturas, retiros o diferencias.

#### Análisis de ventas
- Solo incluye **pedidos finalizados**, filtrados por la fecha local de **creación del pedido**
  (no por fecha de pago ni por fecha de finalización).
- **Consolidado**, seleccionado por defecto: productos agrupados por tipo
  (Principal, Bebidas, Postres, Entrada), con cantidad total e importe original en USD por producto.
- **Detallado**: una fila por línea de pedido, con fecha del pedido, mesa, cantidad,
  precio unitario e importe. Por ejemplo, 5 unidades en un pedido y 2 en otro son **dos filas**;
  en el consolidado son 7 unidades. Si cambiaron los precios, se conserva el precio de cada línea.
- No incluye líneas anuladas ni movidas del origen; las líneas recibidas se contabilizan
  en el pedido destino si este está finalizado y dentro del período.
- Al final de pantalla y ticket: cantidades e importes por tipo, total de unidades,
  **venta bruta**, **descuentos** y **total neto** en USD.
- Los descuentos vigentes de los pedidos se restan **una sola vez** en el resumen general,
  sin repartirlos entre productos/tipos. No incluye propina.
- Pulsar **Consultar** y luego **Imprimir consolidado/detallado**. Usa la impresora configurada
  de 32/48 columnas y el mismo resultado consultado. Al cambiar el período hay que volver a consultar.
- Los nombres y tipos son los actuales del catálogo; cantidades, precios e importes son los
  guardados en las líneas de pedido. No requiere cambios de esquema.

### Exportar DB
Acción del menú lateral que comparte una copia de la base de datos `ordena.db`.

## Tecnologías

- [Expo](https://expo.dev) SDK 54 (development build) · React Native 0.81 · React 19
- TypeScript
- React Navigation 7 (native stack + drawer)
- expo-sqlite (base de datos local)
- expo-file-system + expo-sharing (exportación de la BD)
- expo-crypto (hash de la clave especial)
- react-native-bluetooth-classic (Bluetooth SPP, enlazado solo en Android)

## Requisitos

- Node.js LTS
- Android Studio (Android) o Xcode (iOS) para compilar el development build
- **No funciona con Expo Go**: usa módulos nativos y requiere un development build.

## Instalación y ejecución

```bash
npm install
npm run android   # compila e instala en emulador/dispositivo Android
npm run ios       # compila e instala en simulador/dispositivo iOS
npm run start     # inicia el servidor de desarrollo (con el dev build ya instalado)
```

Verificación de tipos:

```bash
npx tsc --noEmit
```

Pruebas de impresión (Node.js, sin impresora ni módulos nativos; usan TypeScript
ya instalado y el runner integrado de Node):

```bash
npm run test:impresion
```

## Estructura del proyecto

```
App.tsx                 # Entrada: inicializa la BD y monta la navegación
src/
  db/                   # Conexión, esquema, migraciones y tipos
  repositories/         # Acceso a datos (todo el SQL)
  services/             # Totales, pagos, mover productos, exportar, clave e impresión Bluetooth
  navigation/           # Stack y menú lateral
  screens/              # Pantallas de la app
  components/           # Componentes reutilizables (modales, selectores, resúmenes)
  styles/               # Tema y estilos comunes
  utils/                # Formato de fechas y números
```

## Pendientes

- **Impresión de tickets**: pendiente la validación física de conexión, acentos y ancho con la DIG-P501A.
- **Sincronización con servidor**: las tablas ya tienen la marca `pending_sync`, pero todavía no existe el backend.

## Generar APK de Android

### Opción 1: compilación local

Requiere Android Studio (SDK de Android) y JDK 17.

```bash
npm install
npx expo prebuild --platform android   # genera/actualiza la carpeta android/
cd android
./gradlew assembleRelease
```

El APK queda en:

```
android/app/build/outputs/apk/release/app-release.apk
```

Para instalarlo directamente en un dispositivo conectado por USB:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

O compilar e instalar en un solo paso:

```bash
npx expo run:android --variant release
```

> Por defecto el APK de release se firma con la clave de depuración. Sirve para instalarlo directamente en los dispositivos del restaurante, pero no para publicarlo en Google Play. Para Play Store hay que configurar una clave de firma propia.

### Opción 2: EAS Build (compilación en la nube de Expo)

Requiere una cuenta gratuita en [expo.dev](https://expo.dev).

```bash
npm install -g eas-cli
eas login
eas build:configure
```

En el `eas.json` generado, agregar un perfil que produzca APK en lugar de AAB:

```json
{
  "build": {
    "apk": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Y compilar:

```bash
eas build --platform android --profile apk
```

Al terminar, EAS muestra un enlace (y un código QR) para descargar el APK.
