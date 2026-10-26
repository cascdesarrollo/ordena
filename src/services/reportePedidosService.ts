import { nowIso } from '../db/connection';
import type { PedidoReporte, ReporteFiltro, ReportePedidos } from '../db/types';
import { listPedidosByFechaStatus } from '../repositories/pedidosRepository';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';
import { listDescuentosPedido } from '../repositories/pedidoDescuentosRepository';
import { listPagosPedido } from '../repositories/pedidoPagosRepository';
import { validarRangoFechas } from '../utils/format';
import { getTotalesPedido } from './totalesService';

export const consultarReportePedidos = async (filtro: ReporteFiltro): Promise<ReportePedidos> => {
  validarRangoFechas(filtro.fechaInicio, filtro.fechaFin);
  if (!['Todos', 'Sin anulados', 'Activo', 'Finalizado', 'Anulado'].includes(filtro.status)) {
    throw new Error('Seleccione un estado de pedido válido.');
  }
  const pedidos = await listPedidosByFechaStatus(
    filtro.fechaInicio, filtro.fechaFin, filtro.status === 'Todos' ? undefined : filtro.status
  );
  const resultado: PedidoReporte[] = [];
  for (const pedido of pedidos) {
    const [detalle, descuentos, pagos] = await Promise.all([
      listPedidoDetalle(pedido.id),
      listDescuentosPedido(pedido.id),
      listPagosPedido(pedido.id),
    ]);
    resultado.push({
      pedido, detalle, descuentos, pagos,
      totales: await getTotalesPedido(pedido, detalle, descuentos),
    });
  }
  return {
    filtro: { ...filtro },
    consultadoEn: nowIso(),
    pedidos: resultado,
    totalUsd: resultado.reduce((total, item) => total + item.totales.totalUsd, 0),
  };
};
