export type StatusActivo = 'Activo' | 'Inactivo';
export type StatusPedido = 'Activo' | 'Finalizado' | 'Anulado';
// Movida: la línea completa se pasó a otro pedido (separar cuentas); no es una anulación.
export type StatusLinea = 'Activa' | 'Anulada' | 'Movida';
export type ProductoTipo = 'Entrada' | 'Bebidas' | 'Postres' | 'Principal';
export type Divisa = 'USD' | 'COP' | 'BS';
export type StatusPago = 'Activo' | 'Anulado';

export interface Mesa {
  id: number;
  codigo: string;
  nombre: string;
  status: StatusActivo;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

export interface Producto {
  id: number;
  nombre: string;
  tipo: ProductoTipo;
  status: StatusActivo;
  precio: number;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

export interface Parametro {
  codigo: string;
  descripcion: string;
  tipo: 'Texto' | 'Numerico';
  valor: string;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

export type ColumnasTicket = 32 | 48;

export interface ImpresoraBluetooth {
  direccion: string;
  nombre: string;
}

export interface ConfiguracionImpresora extends ImpresoraBluetooth {
  columnas: ColumnasTicket;
  encabezado: string;
}

export interface Pedido {
  id: number;
  mesa_nombre: string;
  status: StatusPedido;
  // Snapshot guardado al finalizar; NULL si el pedido nunca se finalizó (o fue reactivado).
  tasa_cop: number | null;
  tasa_bs: number | null;
  propina_pct: number | null;
  total_usd: number | null;
  total_cop: number | null;
  total_bs: number | null;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

export interface PedidoDetalle {
  id: number;
  pedido_id: number;
  producto_id: number;
  linea: number;
  cantidad: number;
  precio: number;
  monto: number;
  status: StatusLinea;
  // Si la línea llegó desde otro pedido al separar/mover productos.
  origen_pedido_id: number | null;
  origen_detalle_id: number | null;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

export interface TasasPedido {
  tasaCop: number;
  tasaBs: number;
  propinaPct: number;
}

export interface TotalesPedido extends TasasPedido {
  totalUsd: number;
  totalCop: number;
  totalBs: number;
  // true = valores guardados al finalizar; false = calculados con los parámetros actuales.
  historico: boolean;
}

export interface FormaPago {
  id: number;
  nombre: string;
  divisa: Divisa;
  status: StatusActivo;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

// monto en la divisa de la forma de pago; tasa (divisa por USD) y monto_usd se fijan al registrarlo.
export interface PedidoPago {
  id: number;
  pedido_id: number;
  forma_pago_id: number;
  divisa: Divisa;
  monto: number;
  tasa: number;
  monto_usd: number;
  status: StatusPago;
  created_at: string;
  updated_at: string;
  pending_sync: number;
}

export interface PedidoPagoView extends PedidoPago {
  forma_pago_nombre: string;
}

export type PedidoTab = 'Productos' | 'General' | 'Pagos';

export type StatusPedidoFiltro = StatusPedido | 'Todos';

// Filtros con los que se puede abrir la pantalla Reporte (p. ej. desde los indicadores de Home).
export interface ReporteFiltro {
  fechaInicio: string;
  fechaFin: string;
  status: StatusPedidoFiltro;
}

export interface PedidoDetalleView extends PedidoDetalle {
  producto_nombre: string;
  producto_tipo: ProductoTipo;
  origen_mesa_nombre: string | null;
}
