import { nowIso } from '../db/connection';
import type {
  GrupoReportePagos,
  PagoReporteView,
  ReportePagos,
  ReportePagosFiltro,
} from '../db/types';
import { listFormasPago } from '../repositories/formasPagoRepository';
import { listPagosReporte } from '../repositories/pedidoPagosRepository';
import { validarRangoFechas } from '../utils/format';

export const validarFiltroReportePagos = (filtro: ReportePagosFiltro): void => {
  validarRangoFechas(filtro.fechaInicio, filtro.fechaFin);
  if (filtro.formaPagoId !== null &&
      (!Number.isSafeInteger(filtro.formaPagoId) || filtro.formaPagoId <= 0)) {
    throw new Error('Seleccione una forma de pago válida.');
  }
};

export const construirReportePagos = (
  pagos: PagoReporteView[],
  filtro: ReportePagosFiltro,
  formaPagoNombre: string,
  consultadoEn: string
): ReportePagos => {
  const grupos = new Map<string, GrupoReportePagos>();
  const reporte: ReportePagos = {
    filtro: { ...filtro },
    formaPagoNombre,
    consultadoEn,
    grupos: [],
    totalesPorDivisa: { USD: 0, COP: 0, BS: 0 },
    equivalenteUsd: 0,
    cantidadPagos: 0,
    pagosPedidosAnulados: 0,
  };
  for (const pago of pagos) {
    if (pago.status !== 'Activo') continue;
    if (!['USD', 'COP', 'BS'].includes(pago.divisa) ||
        !Number.isFinite(pago.monto) || pago.monto <= 0 ||
        !Number.isFinite(pago.monto_usd) || pago.monto_usd < 0 ||
        !Number.isFinite(pago.tasa) || pago.tasa <= 0) {
      throw new Error(`El pago #${pago.id} contiene importes o una divisa no válidos.`);
    }
    // La divisa es la guardada en el pago, aunque luego cambie la configuración de la forma.
    const key = `${pago.forma_pago_id}:${pago.divisa}`;
    let grupo = grupos.get(key);
    if (!grupo) {
      grupo = {
        formaPagoId: pago.forma_pago_id,
        nombre: pago.forma_pago_nombre,
        divisa: pago.divisa,
        pagos: [],
        monto: 0,
        montoUsd: 0,
      };
      grupos.set(key, grupo);
    }
    grupo.pagos.push({ ...pago });
    grupo.monto += pago.monto;
    grupo.montoUsd += pago.monto_usd;
    reporte.totalesPorDivisa[pago.divisa] += pago.monto;
    reporte.equivalenteUsd += pago.monto_usd;
    reporte.cantidadPagos += 1;
    if (pago.pedido_status === 'Anulado') reporte.pagosPedidosAnulados += 1;
  }
  reporte.grupos = Array.from(grupos.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre) || a.formaPagoId - b.formaPagoId ||
    a.divisa.localeCompare(b.divisa)
  );
  return reporte;
};

export const consultarReportePagos = async (filtro: ReportePagosFiltro) => {
  validarFiltroReportePagos(filtro);
  const formasPago = await listFormasPago();
  const forma = formasPago.find((item) => item.id === filtro.formaPagoId);
  if (filtro.formaPagoId !== null && !forma) {
    throw new Error('La forma de pago seleccionada ya no existe.');
  }
  const pagos = await listPagosReporte(filtro);
  return {
    formasPago,
    reporte: construirReportePagos(pagos, filtro, forma ? forma.nombre : 'Todas', nowIso()),
  };
};
