import { executeSql, nowIso } from '../db/connection';
import type { Pedido, StatusPedido, TotalesPedido } from '../db/types';

export const createPedido = async (mesaNombre: string): Promise<number> => {
  const now = nowIso();
  const result = await executeSql(
    `INSERT INTO pedidos (mesa_nombre, status, created_at, updated_at, pending_sync)
     VALUES (?, 'Activo', ?, ?, 1);`,
    [mesaNombre.trim(), now, now]
  );
  return result.insertId ?? 0;
};

export const updatePedidoMesaNombre = async (id: number, mesaNombre: string): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedidos
     SET mesa_nombre = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [mesaNombre.trim(), now, id]
  );
};

export const updatePedidoStatus = async (id: number, status: StatusPedido): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedidos
     SET status = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [status, now, id]
  );
};

export const finalizarPedido = async (id: number, totales: TotalesPedido): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedidos
     SET status = 'Finalizado', tasa_cop = ?, tasa_bs = ?, propina_pct = ?,
         total_usd = ?, total_cop = ?, total_bs = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [
      totales.tasaCop,
      totales.tasaBs,
      totales.propinaPct,
      totales.totalUsd,
      totales.totalCop,
      totales.totalBs,
      now,
      id,
    ]
  );
};

// Al reactivar se borra el snapshot: las líneas pueden cambiar y se recalcula al volver a finalizar.
export const reactivarPedido = async (id: number): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedidos
     SET status = 'Activo', tasa_cop = NULL, tasa_bs = NULL, propina_pct = NULL,
         total_usd = NULL, total_cop = NULL, total_bs = NULL, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [now, id]
  );
};

export const getPedido = async (id: number): Promise<Pedido | null> => {
  const result = await executeSql('SELECT * FROM pedidos WHERE id = ?;', [id]);
  if (result.rows.length === 0) return null;
  return result.rows.item(0) as Pedido;
};

export const listPedidosActivos = async (): Promise<Pedido[]> => {
  const result = await executeSql(
    'SELECT * FROM pedidos WHERE status = ? ORDER BY created_at DESC;',
    ['Activo']
  );
  return result.rows._array as Pedido[];
};

export const hasActiveOrderWithMesaName = async (
  mesaNombre: string,
  excludeId?: number
): Promise<boolean> => {
  const result = await executeSql(
    `SELECT COUNT(*) as count
     FROM pedidos
     WHERE status = 'Activo'
       AND LOWER(mesa_nombre) = LOWER(?)
       ${excludeId ? 'AND id <> ?' : ''};`,
    excludeId ? [mesaNombre.trim(), excludeId] : [mesaNombre.trim()]
  );
  const count = result.rows.item(0)?.count ?? 0;
  return count > 0;
};

export const listPedidosByFechaStatus = async (
  startDate: string,
  endDate: string,
  status?: StatusPedido
): Promise<Pedido[]> => {
  const params: (string | number)[] = [startDate, endDate];
  const statusClause = status ? 'AND status = ?' : '';
  if (status) params.push(status);

  const result = await executeSql(
    `SELECT * FROM pedidos
     WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
     ${statusClause}
     ORDER BY created_at DESC;`,
    params
  );
  return result.rows._array as Pedido[];
};

export const getPedidosIndicadores = async (): Promise<{
  pedidosDia: number;
  pedidosActivos: number;
  principalesDia: number;
}> => {
  const pedidosDiaResult = await executeSql(
    `SELECT COUNT(*) as count
     FROM pedidos
     WHERE date(created_at, 'localtime') = date('now', 'localtime');`
  );

  const pedidosActivosResult = await executeSql(
    `SELECT COUNT(*) as count
     FROM pedidos
     WHERE status = 'Activo';`
  );

  const principalesResult = await executeSql(
    `SELECT COALESCE(SUM(pd.cantidad), 0) as count
     FROM pedido_detalle pd
     JOIN pedidos p ON p.id = pd.pedido_id
     JOIN productos i ON i.id = pd.producto_id
     WHERE date(p.created_at, 'localtime') = date('now', 'localtime')
       AND pd.status = 'Activa'
       AND i.tipo = 'Principal';`
  );

  return {
    pedidosDia: pedidosDiaResult.rows.item(0)?.count ?? 0,
    pedidosActivos: pedidosActivosResult.rows.item(0)?.count ?? 0,
    principalesDia: principalesResult.rows.item(0)?.count ?? 0,
  };
};
