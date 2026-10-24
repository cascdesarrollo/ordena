import React, { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ConfiguracionImpresora, ImpresoraBluetooth } from '../db/types';
import {
  getConfiguracionImpresora,
  saveConfiguracionImpresora,
} from '../repositories/impresoraRepository';
import {
  abrirAjustesBluetooth,
  comprobarConexionImpresora,
  listarImpresorasVinculadas,
} from '../services/bluetoothPrinterService';
import { imprimirTicketPrueba } from '../services/printService';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import { ModalContainer } from './ModalContainer';
import { SelectPicker } from './SelectPicker';

export const ImpresoraConfig = () => {
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [configuracion, setConfiguracion] = useState<ConfiguracionImpresora | null>(null);
  const [dispositivos, setDispositivos] = useState<ImpresoraBluetooth[]>([]);
  const [accion, setAccion] = useState('');
  const ocupado = useRef(false);

  const ejecutarAccion = async (mensaje: string, tarea: () => Promise<void>) => {
    if (ocupado.current) {
      Alert.alert('Impresora', 'Espere a que termine la operación en curso.');
      return;
    }
    ocupado.current = true;
    setAccion(mensaje);
    try {
      await tarea();
    } catch (error) {
      Alert.alert('Impresora', error instanceof Error ? error.message : String(error));
    } finally {
      ocupado.current = false;
      setAccion('');
    }
  };

  const abrir = () => ejecutarAccion('Cargando configuración…', async () => {
    const guardada = await getConfiguracionImpresora();
    setConfiguracion(guardada);
    setDispositivos([]);
    setVisible(true);
  });

  const guardar = () => ejecutarAccion('Guardando…', async () => {
    if (!configuracion) throw new Error('No se ha cargado la configuración.');
    await saveConfiguracionImpresora(configuracion);
    setVisible(false);
  });

  const buscar = () => ejecutarAccion('Buscando dispositivos vinculados…', async () => {
    const encontrados = await listarImpresorasVinculadas();
    setDispositivos(encontrados);
    if (encontrados.length === 0) {
      Alert.alert(
        'Sin dispositivos',
        'Vincule la impresora en los ajustes Bluetooth de Android y luego pulse Actualizar lista.'
      );
    }
  });

  const comprobar = () => ejecutarAccion('Conectando con la impresora…', async () => {
    if (!configuracion?.direccion) throw new Error('Seleccione una impresora primero.');
    await comprobarConexionImpresora(configuracion.direccion);
    Alert.alert('Conexión comprobada', `Conectado con ${configuracion.nombre}.`);
  });

  const probar = () => ejecutarAccion('Enviando ticket de prueba…', async () => {
    if (!configuracion?.direccion) throw new Error('Seleccione una impresora primero.');
    try {
      await imprimirTicketPrueba(configuracion);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        'Si comenzó a imprimir, revise el papel antes de reintentar.'
      );
    }
    Alert.alert(
      'Ticket enviado',
      'Verifique en el papel el ancho, la alineación y los acentos. ' +
      'Recuerde guardar la configuración.'
    );
  });

  const opciones = [...dispositivos];
  if (
    configuracion?.direccion &&
    !opciones.some((item) => item.direccion === configuracion.direccion)
  ) {
    opciones.unshift({ direccion: configuracion.direccion, nombre: configuracion.nombre });
  }

  if (Platform.OS !== 'android') return null;

  return (
    <>
      <TouchableOpacity style={styles.entrada} onPress={abrir} disabled={!!accion}>
        <Text style={styles.titulo}>Impresora y ticket</Text>
        <Text style={commonStyles.mutedText}>
          {accion || 'Bluetooth · Selección, formato y prueba'}
        </Text>
      </TouchableOpacity>
      <ModalContainer
        visible={visible}
        title="Impresora y ticket"
        scroll={false}
        onClose={() => { if (!ocupado.current) setVisible(false); }}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={guardar} disabled={!!accion}>
            <Text style={commonStyles.buttonText}>{accion || 'Guardar configuración'}</Text>
          </TouchableOpacity>
        }
      >
        {configuracion ? (
          <ScrollView style={{ maxHeight: height * 0.55, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            <Text style={commonStyles.mutedText}>
              Vincule primero la impresora desde Android. La lista muestra dispositivos
              Bluetooth clásico vinculados; seleccione únicamente su impresora ESC/POS.
            </Text>
            <View style={styles.botones}>
              <TouchableOpacity
                style={styles.botonSecundario}
                disabled={!!accion}
                onPress={() => ejecutarAccion('Abriendo ajustes…', abrirAjustesBluetooth)}
              >
                <Text style={styles.textoBoton}>Vincular en Android</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonSecundario} disabled={!!accion} onPress={buscar}>
                <Text style={styles.textoBoton}>Actualizar lista</Text>
              </TouchableOpacity>
            </View>
            <Text style={commonStyles.label}>Impresora seleccionada</Text>
            <View pointerEvents={accion ? 'none' : 'auto'}>
              <SelectPicker
                value={configuracion.direccion}
                options={[
                  { label: 'Sin impresora seleccionada', value: '' },
                  ...opciones.map((item) => ({
                    label: `${item.nombre} (${item.direccion})`,
                    value: item.direccion,
                  })),
                ]}
                onChange={(direccion) => {
                  const dispositivo = opciones.find((item) => item.direccion === direccion);
                  setConfiguracion({
                    ...configuracion,
                    direccion,
                    nombre: dispositivo?.nombre ?? '',
                  });
                }}
              />
              <Text style={commonStyles.label}>Formato del ticket</Text>
              <SelectPicker
                value={String(configuracion.columnas)}
                options={[
                  { label: '32 columnas — DIG-P501A / 58 mm', value: '32' },
                  { label: '48 columnas — impresora compatible / 80 mm', value: '48' },
                ]}
                onChange={(valor) => {
                  if (valor === '32' || valor === '48') {
                    setConfiguracion({ ...configuracion, columnas: valor === '32' ? 32 : 48 });
                  }
                }}
              />
            </View>
            <Text style={commonStyles.mutedText}>
              Use 32 columnas para la DIG-P501A. Elegir 48 no aumenta el ancho físico del papel.
            </Text>
            <Text style={[commonStyles.label, styles.etiqueta]}>Encabezado del restaurante</Text>
            <TextInput
              style={[commonStyles.input, styles.encabezado]}
              value={configuracion.encabezado}
              onChangeText={(encabezado) => setConfiguracion({ ...configuracion, encabezado })}
              editable={!accion}
              multiline
              maxLength={240}
              placeholder="Nombre del restaurante y datos adicionales"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.botones}>
              <TouchableOpacity
                style={styles.botonSecundario}
                onPress={comprobar}
                disabled={!!accion || !configuracion.direccion}
              >
                <Text style={styles.textoBoton}>Comprobar conexión</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.botonSecundario}
                onPress={probar}
                disabled={!!accion || !configuracion.direccion}
              >
                <Text style={styles.textoBoton}>Imprimir prueba</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}
      </ModalContainer>
    </>
  );
};

const styles = StyleSheet.create({
  entrada: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  botones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  botonSecundario: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textoBoton: {
    color: colors.primary,
    fontWeight: '600',
  },
  encabezado: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  etiqueta: {
    marginTop: spacing.sm,
  },
});
