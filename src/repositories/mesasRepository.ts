import { executeSql, nowIso } from '../db/connection';
import type { Mesa, StatusActivo } from '../db/types';

export const listMesas = async (): Promise<Mesa[]> => {
  const result = await executeSql('SELECT * FROM mesas ORDER BY nombre');
  return result.rows._array as Mesa[];
};

export const listMesasActivas = async (): Promise<Mesa[]> => {
  const result = await executeSql(
    'SELECT * FROM mesas WHERE status = ? ORDER BY nombre',
    ['Activo']
  );
  return result.rows._array as Mesa[];
};

export const createMesa = async (data: {
  codigo: string;
  nombre: string;
  status: StatusActivo;
}): Promise<number> => {
  const now = nowIso();
  const result = await executeSql(
    `INSERT INTO mesas (codigo, nombre, status, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, 1);`,
    [data.codigo.trim(), data.nombre.trim(), data.status, now, now]
  );
  return result.insertId ?? 0;
};

export const updateMesa = async (id: number, data: {
  codigo: string;
  nombre: string;
  status: StatusActivo;
}): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE mesas
     SET codigo = ?, nombre = ?, status = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [data.codigo.trim(), data.nombre.trim(), data.status, now, id]
  );
};
