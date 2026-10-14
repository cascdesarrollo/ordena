import { executeSql, nowIso } from '../db/connection';
import type { Divisa, PedidoPagoView, StatusPago } from '../db/types';

export const listPagosPedido = async (pedidoId: number): Promise<PedidoPagoView[]> => {
  const result = await executeSql(
    `SELECT pp.*, fp.nombre as forma_pago_nombre
     FROM pedido_pagos pp
     JOIN formas_pago fp ON fp.id = pp.forma_pago_id
     WHERE pp.pedido_id = ?
     ORDER BY pp.created_at ASC;`,
    [pedidoId]
  );
  return result.rows._array as PedidoPagoView[];
};

export const createPedidoPago = async (data: {
  pedidoId: number;
  formaPagoId: number;
  divisa: Divisa;
  monto: number;
  tasa: number;
  montoUsd: number;
}): Promise<number> => {
  const now = nowIso();
  const result = await executeSql(
    `INSERT INTO pedido_pagos
      (pedido_id, forma_pago_id, divisa, monto, tasa, monto_usd, status, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, 'Activo', ?, ?, 1);`,
    [data.pedidoId, data.formaPagoId, data.divisa, data.monto, data.tasa, data.montoUsd, now, now]
  );
  return result.insertId ?? 0;
};

export const updatePedidoPagoStatus = async (id: number, status: StatusPago): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE pedido_pagos
     SET status = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [status, now, id]
  );
};
