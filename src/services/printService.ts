import type { ConfiguracionImpresora } from '../db/types';
import { getConfiguracionImpresora } from '../repositories/impresoraRepository';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';
import { getPedido } from '../repositories/pedidosRepository';
import { codificarTicketEscPos, crearTicketPedido, crearTicketPrueba } from '../utils/ticket';
import { enviarTicketBluetooth } from './bluetoothPrinterService';
import { getTotalesPedido } from './totalesService';

export const printOrderTicket = async (orderId: number): Promise<void> => {
  const [configuracion, pedido, detalle] = await Promise.all([
    getConfiguracionImpresora(),
    getPedido(orderId),
    listPedidoDetalle(orderId),
  ]);
  if (!pedido) throw new Error('El pedido que desea imprimir no existe.');
  const totales = await getTotalesPedido(pedido, detalle);
  const ticket = crearTicketPedido(pedido, detalle, totales, configuracion);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};

export const imprimirTicketPrueba = async (
  configuracion: ConfiguracionImpresora
): Promise<void> => {
  const ticket = crearTicketPrueba(configuracion);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};
