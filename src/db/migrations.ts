import { executeSql, nowIso } from './connection';
import { formasPagoSeed, parametrosSeed, schemaStatements } from './schema';
import { migrateSpecialPassword } from '../services/passwordService';

export const initDatabase = async () => {
  for (const statement of schemaStatements) {
    await executeSql(statement);
  }

  const itemsTable = await executeSql<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='items';"
  );

  if (itemsTable.rows.length > 0) {
    const productosCount = await executeSql<{ count: number }>(
      'SELECT COUNT(*) as count FROM productos;'
    );
    const countProductos = productosCount.rows.item(0)?.count ?? 0;

    if (countProductos === 0) {
      await executeSql(
        `INSERT INTO productos (id, nombre, tipo, status, precio, created_at, updated_at, pending_sync)
         SELECT id, nombre, tipo, status, precio, created_at, updated_at, pending_sync FROM items;`
      );
    }

    await executeSql('DROP TABLE IF EXISTS items;');
  }

  const detalleColumns = await executeSql<{ name: string }>(
    'PRAGMA table_info(pedido_detalle);'
  );
  const hasItemId = detalleColumns.rows._array.some((col) => col.name === 'item_id');

  if (hasItemId) {
    await executeSql(
      `CREATE TABLE IF NOT EXISTS pedido_detalle_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        linea INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio REAL NOT NULL,
        monto REAL NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        pending_sync INTEGER NOT NULL DEFAULT 1
      );`
    );

    await executeSql(
      `INSERT INTO pedido_detalle_new
        (id, pedido_id, producto_id, linea, cantidad, precio, monto, status, created_at, updated_at, pending_sync)
       SELECT id, pedido_id, item_id, linea, cantidad, precio, monto, status, created_at, updated_at, pending_sync
       FROM pedido_detalle;`
    );

    await executeSql('DROP TABLE pedido_detalle;');
    await executeSql('ALTER TABLE pedido_detalle_new RENAME TO pedido_detalle;');
  }

  // Totales congelados al finalizar (tasas y propina del momento). NULL = sin snapshot.
  const pedidosColumns = await executeSql<{ name: string }>('PRAGMA table_info(pedidos);');
  const pedidosColumnNames = pedidosColumns.rows._array.map((col) => col.name);
  for (const column of ['tasa_cop', 'tasa_bs', 'propina_pct', 'total_usd', 'total_cop', 'total_bs']) {
    if (!pedidosColumnNames.includes(column)) {
      await executeSql(`ALTER TABLE pedidos ADD COLUMN ${column} REAL;`);
    }
  }

  // Trazabilidad al mover productos entre pedidos.
  const detalleColumnNames = (
    await executeSql<{ name: string }>('PRAGMA table_info(pedido_detalle);')
  ).rows._array.map((col) => col.name);
  for (const column of ['origen_pedido_id', 'origen_detalle_id']) {
    if (!detalleColumnNames.includes(column)) {
      await executeSql(`ALTER TABLE pedido_detalle ADD COLUMN ${column} INTEGER;`);
    }
  }

  const existing = await executeSql('SELECT COUNT(*) as count FROM parametros');
  const count = existing.rows.item(0)?.count ?? 0;

  if (count === 0) {
    for (const param of parametrosSeed) {
      await executeSql(
        `INSERT INTO parametros (codigo, descripcion, tipo, valor, created_at, updated_at, pending_sync)
         VALUES (?, ?, ?, ?, ?, ?, 1);`,
        [
          param.codigo,
          param.descripcion,
          param.tipo,
          param.valor,
          nowIso(),
          nowIso(),
        ]
      );
    }
  }

  const formasPagoCount = await executeSql('SELECT COUNT(*) as count FROM formas_pago');
  if ((formasPagoCount.rows.item(0)?.count ?? 0) === 0) {
    for (const forma of formasPagoSeed) {
      const now = nowIso();
      await executeSql(
        `INSERT INTO formas_pago (nombre, divisa, status, created_at, updated_at, pending_sync)
         VALUES (?, ?, 'Activo', ?, ?, 1);`,
        [forma.nombre, forma.divisa, now, now]
      );
    }
  }

  await migrateSpecialPassword();
};
