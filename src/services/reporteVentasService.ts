import type {
  ProductoTipo, ProductoVendido, RangoReporte, ReportePedidos, ReporteVentas, VentasPorTipo,
} from '../db/types';
import { consultarReportePedidos } from './reportePedidosService';

const tipos: ProductoTipo[] = ['Principal', 'Bebidas', 'Postres', 'Entrada'];

export const construirReporteVentas = (pedidos: ReportePedidos): ReporteVentas => {
  const grupos = new Map<ProductoTipo, Map<number, ProductoVendido>>();
  let cantidadPedidos = 0;
  let descuentosUsd = 0;
  for (const { pedido, detalle, descuentos } of pedidos.pedidos) {
    if (pedido.status !== 'Finalizado') continue;
    cantidadPedidos += 1;
    descuentosUsd += descuentos.filter((d) => d.status === 'Activo')
      .reduce((sum, d) => sum + d.monto_usd, 0);
    for (const linea of detalle) {
      if (linea.status !== 'Activa') continue;
      if (!tipos.includes(linea.producto_tipo) ||
          !Number.isFinite(linea.cantidad) || linea.cantidad <= 0 ||
          !Number.isFinite(linea.precio) || linea.precio < 0 ||
          !Number.isFinite(linea.monto) || linea.monto < 0) {
        throw new Error(`La línea #${linea.id} contiene datos de venta no válidos.`);
      }
      let productos = grupos.get(linea.producto_tipo);
      if (!productos) {
        productos = new Map();
        grupos.set(linea.producto_tipo, productos);
      }
      let producto = productos.get(linea.producto_id);
      if (!producto) {
        producto = {
          productoId: linea.producto_id, nombre: linea.producto_nombre,
          cantidad: 0, montoUsd: 0, lineas: [],
        };
        productos.set(linea.producto_id, producto);
      }
      producto.cantidad += linea.cantidad;
      producto.montoUsd += linea.monto;
      producto.lineas.push({
        ...linea, mesa_nombre: pedido.mesa_nombre, fecha_pedido: pedido.created_at,
      });
    }
  }
  const resumen: VentasPorTipo[] = tipos.map((tipo) => {
    const productos = Array.from(grupos.get(tipo)?.values() ?? [])
      .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.productoId - b.productoId);
    for (const producto of productos) {
      producto.lineas.sort((a, b) =>
        a.fecha_pedido.localeCompare(b.fecha_pedido) || a.pedido_id - b.pedido_id || a.linea - b.linea
      );
    }
    return {
      tipo, productos,
      cantidad: productos.reduce((sum, p) => sum + p.cantidad, 0),
      montoUsd: productos.reduce((sum, p) => sum + p.montoUsd, 0),
    };
  });
  const brutoUsd = resumen.reduce((sum, g) => sum + g.montoUsd, 0);
  if (!Number.isFinite(descuentosUsd) || descuentosUsd < 0 || descuentosUsd > brutoUsd + 0.000001) {
    throw new Error('Los descuentos del período no son válidos para el importe de las ventas.');
  }
  return {
    filtro: { fechaInicio: pedidos.filtro.fechaInicio, fechaFin: pedidos.filtro.fechaFin },
    consultadoEn: pedidos.consultadoEn,
    grupos: resumen,
    cantidadPedidos,
    cantidad: resumen.reduce((sum, g) => sum + g.cantidad, 0),
    brutoUsd, descuentosUsd, netoUsd: Math.max(0, brutoUsd - descuentosUsd),
  };
};

export const consultarReporteVentas = async (filtro: RangoReporte): Promise<ReporteVentas> =>
  construirReporteVentas(await consultarReportePedidos({ ...filtro, status: 'Finalizado' }));
