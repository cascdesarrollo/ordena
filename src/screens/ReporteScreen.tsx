import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { PasswordPrompt } from '../components/PasswordPrompt';
import { TotalesResumen } from '../components/TotalesResumen';
import { DescuentosResumen } from '../components/DescuentosResumen';
import { PagosResumen } from '../components/PagosResumen';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type {
  Pedido,
  PedidoDescuentoView,
  PedidoDetalleView,
  PedidoPagoView,
  PresentacionReporte,
  ReporteFiltro,
  ReportePedidos,
  StatusPedidoFiltro,
  TotalesPedido,
} from '../db/types';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  hasActiveOrderWithMesaName,
  reactivarPedido,
} from '../repositories/pedidosRepository';
import { consultarReportePedidos } from '../services/reportePedidosService';
import { verifySpecialPassword } from '../services/passwordService';
import { imprimirReportePedidos, printOrderTicket } from '../services/printService';
import { localDateString } from '../utils/format';

const statusFilterOptions: StatusPedidoFiltro[] = ['Todos', 'Sin anulados', 'Activo', 'Finalizado', 'Anulado'];

export const ReporteScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Reporte'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Reporte'>>();
  const today = localDateString();
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [status, setStatus] = useState<StatusPedidoFiltro>('Todos');
  const [reporte, setReporte] = useState<ReportePedidos | null>(null);
  const [presentacion, setPresentacion] = useState<PresentacionReporte>('Consolidado');
  const [cargando, setCargando] = useState(false);
  const filtroRef = useRef<ReporteFiltro>({ fechaInicio: today, fechaFin: today, status: 'Todos' });
  const consultaId = useRef(0);
  const pedidos = reporte?.pedidos.map((item) => item.pedido) ?? [];
  const [detallePedido, setDetallePedido] = useState<PedidoDetalleView[]>([]);
  const [descuentosPedido, setDescuentosPedido] = useState<PedidoDescuentoView[]>([]);
  const [showDetalle, setShowDetalle] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [totales, setTotales] = useState<TotalesPedido | null>(null);
  const [pagosPedido, setPagosPedido] = useState<PedidoPagoView[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const impresionEnCurso = useRef(false);

  const loadData = useCallback(async () => {
    const id = ++consultaId.current;
    setReporte(null);
    setCargando(true);
    try {
      const data = await consultarReportePedidos({ ...filtroRef.current });
      if (id === consultaId.current) setReporte(data);
    } catch (error) {
      if (id === consultaId.current) {
        Alert.alert('No se pudo consultar el reporte', error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (id === consultaId.current) setCargando(false);
    }
  }, []);

  const cambiarFiltro = (cambio: Partial<ReporteFiltro>) => {
    filtroRef.current = { ...filtroRef.current, ...cambio };
    setFechaInicio(filtroRef.current.fechaInicio);
    setFechaFin(filtroRef.current.fechaFin);
    setStatus(filtroRef.current.status);
    consultaId.current += 1;
    setReporte(null);
    setCargando(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => { consultaId.current += 1; };
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
    filtroRef.current = { ...filtro };
    loadData();
    navigation.replaceParams(undefined);
  }, [route.params, navigation, loadData]);

  const handleOpenDetalle = (pedido: Pedido) => {
    const datos = reporte?.pedidos.find((item) => item.pedido.id === pedido.id);
    if (!datos) return;
    const { detalle, pagos, descuentos, totales } = datos;
    setDetallePedido(detalle);
    setPagosPedido(pagos);
    setDescuentosPedido(descuentos);
    setTotales(totales);
    setSelectedPedido(pedido);
    setShowDetalle(true);
  };

  const handleOpenPagos = () => {
    if (!selectedPedido) return;
    setShowDetalle(false);
    navigation.navigate('Pedido', { pedidoId: selectedPedido.id, tab: 'Pagos' });
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

  const handleImprimirReporte = async () => {
    if (!reporte || impresionEnCurso.current) return;
    impresionEnCurso.current = true;
    setImprimiendo(true);
    try {
      await imprimirReportePedidos(reporte, presentacion);
    } catch (error) {
      Alert.alert('No se pudo completar la impresión',
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        'Si comenzó a imprimir, revise el papel antes de reintentar.');
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
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>Filtros</Text>
          <Text style={commonStyles.label}>Fecha inicio (YYYY-MM-DD)</Text>
          <TextInput style={commonStyles.input} value={fechaInicio} editable={!imprimiendo}
            onChangeText={(fechaInicio) => cambiarFiltro({ fechaInicio })} />
          <Text style={commonStyles.label}>Fecha fin (YYYY-MM-DD)</Text>
          <TextInput style={commonStyles.input} value={fechaFin} editable={!imprimiendo}
            onChangeText={(fechaFin) => cambiarFiltro({ fechaFin })} />
          <Text style={commonStyles.label}>Status</Text>
          <SelectPicker options={statusFilterOptions} value={status} disabled={imprimiendo}
            onChange={(status) => cambiarFiltro({ status })} />
          <Text style={commonStyles.label}>Presentación para imprimir</Text>
          <SelectPicker<PresentacionReporte> options={['Consolidado', 'Detallado']}
            value={presentacion} onChange={setPresentacion} disabled={imprimiendo} />
          <TouchableOpacity style={commonStyles.button} onPress={loadData} disabled={cargando || imprimiendo}>
            <Text style={commonStyles.buttonText}>{cargando ? 'Consultando…' : 'Consultar'}</Text>
          </TouchableOpacity>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>Pedidos</Text>
          <TouchableOpacity
            style={[commonStyles.button, (!reporte || cargando || imprimiendo) && styles.disabled]}
            disabled={!reporte || cargando || imprimiendo}
            onPress={handleImprimirReporte}
          >
            <Text style={commonStyles.buttonText}>
              {imprimiendo ? 'Imprimiendo…' : `Imprimir reporte ${presentacion.toLowerCase()}`}
            </Text>
          </TouchableOpacity>
          {reporte ? (
            <Text style={commonStyles.mutedText}>
              {reporte.filtro.fechaInicio} al {reporte.filtro.fechaFin} · {reporte.filtro.status}
              {'\n'}Consultado: {new Date(reporte.consultadoEn).toLocaleString()}
              {'\n'}{pedidos.length} pedidos · Total: {reporte.totalUsd.toFixed(2)} USD
              {pedidos.some((p) => p.status === 'Anulado')
                ? '\nIncluye importes de pedidos anulados; no representa ventas netas.' : ''}
            </Text>
          ) : (
            <Text style={commonStyles.mutedText}>Consulte para ver e imprimir estos filtros.</Text>
          )}
          {pedidos.map((item) => (
            <TouchableOpacity key={item.id} style={styles.row} onPress={() => handleOpenDetalle(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.mesa_nombre}</Text>
                <Text style={commonStyles.mutedText}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </TouchableOpacity>
          ))}
          {reporte && pedidos.length === 0 ? <Text style={commonStyles.mutedText}>No hay pedidos.</Text> : null}
        </View>
      </ScrollView>

      <ModalContainer
        visible={showDetalle}
        title="Detalle de pedido"
        onClose={() => setShowDetalle(false)}
        scroll={false}
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
          <DescuentosResumen descuentos={descuentosPedido} />
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
  disabled: {
    opacity: 0.5,
  },
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
    flexShrink: 1,
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
