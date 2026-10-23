import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { PasswordPrompt } from '../components/PasswordPrompt';
import { TotalesResumen } from '../components/TotalesResumen';
import { PagosResumen } from '../components/PagosResumen';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type { Pedido, PedidoDetalleView, PedidoPagoView, StatusPedidoFiltro, TotalesPedido } from '../db/types';
import type { DrawerParamList } from '../navigation/DrawerNavigator';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  hasActiveOrderWithMesaName,
  listPedidosByFechaStatus,
  reactivarPedido,
} from '../repositories/pedidosRepository';
import { getTotalesPedido } from '../services/totalesService';
import { listPedidoDetalle } from '../repositories/pedidoDetalleRepository';
import { listPagosPedido } from '../repositories/pedidoPagosRepository';
import { verifySpecialPassword } from '../services/passwordService';
import { printOrderTicket } from '../services/printService';
import { localDateString } from '../utils/format';

const statusFilterOptions: StatusPedidoFiltro[] = ['Todos', 'Activo', 'Finalizado', 'Anulado'];

export const ReporteScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList, 'Reporte'>>();
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<DrawerParamList, 'Reporte'>>();
  const today = localDateString();
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [status, setStatus] = useState<StatusPedidoFiltro>('Todos');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [detallePedido, setDetallePedido] = useState<PedidoDetalleView[]>([]);
  const [showDetalle, setShowDetalle] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [totales, setTotales] = useState<TotalesPedido | null>(null);
  const [pagosPedido, setPagosPedido] = useState<PedidoPagoView[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const impresionEnCurso = useRef(false);

  const loadData = useCallback(async () => {
    const data = await listPedidosByFechaStatus(
      fechaInicio,
      fechaFin,
      status === 'Todos' ? undefined : status
    );
    setPedidos(data);
  }, [fechaInicio, fechaFin, status]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Filtros recibidos al navegar (indicadores de Home). Se limpian tras aplicarlos para
  // que una nueva navegación con los mismos valores vuelva a dispararlos.
  useEffect(() => {
    const filtro = route.params;
    if (!filtro) return;
    setFechaInicio(filtro.fechaInicio);
    setFechaFin(filtro.fechaFin);
    setStatus(filtro.status);
    navigation.replaceParams(undefined);
  }, [route.params, navigation]);

  const handleOpenDetalle = async (pedido: Pedido) => {
    const [detalle, pagos] = await Promise.all([listPedidoDetalle(pedido.id), listPagosPedido(pedido.id)]);
    setDetallePedido(detalle);
    setPagosPedido(pagos);
    setTotales(await getTotalesPedido(pedido, detalle));
    setSelectedPedido(pedido);
    setShowDetalle(true);
  };

  const handleOpenPagos = () => {
    if (!selectedPedido) return;
    setShowDetalle(false);
    stackNavigation.navigate('Pedido', { pedidoId: selectedPedido.id, tab: 'Pagos' });
  };

  const handleImprimir = async () => {
    if (!selectedPedido || impresionEnCurso.current) return;
    impresionEnCurso.current = true;
    setImprimiendo(true);
    try {
      await printOrderTicket(selectedPedido.id);
    } catch (error) {
      Alert.alert(
        'No se pudo completar la impresión',
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        'Si comenzó a imprimir, revise el papel antes de reintentar.'
      );
    } finally {
      impresionEnCurso.current = false;
      setImprimiendo(false);
    }
  };

  const handleReactivar = async (password: string) => {
    setShowPassword(false);
    if (!selectedPedido) return;
    if (!(await verifySpecialPassword(password))) {
      Alert.alert('Clave inválida', 'Password invalido.');
      return;
    }
    if (await hasActiveOrderWithMesaName(selectedPedido.mesa_nombre, selectedPedido.id)) {
      Alert.alert('Reactivar', 'Ya existe un pedido activo para esa mesa.');
      return;
    }
    await reactivarPedido(selectedPedido.id);
    setShowDetalle(false);
    await loadData();
  };

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Filtros</Text>
        <Text style={commonStyles.label}>Fecha inicio (YYYY-MM-DD)</Text>
        <TextInput style={commonStyles.input} value={fechaInicio} onChangeText={setFechaInicio} />
        <Text style={commonStyles.label}>Fecha fin (YYYY-MM-DD)</Text>
        <TextInput style={commonStyles.input} value={fechaFin} onChangeText={setFechaFin} />
        <Text style={commonStyles.label}>Status</Text>
        <SelectPicker options={statusFilterOptions} value={status} onChange={setStatus} />
        <TouchableOpacity style={commonStyles.button} onPress={loadData}>
          <Text style={commonStyles.buttonText}>Consultar</Text>
        </TouchableOpacity>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Pedidos</Text>
        <FlatList
          data={pedidos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => handleOpenDetalle(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.mesa_nombre}</Text>
                <Text style={commonStyles.mutedText}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay pedidos.</Text>}
        />
      </View>

      <ModalContainer
        visible={showDetalle}
        title="Detalle de pedido"
        onClose={() => setShowDetalle(false)}
        footer={
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.footerButton, styles.primary]}
              onPress={handleImprimir}
              disabled={imprimiendo}
            >
              <Text style={styles.footerButtonText}>{imprimiendo ? 'Imprimiendo…' : 'Imprimir'}</Text>
            </TouchableOpacity>
            {selectedPedido && selectedPedido.status !== 'Anulado' ? (
              <TouchableOpacity style={[styles.footerButton, styles.pagos]} onPress={handleOpenPagos}>
                <Text style={styles.footerButtonText}>Pagos</Text>
              </TouchableOpacity>
            ) : null}
            {selectedPedido && selectedPedido.status !== 'Activo' ? (
              <TouchableOpacity
                style={[styles.footerButton, styles.secondary]}
                onPress={() => setShowPassword(true)}
              >
                <Text style={styles.footerButtonText}>Reactivar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      >
        <ScrollView style={styles.detalleScroll}>
          {detallePedido
            .filter((d) => d.status === 'Activa')
            .map((item) => (
              <View key={item.id} style={styles.detalleRow}>
                <Text style={styles.detalleNombre}>{item.producto_nombre}</Text>
                <Text style={[commonStyles.mutedText, styles.detalleCantidad]}>
                  {item.cantidad} x ${item.precio.toFixed(2)}
                </Text>
                <Text style={styles.detalleMonto}>${item.monto.toFixed(2)}</Text>
              </View>
            ))}
          {detallePedido.every((d) => d.status !== 'Activa') ? (
            <Text style={commonStyles.mutedText}>Sin productos.</Text>
          ) : null}
          {totales ? (
            <>
              <View style={styles.seccion}>
                <TotalesResumen totales={totales} />
              </View>
              <View style={styles.seccion}>
                <Text style={styles.seccionTitulo}>Pagos</Text>
                <PagosResumen pagos={pagosPedido} totales={totales} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </ModalContainer>

      <PasswordPrompt
        visible={showPassword}
        title="Reactivar pedido"
        onCancel={() => setShowPassword(false)}
        onConfirm={handleReactivar}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: colors.primary,
    fontWeight: '600',
  },
  detalleScroll: {
    maxHeight: 460,
  },
  seccion: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detalleRow: {
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detalleNombre: {
    flex: 1,
    fontWeight: '600',
  },
  detalleCantidad: {
    marginHorizontal: spacing.sm,
  },
  detalleMonto: {
    fontWeight: '600',
    minWidth: 70,
    textAlign: 'right',
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  footerButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  seccionTitulo: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  pagos: {
    backgroundColor: colors.primaryDark,
  },
  secondary: {
    backgroundColor: colors.success,
  },
  footerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
