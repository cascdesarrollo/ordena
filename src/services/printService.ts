import type {
  ConfiguracionImpresora, PresentacionReportePagos, ReportePagos,
  PresentacionReporte, ReportePedidos, ReporteVentas,
} from '../db/types';
import { getConfiguracionImpresora } from '../repositories/impresoraRepository';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';
import { getPedido } from '../repositories/pedidosRepository';
import { listDescuentosPedido } from '../repositories/pedidoDescuentosRepository';
import {
  codificarTicketEscPos,
  crearTicketPedido,
  crearTicketPrueba,
  crearTicketReportePagos,
  crearTicketReportePedidos,
  crearTicketReporteVentas,
} from '../utils/ticket';
import { enviarTicketBluetooth } from './bluetoothPrinterService';
import { getTotalesPedido } from './totalesService';

export const printOrderTicket = async (orderId: number): Promise<void> => {
  const [configuracion, pedido, detalle, descuentos] = await Promise.all([
    getConfiguracionImpresora(),
    getPedido(orderId),
    listPedidoDetalle(orderId),
    listDescuentosPedido(orderId),
  ]);
  if (!pedido) throw new Error('El pedido que desea imprimir no existe.');
  const totales = await getTotalesPedido(pedido, detalle, descuentos);
  const ticket = crearTicketPedido(pedido, detalle, totales, configuracion, descuentos);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};

export const imprimirTicketPrueba = async (
  configuracion: ConfiguracionImpresora
): Promise<void> => {
  const ticket = crearTicketPrueba(configuracion);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};

export const imprimirReportePagos = async (
  reporte: ReportePagos,
  presentacion: PresentacionReportePagos
): Promise<void> => {
  const configuracion = await getConfiguracionImpresora();
  const ticket = crearTicketReportePagos(reporte, presentacion, configuracion);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};

export const imprimirReportePedidos = async (
  reporte: ReportePedidos,
  presentacion: PresentacionReporte
): Promise<void> => {
  const configuracion = await getConfiguracionImpresora();
  const ticket = crearTicketReportePedidos(reporte, presentacion, configuracion);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};

export const imprimirReporteVentas = async (
  reporte: ReporteVentas,
  presentacion: PresentacionReporte
): Promise<void> => {
  const configuracion = await getConfiguracionImpresora();
  const ticket = crearTicketReporteVentas(reporte, presentacion, configuracion);
  await enviarTicketBluetooth(configuracion.direccion, codificarTicketEscPos(ticket));
};
