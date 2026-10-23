import { executeSql, nowIso } from '../db/connection';
import { parametroImpresoraSeed } from '../db/schema';
import type { ConfiguracionImpresora } from '../db/types';
import { getParametro } from './parametrosRepository';

export const IMPRESORA_CONFIG_CODE = parametroImpresoraSeed.codigo;

const validarConfiguracion = (valor: unknown): ConfiguracionImpresora => {
  if (
    typeof valor !== 'object' || valor === null ||
    !('direccion' in valor) || typeof valor.direccion !== 'string' ||
    !('nombre' in valor) || typeof valor.nombre !== 'string' ||
    !('columnas' in valor) || (valor.columnas !== 32 && valor.columnas !== 48) ||
    !('encabezado' in valor) || typeof valor.encabezado !== 'string'
  ) {
    throw new Error('La configuración de impresora no es válida.');
  }
  const direccion = valor.direccion.trim().toUpperCase();
  const nombre = valor.nombre.trim();
  const encabezado = valor.encabezado.trim();
  if (direccion && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(direccion)) {
    throw new Error('La dirección Bluetooth de la impresora no es válida.');
  }
  if ((direccion && !nombre) || nombre.length > 100) {
    throw new Error('El nombre de la impresora no es válido.');
  }
  if (!encabezado || encabezado.length > 240) {
    throw new Error('El encabezado debe tener entre 1 y 240 caracteres.');
  }
  return { direccion, nombre, columnas: valor.columnas, encabezado };
};

export const getConfiguracionImpresora = async (): Promise<ConfiguracionImpresora> => {
  const parametro = await getParametro(IMPRESORA_CONFIG_CODE);
  if (!parametro) {
    throw new Error('No se encontró la configuración de impresora. Reinicie la aplicación.');
  }
  let valor: unknown;
  try {
    valor = JSON.parse(parametro.valor);
  } catch {
    throw new Error('La configuración de impresora guardada está dañada.');
  }
  return validarConfiguracion(valor);
};

export const saveConfiguracionImpresora = async (
  configuracion: ConfiguracionImpresora
): Promise<void> => {
  const valor = validarConfiguracion(configuracion);
  const result = await executeSql(
    'UPDATE parametros SET valor = ?, updated_at = ?, pending_sync = 1 WHERE codigo = ?;',
    [JSON.stringify(valor), nowIso(), IMPRESORA_CONFIG_CODE]
  );
  if (result.changes !== 1) {
    throw new Error('No se pudo guardar la configuración de impresora.');
  }
};
