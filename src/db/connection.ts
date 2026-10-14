import { openDatabaseSync } from 'expo-sqlite';

const database = openDatabaseSync('ordena.db');

export const getDb = () => database;

type RowsResult<T> = {
  _array: T[];
  length: number;
  item: (index: number) => T;
};

export type ExecuteResult<T = any> = {
  rows: RowsResult<T>;
  insertId?: number;
  changes?: number;
};

const makeRows = <T>(items: T[]): RowsResult<T> => ({
  _array: items,
  length: items.length,
  item: (index: number) => items[index],
});

export const executeSql = async <T = any>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<ExecuteResult<T>> => {
  // PRAGMA (p. ej. table_info) también devuelve filas: si se ejecutara con runAsync llegarían vacías.
  const returnsRows = /^\s*(select|pragma)/i.test(sql);
  if (returnsRows) {
    const rows = await database.getAllAsync<T>(sql, params);
    return { rows: makeRows(rows) };
  }

  const result = await database.runAsync(sql, params);
  return {
    rows: makeRows([] as T[]),
    insertId: result.lastInsertRowId,
    changes: result.changes,
  };
};

export const nowIso = () => new Date().toISOString();

// Ejecuta varias escrituras como una sola unidad: si algo falla no queda nada a medias.
export const runInTransaction = (task: () => Promise<void>) => database.withTransactionAsync(task);
