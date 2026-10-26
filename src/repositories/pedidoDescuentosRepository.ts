import { executeSql, nowIso } from '../db/connection';
import type { PedidoDescuentoView, StatusDescuento } from '../db/types';

export const listDescuentosPedido = async (pedidoId: number): Promise<PedidoDescuentoView[]> => {
  const result = await executeSql(
    `SELECT pd.*, pr.nombre as producto_nombre,
            d.linea as producto_linea, d.cantidad as producto_cantidad,
            d.precio as producto_precio
     FROM pedido_descuentos pd
     LEFT JOIN pedido_detalle d ON d.id = pd.pedido_detalle_id
     LEFT JOIN productos pr ON pr.id = d.producto_id
     WHERE pd.pedido_id = ?
     ORDER BY pd.created_at ASC, pd.id ASC;`,
    [pedidoId]
  );
  return result.rows._array as PedidoDescuentoView[];
};

export const createPedidoDescuento = async (data: {
  pedidoId: number;
  detalleId: number | null;
  descripcion: string;
  montoUsd: number;
}): Promise<number> => {
  const now = nowIso();
  const result = await executeSql(
    `INSERT INTO pedido_descuentos
      (pedido_id, pedido_detalle_id, descripcion, monto_usd, status, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, 'Activo', ?, ?, 1);`,
    [data.pedidoId, data.detalleId, data.descripcion, data.montoUsd, now, now]
  );
  return result.insertId ?? 0;
};

export const updatePedidoDescuentoStatus = async (
  id: number,
  status: StatusDescuento
): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedido_descuentos
     SET status = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [status, now, id]
  );
};
