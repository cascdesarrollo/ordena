import { executeSql, nowIso } from '../db/connection';
import type { PedidoDetalle, PedidoDetalleView, StatusLinea } from '../db/types';

export const listPedidoDetalle = async (pedidoId: number): Promise<PedidoDetalleView[]> => {
  const result = await executeSql(
    `SELECT pd.*, i.nombre as producto_nombre, i.tipo as producto_tipo,
            po.mesa_nombre as origen_mesa_nombre
     FROM pedido_detalle pd
     JOIN productos i ON i.id = pd.producto_id
     LEFT JOIN pedidos po ON po.id = pd.origen_pedido_id
     WHERE pd.pedido_id = ?
     ORDER BY pd.linea ASC;`,
    [pedidoId]
  );
  return result.rows._array as PedidoDetalleView[];
};

export const createPedidoDetalle = async (data: {
  pedidoId: number;
  productoId: number;
  linea: number;
  cantidad: number;
  precio: number;
  origenPedidoId?: number;
  origenDetalleId?: number;
}): Promise<number> => {
  const now = nowIso();
  const monto = data.cantidad * data.precio;
  const result = await executeSql(
    `INSERT INTO pedido_detalle
      (pedido_id, producto_id, linea, cantidad, precio, monto, status,
       origen_pedido_id, origen_detalle_id, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, 'Activa', ?, ?, ?, ?, 1);`,
    [
      data.pedidoId,
      data.productoId,
      data.linea,
      data.cantidad,
      data.precio,
      monto,
      data.origenPedidoId ?? null,
      data.origenDetalleId ?? null,
      now,
      now,
    ]
  );
  return result.insertId ?? 0;
};

export const updatePedidoDetalleCantidad = async (
  id: number,
  cantidad: number,
  precio: number
): Promise<void> => {
  const now = nowIso();
  const monto = cantidad * precio;
  await executeSql(
    `UPDATE pedido_detalle
     SET cantidad = ?, monto = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [cantidad, monto, now, id]
  );
};

export const updatePedidoDetalleStatus = async (
  id: number,
  status: StatusLinea
): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedido_detalle
     SET status = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [status, now, id]
  );
};

export const nextLineaForPedido = async (pedidoId: number): Promise<number> => {
  const result = await executeSql(
    `SELECT COALESCE(MAX(linea), 0) + 1 as nextLinea
     FROM pedido_detalle
     WHERE pedido_id = ?;`,
    [pedidoId]
  );
  return result.rows.item(0)?.nextLinea ?? 1;
};

export const getPedidoDetalle = async (id: number): Promise<PedidoDetalle | null> => {
  const result = await executeSql('SELECT * FROM pedido_detalle WHERE id = ?;', [id]);
  return (result.rows.item(0) as PedidoDetalle | undefined) ?? null;
};

// Línea activa del destino donde sumar lo movido: mismo producto, precio y pedido de origen.
export const findLineaDestino = async (data: {
  pedidoId: number;
  productoId: number;
  precio: number;
  origenPedidoId: number;
}): Promise<PedidoDetalle | null> => {
  const result = await executeSql(
    `SELECT * FROM pedido_detalle
     WHERE pedido_id = ? AND producto_id = ? AND precio = ? AND origen_pedido_id = ?
       AND status = 'Activa'
       AND NOT EXISTS (
         SELECT 1 FROM pedido_descuentos d
         WHERE d.pedido_detalle_id = pedido_detalle.id AND d.status = 'Activo'
       )
     ORDER BY linea ASC
     LIMIT 1;`,
    [data.pedidoId, data.productoId, data.precio, data.origenPedidoId]
  );
  return (result.rows.item(0) as PedidoDetalle | undefined) ?? null;
};
