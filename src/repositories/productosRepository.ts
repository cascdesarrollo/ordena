import { executeSql, nowIso } from '../db/connection';
import type { Producto, ProductoTipo, StatusActivo } from '../db/types';

export const listProductos = async (): Promise<Producto[]> => {
  const result = await executeSql<Producto>('SELECT * FROM productos ORDER BY nombre');
  return result.rows._array as Producto[];
};

export const listProductosActivos = async (): Promise<Producto[]> => {
  const result = await executeSql<Producto>(
    'SELECT * FROM productos WHERE status = ? ORDER BY nombre',
    ['Activo']
  );
  return result.rows._array as Producto[];
};

export const createProducto = async (data: {
  nombre: string;
  tipo: ProductoTipo;
  status: StatusActivo;
  precio: number;
}): Promise<number> => {
  const now = nowIso();
  const result = await executeSql(
    `INSERT INTO productos (nombre, tipo, status, precio, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, 1);`,
    [data.nombre.trim(), data.tipo, data.status, data.precio, now, now]
  );
  return result.insertId ?? 0;
};

export const updateProducto = async (id: number, data: {
  nombre: string;
  tipo: ProductoTipo;
  status: StatusActivo;
  precio: number;
}): Promise<void> => {
  const now = nowIso();
  await executeSql(
    `UPDATE productos
     SET nombre = ?, tipo = ?, status = ?, precio = ?, updated_at = ?, pending_sync = 1
     WHERE id = ?;`,
    [data.nombre.trim(), data.tipo, data.status, data.precio, now, id]
  );
};
