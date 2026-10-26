import type { ConfiguracionImpresora, Divisa } from './types';

export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT NOT NULL,
    precio REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS parametros (
    codigo TEXT PRIMARY KEY,
    descripcion TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_nombre TEXT NOT NULL,
    status TEXT NOT NULL,
    tasa_cop REAL,
    tasa_bs REAL,
    propina_pct REAL,
    total_usd REAL,
    total_cop REAL,
    total_bs REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS pedido_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    linea INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    precio REAL NOT NULL,
    monto REAL NOT NULL,
    status TEXT NOT NULL,
    origen_pedido_id INTEGER,
    origen_detalle_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS formas_pago (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    divisa TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS pedido_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    forma_pago_id INTEGER NOT NULL,
    divisa TEXT NOT NULL,
    monto REAL NOT NULL,
    tasa REAL NOT NULL,
    monto_usd REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS pedido_descuentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    pedido_detalle_id INTEGER,
    descripcion TEXT NOT NULL,
    monto_usd REAL NOT NULL CHECK (monto_usd > 0),
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pending_sync INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);`,
  `CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_pedido_detalle_pedido ON pedido_detalle(pedido_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pedido_pagos_pedido ON pedido_pagos(pedido_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pedido_descuentos_pedido ON pedido_descuentos(pedido_id);`,
];

// Se insertan solo si la tabla formas_pago está vacía (también en BDs existentes: la tabla es nueva).
export const formasPagoSeed: { nombre: string; divisa: Divisa }[] = [
  { nombre: 'Efectivo COP', divisa: 'COP' },
  { nombre: 'Bancolombia', divisa: 'COP' },
  { nombre: 'Efectivo USD', divisa: 'USD' },
  { nombre: 'Zelle', divisa: 'USD' },
  { nombre: 'Punto', divisa: 'BS' },
  { nombre: 'Pago movil', divisa: 'BS' },
  { nombre: 'Binance', divisa: 'USD' },
];

export const parametroImpresoraSeed = {
  codigo: 'IMPRESORA_CONFIG',
  descripcion: 'Configuración de impresora y ticket',
  tipo: 'Texto',
  valor: JSON.stringify({
    direccion: '',
    nombre: '',
    columnas: 32,
    encabezado: 'ORDENA',
  } satisfies ConfiguracionImpresora),
};

export const parametrosSeed = [
  parametroImpresoraSeed,
  {
    codigo: 'COP_USD',
    descripcion: 'Tasa de cambio de pesos a dolares',
    tipo: 'Numerico',
    valor: '0',
  },
  {
    codigo: 'BS_USD',
    descripcion: 'Tasa de cambio de bolivares a dolares',
    tipo: 'Numerico',
    valor: '0',
  },
  {
    codigo: 'TIP_SUGERIDO',
    descripcion: '% de propina sugerida',
    tipo: 'Numerico',
    valor: '0',
  },
  {
    codigo: 'SPECIAL_PASSWORD',
    descripcion: 'Password para operaciones especiales',
    tipo: 'Texto',
    valor: '',
  },
];
