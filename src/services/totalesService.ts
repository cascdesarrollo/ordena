import type {
  Pedido,
  PedidoDescuento,
  PedidoDetalle,
  TasasPedido,
  TotalesPedido,
} from '../db/types';
import { getTasasActuales } from '../repositories/parametrosRepository';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';
import { listDescuentosPedido } from '../repositories/pedidoDescuentosRepository';
import { finalizarPedido } from '../repositories/pedidosRepository';

export const calcularTotales = (
  detalle: PedidoDetalle[],
  tasas: TasasPedido,
  descuentos: PedidoDescuento[] = []
): TotalesPedido => {
  const subtotalUsd = detalle
    .filter((d) => d.status === 'Activa')
    .reduce((sum, d) => sum + d.monto, 0);
  const descuentoUsd = descuentos
    .filter((descuento) => descuento.status === 'Activo')
    .reduce((sum, descuento) => sum + descuento.monto_usd, 0);
  const totalUsd = subtotalUsd - descuentoUsd;
  if (totalUsd < -0.000001) throw new Error('Los descuentos superan el subtotal del pedido.');
  return {
    ...tasas,
    subtotalUsd,
    descuentoUsd,
    totalUsd: Math.max(totalUsd, 0),
    totalCop: Math.max(totalUsd, 0) * tasas.tasaCop,
    totalBs: Math.max(totalUsd, 0) * tasas.tasaBs,
    historico: false,
  };
};

// Pedido finalizado con snapshot → valores guardados; si no, cálculo con parámetros actuales.
export const getTotalesPedido = async (
  pedido: Pedido,
  detalle: PedidoDetalle[],
  descuentos: PedidoDescuento[] = []
): Promise<TotalesPedido> => {
  const descuentoUsd = descuentos
    .filter((descuento) => descuento.status === 'Activo')
    .reduce((sum, descuento) => sum + descuento.monto_usd, 0);
  if (pedido.total_usd !== null && pedido.total_usd !== undefined) {
    const totalUsd = pedido.total_usd;
    return {
      tasaCop: pedido.tasa_cop ?? 0,
      tasaBs: pedido.tasa_bs ?? 0,
      propinaPct: pedido.propina_pct ?? 0,
      subtotalUsd: totalUsd + descuentoUsd,
      descuentoUsd,
      totalUsd,
      totalCop: pedido.total_cop ?? 0,
      totalBs: pedido.total_bs ?? 0,
      historico: true,
    };
  }
  return calcularTotales(detalle, await getTasasActuales(), descuentos);
};

// Finaliza guardando tasas, % de propina y totales vigentes en este momento.
export const finalizarPedidoConTotales = async (pedidoId: number): Promise<void> => {
  const [detalle, descuentos, tasas] = await Promise.all([
    listPedidoDetalle(pedidoId),
    listDescuentosPedido(pedidoId),
    getTasasActuales(),
  ]);
  await finalizarPedido(pedidoId, calcularTotales(detalle, tasas, descuentos));
};
