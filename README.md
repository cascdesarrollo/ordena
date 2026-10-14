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
- Reporte de pedidos por rango de fechas y estado.
- Exportación de la base de datos para respaldo.

## Módulos

### Home
- Indicadores del día: pedidos del día, pedidos activos y unidades de platos principales vendidas.
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

### Reporte
- Filtro por rango de fechas y estado del pedido.
- Detalle de cada pedido: líneas, totales y pagos.
- Acceso a los pagos del pedido y opción de **Reactivar** un pedido finalizado o anulado (requiere clave).

### Exportar DB
Acción del menú lateral que comparte una copia de la base de datos `ordena.db`.

## Tecnologías

- [Expo](https://expo.dev) SDK 54 (development build) · React Native 0.81 · React 19
- TypeScript
- React Navigation 7 (native stack + drawer)
- expo-sqlite (base de datos local)
- expo-file-system + expo-sharing (exportación de la BD)
- expo-crypto (hash de la clave especial)

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

## Estructura del proyecto

```
App.tsx                 # Entrada: inicializa la BD y monta la navegación
src/
  db/                   # Conexión, esquema, migraciones y tipos
  repositories/         # Acceso a datos (todo el SQL)
  services/             # Lógica de negocio: totales, pagos, mover productos, exportar, clave
  navigation/           # Stack y menú lateral
  screens/              # Pantallas de la app
  components/           # Componentes reutilizables (modales, selectores, resúmenes)
  styles/               # Tema y estilos comunes
  utils/                # Formato de fechas y números
```

## Pendientes

- **Impresión de tickets**: aún no implementada (el botón Imprimir muestra "Módulo en construcción").
- **Sincronización con servidor**: las tablas ya tienen la marca `pending_sync`, pero todavía no existe el backend.
