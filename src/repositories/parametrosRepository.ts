import { executeSql, nowIso } from '../db/connection';
import type { Parametro, TasasPedido } from '../db/types';

export const listParametros = async (): Promise<Parametro[]> => {
  const result = await executeSql('SELECT * FROM parametros ORDER BY codigo');
  return result.rows._array as Parametro[];
};

export const updateParametroValor = async (codigo: string, valor: string): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE parametros
     SET valor = ?, updated_at = ?, pending_sync = 1
     WHERE codigo = ?;`,
    [valor.trim(), now, codigo]
  );
};

export const getParametro = async (codigo: string): Promise<Parametro | null> => {
  const result = await executeSql('SELECT * FROM parametros WHERE codigo = ?;', [codigo]);
  if (result.rows.length === 0) return null;
  return result.rows.item(0) as Parametro;
};

const valorNumerico = (parametro: Parametro | null) => {
  const num = Number(parametro?.valor || 0);
  return Number.isFinite(num) ? num : 0;
};

export const getTasasActuales = async (): Promise<TasasPedido> => {
  const [cop, bs, propina] = await Promise.all([
    getParametro('COP_USD'),
    getParametro('BS_USD'),
    getParametro('TIP_SUGERIDO'),
  ]);
  return { tasaCop: valorNumerico(cop), tasaBs: valorNumerico(bs), propinaPct: valorNumerico(propina) };
};
