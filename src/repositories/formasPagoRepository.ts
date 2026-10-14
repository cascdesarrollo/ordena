import { executeSql, nowIso } from '../db/connection';
import type { Divisa, FormaPago, StatusActivo } from '../db/types';

export const listFormasPago = async (): Promise<FormaPago[]> => {
  const result = await executeSql('SELECT * FROM formas_pago ORDER BY nombre');
  return result.rows._array as FormaPago[];
};

export const listFormasPagoActivas = async (): Promise<FormaPago[]> => {
  const result = await executeSql(
    'SELECT * FROM formas_pago WHERE status = ? ORDER BY nombre',
    ['Activo']
  );
  return result.rows._array as FormaPago[];
};

export const createFormaPago = async (data: {
  nombre: string;
  divisa: Divisa;
  status: StatusActivo;
}): Promise<number> => {
  const now = nowIso();
  const result = await executeSql(
    `INSERT INTO formas_pago (nombre, divisa, status, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, 1);`,
    [data.nombre.trim(), data.divisa, data.status, now, now]
  );
  return result.insertId ?? 0;
};

export const updateFormaPago = async (id: number, data: {
  nombre: string;
  divisa: Divisa;
  status: StatusActivo;
}): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE formas_pago
     SET nombre = ?, divisa = ?, status = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [data.nombre.trim(), data.divisa, data.status, now, id]
  );
};
