import type { Divisa, PedidoPago, TasasPedido } from '../db/types';

export const divisas: Divisa[] = ['USD', 'COP', 'BS'];

// Diferencias menores a esto (redondeo de conversiones) se consideran pago exacto.
const TOLERANCIA_USD = 0.01;

// Unidades de la divisa por 1 USD. 0 = tasa sin configurar.
export const tasaDivisa = (divisa: Divisa, tasas: TasasPedido): number => {
  if (divisa === 'COP') return tasas.tasaCop;
  if (divisa === 'BS') return tasas.tasaBs;
  return 1;
};

export const redondear = (value: number) => Math.round(value * 100) / 100;

export interface ResumenPagos {
  totalUsd: number;
  pagadoUsd: number;
  // pagado - total: > 0 excedente (propina), < 0 pendiente.
  diferenciaUsd: number;
  exacto: boolean;
}

// montoAdicionalUsd: para previsualizar cómo queda el resumen con un pago aún no registrado.
export const resumirPagos = (
  pagos: PedidoPago[],
  totalUsd: number,
  montoAdicionalUsd = 0
): ResumenPagos => {
  const pagadoUsd = pagos
    .filter((p) => p.status === 'Activo')
    .reduce((sum, p) => sum + p.monto_usd, montoAdicionalUsd);
  const diferenciaUsd = pagadoUsd - totalUsd;
  return { totalUsd, pagadoUsd, diferenciaUsd, exacto: Math.abs(diferenciaUsd) < TOLERANCIA_USD };
};

// "Pendiente 10.00 USD" / "Excedente 5.00 USD" / "Pagado completo"
export const describirDiferencia = (resumen: ResumenPagos) => {
  if (resumen.exacto) return 'Pagado completo';
  const etiqueta = resumen.diferenciaUsd < 0 ? 'Pendiente' : 'Excedente';
  return `${etiqueta} ${Math.abs(resumen.diferenciaUsd).toFixed(2)} USD`;
};
