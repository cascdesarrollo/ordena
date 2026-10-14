import type { Pedido, PedidoDetalle, TasasPedido, TotalesPedido } from '../db/types';
import { getTasasActuales } from '../repositories/parametrosRepository';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';
import { finalizarPedido } from '../repositories/pedidosRepository';

export const calcularTotales = (
  detalle: PedidoDetalle[],
  tasas: TasasPedido
): TotalesPedido => {
  const totalUsd = detalle
    .filter((d) => d.status === 'Activa')
    .reduce((sum, d) => sum + d.monto, 0);
  return {
    ...tasas,
    totalUsd,
    totalCop: totalUsd * tasas.tasaCop,
    totalBs: totalUsd * tasas.tasaBs,
    historico: false,
  };
};

// Pedido finalizado con snapshot → valores guardados; si no, cálculo con parámetros actuales.
export const getTotalesPedido = async (
  pedido: Pedido,
  detalle: PedidoDetalle[]
): Promise<TotalesPedido> => {
  if (pedido.total_usd !== null && pedido.total_usd !== undefined) {
    return {
      tasaCop: pedido.tasa_cop ?? 0,
      tasaBs: pedido.tasa_bs ?? 0,
      propinaPct: pedido.propina_pct ?? 0,
      totalUsd: pedido.total_usd,
      totalCop: pedido.total_cop ?? 0,
      totalBs: pedido.total_bs ?? 0,
      historico: true,
    };
  }
  return calcularTotales(detalle, await getTasasActuales());
};

// Finaliza guardando tasas, % de propina y totales vigentes en este momento.
export const finalizarPedidoConTotales = async (pedidoId: number): Promise<void> => {
  const [detalle, tasas] = await Promise.all([listPedidoDetalle(pedidoId), getTasasActuales()]);
  await finalizarPedido(pedidoId, calcularTotales(detalle, tasas));
};
