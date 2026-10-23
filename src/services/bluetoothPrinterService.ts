import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { ImpresoraBluetooth } from '../db/types';

let operacionEnCurso = false;

const conOperacionBluetooth = async <T>(operacion: () => Promise<T>): Promise<T> => {
  if (operacionEnCurso) {
    throw new Error('Hay una operación de impresora en curso. Espere a que termine.');
  }
  operacionEnCurso = true;
  try {
    return await operacion();
  } finally {
    operacionEnCurso = false;
  }
};

const prepararBluetooth = async () => {
  if (Platform.OS !== 'android') {
    throw new Error('La impresión Bluetooth está disponible solo en Android.');
  }
  if (!NativeModules.RNBluetoothClassic) {
    throw new Error(
      'Este build no incluye el módulo Bluetooth. Recompile e instale el development build de Android.'
    );
  }
  if (Number(Platform.Version) >= 31) {
    const permisos = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ];
    const resultados = await PermissionsAndroid.requestMultiple(permisos);
    if (permisos.some((permiso) => resultados[permiso] !== PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error(
        'Se necesita permiso de dispositivos cercanos para usar la impresora. ' +
        'Puede habilitarlo en Ajustes de Android > Aplicaciones > ORDENA > Permisos.'
      );
    }
  }
  // Carga diferida: iOS y los builds antiguos pueden abrir la app sin este módulo nativo.
  const { default: bluetooth } = await import('react-native-bluetooth-classic');
  if (!(await bluetooth.isBluetoothAvailable())) {
    throw new Error('Este dispositivo no dispone de Bluetooth.');
  }
  if (!(await bluetooth.isBluetoothEnabled()) && !(await bluetooth.requestBluetoothEnabled())) {
    throw new Error('Active Bluetooth para conectar la impresora.');
  }
  return bluetooth;
};

export const abrirAjustesBluetooth = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    throw new Error('La configuración Bluetooth está disponible solo en Android.');
  }
  await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
};

export const listarImpresorasVinculadas = (): Promise<ImpresoraBluetooth[]> =>
  conOperacionBluetooth(async () => {
    const bluetooth = await prepararBluetooth();
    const dispositivos = await bluetooth.getBondedDevices();
    return dispositivos
      .filter((dispositivo) => dispositivo.type !== 'LOW_ENERGY')
      .map((dispositivo) => ({
        direccion: dispositivo.address,
        nombre: dispositivo.name || dispositivo.address,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

const conectar = async (direccion: string) => {
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(direccion)) {
    throw new Error('Seleccione una impresora en Parámetros > Impresora y ticket.');
  }
  const bluetooth = await prepararBluetooth();
  const dispositivo = await bluetooth.isDeviceConnected(direccion)
    ? await bluetooth.getConnectedDevice(direccion)
    : await bluetooth.connectToDevice(direccion, { connectorType: 'rfcomm' });
  if (!(await dispositivo.isConnected())) {
    throw new Error('No se pudo conectar con la impresora seleccionada.');
  }
  return dispositivo;
};

export const comprobarConexionImpresora = (direccion: string): Promise<void> =>
  conOperacionBluetooth(async () => {
    await conectar(direccion);
  });

export const enviarTicketBluetooth = (direccion: string, datos: string): Promise<void> =>
  conOperacionBluetooth(async () => {
    const dispositivo = await conectar(direccion);
    // Escrituras pequeñas y espaciadas para el búfer de las impresoras portátiles.
    for (let inicio = 0; inicio < datos.length; inicio += 256) {
      const fragmento = datos.slice(inicio, inicio + 256);
      if (!(await dispositivo.write(fragmento, 'latin1'))) {
        throw new Error('La impresora no aceptó los datos del ticket.');
      }
      const lineas = fragmento.split('\n').length - 1;
      await new Promise<void>((resolve) => setTimeout(resolve, Math.max(40, lineas * 60)));
    }
  });
