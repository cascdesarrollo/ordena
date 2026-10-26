import { runInTransaction } from '../db/connection';
import type { PedidoDescuentoView } from '../db/types';
import { listPagosPedido } from '../repositories/pedidoPagosRepository';
import {
  createPedidoDescuento,
  listDescuentosPedido,
  updatePedidoDescuentoStatus,
} from '../repositories/pedidoDescuentosRepository';
import { getPedido } from '../repositories/pedidosRepository';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';

const validarPedidoEditableSinPagos = async (pedidoId: number) => {
  const [pedido, pagos] = await Promise.all([getPedido(pedidoId), listPagosPedido(pedidoId)]);
  if (!pedido || pedido.status !== 'Activo') {
    throw new Error('Solo se pueden modificar descuentos en pedidos activos.');
  }
  if (pagos.some((pago) => pago.status === 'Activo')) {
    throw new Error('Anule primero los pagos vigentes para modificar los descuentos.');
  }
};

const montoTotalDescuentos = (descuentos: PedidoDescuentoView[]) =>
  descuentos
    .filter((descuento) => descuento.status === 'Activo')
    .reduce((total, descuento) => total + descuento.monto_usd, 0);

export const agregarDescuentoPedido = async (data: {
  pedidoId: number;
  detalleId: number | null;
  descripcion: string;
  montoUsd: number;
}): Promise<void> => {
  const descripcion = data.descripcion.trim();
  if (!descripcion) throw new Error('Indique una descripción para el descuento.');
  if (!Number.isFinite(data.montoUsd) || data.montoUsd <= 0) {
    throw new Error('El descuento debe ser un monto mayor a 0.');
  }

  await runInTransaction(async () => {
    await validarPedidoEditableSinPagos(data.pedidoId);
    const [detalle, descuentos] = await Promise.all([
      listPedidoDetalle(data.pedidoId),
      listDescuentosPedido(data.pedidoId),
    ]);
    const activas = detalle.filter((linea) => linea.status === 'Activa');
    const subtotal = activas.reduce((total, linea) => total + linea.monto, 0);
    const descuentosActivos = descuentos.filter((descuento) => descuento.status === 'Activo');
    const montoDescuentos = montoTotalDescuentos(descuentos);
    if (data.montoUsd > subtotal - montoDescuentos + 0.000001) {
      throw new Error('El descuento no puede superar el subtotal disponible del pedido.');
    }

    if (data.detalleId !== null) {
      const linea = activas.find((item) => item.id === data.detalleId);
      if (!linea) throw new Error('La línea seleccionada ya no está disponible.');
      const descuentosLinea = descuentosActivos
        .filter((descuento) => descuento.pedido_detalle_id === data.detalleId)
        .reduce((total, descuento) => total + descuento.monto_usd, 0);
      if (data.montoUsd > linea.monto - descuentosLinea + 0.000001) {
        throw new Error('El descuento supera el importe disponible de la línea seleccionada.');
      }
    }

    await createPedidoDescuento({
      ...data,
      descripcion,
    });
  });
};

export const anularDescuentoPedido = async (descuento: PedidoDescuentoView): Promise<void> => {
  await runInTransaction(async () => {
    await validarPedidoEditableSinPagos(descuento.pedido_id);
    const descuentos = await listDescuentosPedido(descuento.pedido_id);
    const actual = descuentos.find((item) => item.id === descuento.id);
    if (!actual || actual.status !== 'Activo') {
      throw new Error('El descuento ya no está activo. Recargue el pedido.');
    }
    await updatePedidoDescuentoStatus(actual.id, 'Anulado');
  });
};

export const validarCambioLineaConDescuentos = async (
  pedidoId: number,
  detalleId: number,
  nuevoMontoLinea: number
): Promise<void> => {
  const [detalle, descuentos] = await Promise.all([
    listPedidoDetalle(pedidoId),
    listDescuentosPedido(pedidoId),
  ]);
  const linea = detalle.find((item) => item.id === detalleId && item.status === 'Activa');
  if (!linea) throw new Error('La línea del pedido ya no está disponible.');
  if (descuentos.some(
    (item) => item.status === 'Activo' && item.pedido_detalle_id === detalleId
  )) {
    throw new Error('Anule primero el descuento asociado antes de modificar esta línea.');
  }

  const subtotalActual = detalle
    .filter((item) => item.status === 'Activa')
    .reduce((total, item) => total + item.monto, 0);
  const subtotalNuevo = subtotalActual - linea.monto + nuevoMontoLinea;
  if (subtotalNuevo + 0.000001 < montoTotalDescuentos(descuentos)) {
    throw new Error('El cambio dejaría descuentos superiores al subtotal. Anule un descuento primero.');
  }
};
