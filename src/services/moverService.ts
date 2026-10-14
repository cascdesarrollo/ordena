import { runInTransaction } from '../db/connection';
import {
  createPedidoDetalle,
  findLineaDestino,
  getPedidoDetalle,
  nextLineaForPedido,
  updatePedidoDetalleCantidad,
  updatePedidoDetalleStatus,
} from '../repositories/pedidoDetalleRepository';
import { createPedido, getPedido, hasActiveOrderWithMesaName } from '../repositories/pedidosRepository';

export type DestinoMovimiento = { pedidoId: number } | { nuevoNombre: string };

export interface CantidadAMover {
  detalleId: number;
  cantidad: number;
}

// Mueve cantidades de líneas activas de un pedido a otro (existente o nuevo) y devuelve el id del destino.
// - Parte de una línea: el origen baja su cantidad.
// - Línea completa: el origen queda con status 'Movida'.
// - En el destino se conserva el precio original y se registra el pedido/línea de origen.
export const moverProductos = async (
  origenPedidoId: number,
  destino: DestinoMovimiento,
  items: CantidadAMover[]
): Promise<number> => {
  const aMover = items.filter((i) => i.cantidad > 0);
  if (aMover.length === 0) throw new Error('Seleccione al menos un producto para mover.');

  const origen = await getPedido(origenPedidoId);
  if (!origen || origen.status !== 'Activo') throw new Error('El pedido de origen no está activo.');

  if ('nuevoNombre' in destino) {
    const nombre = destino.nuevoNombre.trim();
    if (!nombre) throw new Error('Indique el nombre del nuevo pedido.');
    if (await hasActiveOrderWithMesaName(nombre)) {
      throw new Error('Ya existe un pedido activo con ese nombre.');
    }
  } else {
    if (destino.pedidoId === origenPedidoId) throw new Error('El destino debe ser otro pedido.');
    const pedidoDestino = await getPedido(destino.pedidoId);
    if (!pedidoDestino || pedidoDestino.status !== 'Activo') {
      throw new Error('El pedido destino no está activo.');
    }
  }

  let destinoId = 'pedidoId' in destino ? destino.pedidoId : 0;

  await runInTransaction(async () => {
    if ('nuevoNombre' in destino) {
      destinoId = await createPedido(destino.nuevoNombre);
    }

    for (const item of aMover) {
      const linea = await getPedidoDetalle(item.detalleId);
      if (!linea || linea.pedido_id !== origenPedidoId || linea.status !== 'Activa') {
        throw new Error('Una de las líneas ya no está disponible. Recargue el pedido.');
      }
      if (item.cantidad > linea.cantidad) {
        throw new Error('La cantidad a mover supera la cantidad de la línea.');
      }

      const restante = linea.cantidad - item.cantidad;
      if (restante > 0) {
        await updatePedidoDetalleCantidad(linea.id, restante, linea.precio);
      } else {
        await updatePedidoDetalleStatus(linea.id, 'Movida');
      }

      const existente = await findLineaDestino({
        pedidoId: destinoId,
        productoId: linea.producto_id,
        precio: linea.precio,
        origenPedidoId,
      });
      if (existente) {
        await updatePedidoDetalleCantidad(existente.id, existente.cantidad + item.cantidad, existente.precio);
      } else {
        await createPedidoDetalle({
          pedidoId: destinoId,
          productoId: linea.producto_id,
          linea: await nextLineaForPedido(destinoId),
          cantidad: item.cantidad,
          precio: linea.precio,
          origenPedidoId,
          origenDetalleId: linea.id,
        });
      }
    }
  });

  return destinoId;
};
