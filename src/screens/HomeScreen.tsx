import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import { listMesasActivas } from '../repositories/mesasRepository';
import { createPedido, getPedidosIndicadores, hasActiveOrderWithMesaName, listPedidosActivos } from '../repositories/pedidosRepository';
import type { Mesa, Pedido } from '../db/types';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { DrawerParamList } from '../navigation/DrawerNavigator';
import { localDateString } from '../utils/format';
import { TextInput } from 'react-native';

export const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const drawerNavigation = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const [indicadores, setIndicadores] = useState({
    pedidosDia: 0,
    pedidosActivos: 0,
    principalesDia: 0,
  });
  const [pedidosActivos, setPedidosActivos] = useState<Pedido[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('');
  const [mesaNombre, setMesaNombre] = useState('');
  const [mesaDuplicada, setMesaDuplicada] = useState(false);

  const loadData = useCallback(async () => {
    const [indicadoresData, pedidos, mesasData] = await Promise.all([
      getPedidosIndicadores(),
      listPedidosActivos(),
      listMesasActivas(),
    ]);
    setIndicadores(indicadoresData);
    setPedidosActivos(pedidos);
    setMesas(mesasData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleMesaSelect = (value: string) => {
    setMesaSeleccionada(value);
    setMesaNombre(value);
  };

  const validateMesaNombre = async (value: string) => {
    setMesaNombre(value);
    if (!value.trim()) {
      setMesaDuplicada(false);
      return;
    }
    const exists = await hasActiveOrderWithMesaName(value.trim());
    setMesaDuplicada(exists);
  };

  const handleCreatePedido = async () => {
    if (!mesaNombre.trim() || mesaDuplicada) return;
    const pedidoId = await createPedido(mesaNombre.trim());
    setShowNuevoPedido(false);
    setMesaSeleccionada('');
    setMesaNombre('');
    setMesaDuplicada(false);
    await loadData();
    navigation.navigate('Pedido', { pedidoId });
  };

  const openReporteDia = () => {
    const today = localDateString();
    drawerNavigation.navigate('Reporte', { fechaInicio: today, fechaFin: today, status: 'Todos' });
  };

  // Los activos pueden venir de días anteriores: el rango arranca en el más antiguo.
  const openReporteActivos = () => {
    const today = localDateString();
    const masAntiguo = pedidosActivos.reduce<string | null>(
      (min, pedido) => (min === null || pedido.created_at < min ? pedido.created_at : min),
      null
    );
    const fechaInicio = masAntiguo ? localDateString(new Date(masAntiguo)) : today;
    drawerNavigation.navigate('Reporte', { fechaInicio, fechaFin: today, status: 'Activo' });
  };

  return (
    <View style={[commonStyles.screen, commonStyles.screenWithFab]}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Indicadores de Hoy</Text>
        <View style={styles.indicadoresGrid}>
          <TouchableOpacity style={styles.indicadorCard} onPress={openReporteDia}>
            <Text style={styles.indicadorValue}>{indicadores.pedidosDia}</Text>
            <Text style={styles.indicadorLabel}>Pedidos del día</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.indicadorCard} onPress={openReporteActivos}>
            <Text style={styles.indicadorValue}>{indicadores.pedidosActivos}</Text>
            <Text style={styles.indicadorLabel}>Pedidos activos</Text>
          </TouchableOpacity>
          <View style={styles.indicadorCard}>
            <Text style={styles.indicadorValue}>{indicadores.principalesDia}</Text>
            <Text style={styles.indicadorLabel}>Productos principal</Text>
          </View>
        </View>
      </View>

      <View style={[commonStyles.card, commonStyles.listCard]}>
        <Text style={commonStyles.title}>Pedidos Activos</Text>
        <FlatList
          data={pedidosActivos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.pedidoRow}
              onPress={() => navigation.navigate('Pedido', { pedidoId: item.id })}
            >
              <View>
                <Text style={styles.pedidoMesa}>{item.mesa_nombre}</Text>
                <Text style={commonStyles.mutedText}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.pedidoStatus}>{item.status}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay pedidos activos.</Text>}
        />
      </View>

      <FloatingActionButton onPress={() => setShowNuevoPedido(true)} />

      <ModalContainer
        visible={showNuevoPedido}
        title="Nuevo pedido"
        onClose={() => setShowNuevoPedido(false)}
        footer={
          <TouchableOpacity
            style={[commonStyles.button, mesaDuplicada && styles.disabled]}
            onPress={handleCreatePedido}
            disabled={mesaDuplicada || !mesaNombre.trim()}
          >
            <Text style={commonStyles.buttonText}>Guardar pedido</Text>
          </TouchableOpacity>
        }
      >
        <Text style={commonStyles.label}>Mesa configurada</Text>
        <SelectPicker
          options={[
            { label: 'Seleccione una mesa', value: '' },
            ...mesas.map((mesa) => ({ label: mesa.nombre, value: mesa.nombre })),
          ]}
          value={mesaSeleccionada}
          onChange={handleMesaSelect}
        />
        <Text style={commonStyles.label}>Nombre de mesa</Text>
        <TextInput
          style={commonStyles.input}
          value={mesaNombre}
          onChangeText={validateMesaNombre}
          placeholder="Nombre de la mesa"
        />
        {mesaDuplicada ? (
          <Text style={styles.errorText}>Ya existe un pedido activo para esa mesa.</Text>
        ) : null}
      </ModalContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  indicadoresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  indicadorCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'center',
  },
  indicadorValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  indicadorLabel: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  pedidoRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pedidoMesa: {
    fontSize: 16,
    fontWeight: '600',
  },
  pedidoStatus: {
    color: colors.primary,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.xs,
  },
  disabled: {
    backgroundColor: colors.muted,
  },
});
