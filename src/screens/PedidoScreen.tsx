import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { PasswordPrompt } from '../components/PasswordPrompt';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { TotalesResumen } from '../components/TotalesResumen';
import { PagosResumen } from '../components/PagosResumen';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type {
  FormaPago,
  Pedido,
  PedidoDetalleView,
  PedidoPagoView,
  PedidoTab,
  Producto,
  ProductoTipo,
  TotalesPedido,
} from '../db/types';
import { listProductosActivos } from '../repositories/productosRepository';
import {
  createPedidoDetalle,
  listPedidoDetalle,
  nextLineaForPedido,
  updatePedidoDetalleCantidad,
  updatePedidoDetalleStatus,
} from '../repositories/pedidoDetalleRepository';
import {
  getPedido,
  hasActiveOrderWithMesaName,
  listPedidosActivos,
  updatePedidoMesaNombre,
  updatePedidoStatus,
} from '../repositories/pedidosRepository';
import { listFormasPagoActivas } from '../repositories/formasPagoRepository';
import {
  createPedidoPago,
  listPagosPedido,
  updatePedidoPagoStatus,
} from '../repositories/pedidoPagosRepository';
import { calcularTotales, finalizarPedidoConTotales, getTotalesPedido } from '../services/totalesService';
import { describirDiferencia, redondear, resumirPagos, tasaDivisa } from '../services/pagosService';
import { moverProductos } from '../services/moverService';
import { verifySpecialPassword } from '../services/passwordService';
import { printOrderTicket } from '../services/printService';
import { parseDecimal } from '../utils/format';
import type { RootStackParamList } from '../navigation/RootNavigator';

const tipoFilterOptions: (ProductoTipo | 'Todos')[] = ['Todos', 'Principal', 'Bebidas', 'Postres', 'Entrada'];
const tipoOrder: ProductoTipo[] = ['Principal', 'Bebidas', 'Postres', 'Entrada'];

export const PedidoScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Pedido'>>();
  const { pedidoId } = route.params;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [detalle, setDetalle] = useState<PedidoDetalleView[]>([]);
  // Copia síncrona del detalle: los toques rápidos en +/- deben partir del último valor, no del render anterior.
  const detalleRef = useRef<PedidoDetalleView[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tab, setTab] = useState<PedidoTab>(route.params.tab ?? 'Productos');

  const [showAddItem, setShowAddItem] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState<ProductoTipo | 'Todos'>('Todos');

  const [showEditItem, setShowEditItem] = useState(false);
  const [selectedDetalle, setSelectedDetalle] = useState<PedidoDetalleView | null>(null);
  const [cantidad, setCantidad] = useState('1');

  const [showPasswordItem, setShowPasswordItem] = useState(false);
  const [showPasswordPedido, setShowPasswordPedido] = useState(false);

  const [totales, setTotales] = useState<TotalesPedido | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const impresionEnCurso = useRef(false);

  const [pagos, setPagos] = useState<PedidoPagoView[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [showAddPago, setShowAddPago] = useState(false);
  const [formaPagoId, setFormaPagoId] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [selectedPago, setSelectedPago] = useState<PedidoPagoView | null>(null);
  const [showPasswordPago, setShowPasswordPago] = useState(false);

  // Separar / mover productos a otro pedido. destinoMover: '' | 'nuevo' | id del pedido destino.
  const [showMover, setShowMover] = useState(false);
  const [pedidosDestino, setPedidosDestino] = useState<Pedido[]>([]);
  const [destinoMover, setDestinoMover] = useState('');
  const [nuevoNombreMover, setNuevoNombreMover] = useState('');
  const [cantidadesMover, setCantidadesMover] = useState<Record<number, number>>({});

  const loadData = useCallback(async () => {
    const [pedidoData, detalleData, itemsData, pagosData, formasData] = await Promise.all([
      getPedido(pedidoId),
      listPedidoDetalle(pedidoId),
      listProductosActivos(),
      listPagosPedido(pedidoId),
      listFormasPagoActivas(),
    ]);

    setPedido(pedidoData);
    detalleRef.current = detalleData;
    setDetalle(detalleData);
    setProductos(itemsData);
    setPagos(pagosData);
    setFormasPago(formasData);
    setTotales(pedidoData ? await getTotalesPedido(pedidoData, detalleData) : null);
  }, [pedidoId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleMesaNombreChange = async (value: string) => {
    if (!pedido) return;
    setPedido({ ...pedido, mesa_nombre: value });
  };

  const handleImprimir = async () => {
    if (impresionEnCurso.current) return;
    impresionEnCurso.current = true;
    setImprimiendo(true);
    try {
      await printOrderTicket(pedidoId);
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

  const handleMesaNombreBlur = async () => {
    if (!pedido || !editable) return;
    const nombre = pedido.mesa_nombre.trim();
    if (!nombre) {
      Alert.alert('Mesa', 'El nombre de la mesa no puede estar vacío.');
      await loadData();
      return;
    }
    if (await hasActiveOrderWithMesaName(nombre, pedido.id)) {
      Alert.alert('Mesa', 'Ya existe un pedido activo para esa mesa.');
      await loadData();
      return;
    }
    await updatePedidoMesaNombre(pedido.id, nombre);
  };

  const openEditDetalle = (item: PedidoDetalleView) => {
    setSelectedDetalle(item);
    setCantidad(String(item.cantidad));
    setShowEditItem(true);
  };

  const handleSaveCantidad = async () => {
    if (!selectedDetalle) return;
    const cantidadNum = parseDecimal(cantidad);
    if (cantidadNum === null || cantidadNum <= 0) {
      Alert.alert('Cantidad inválida', 'La cantidad debe ser un número mayor a 0.');
      return;
    }
    await updatePedidoDetalleCantidad(selectedDetalle.id, cantidadNum, selectedDetalle.precio);
    setShowEditItem(false);
    await loadData();
  };

  const handleAnularLinea = async (password: string) => {
    setShowPasswordItem(false);
    if (!(await verifySpecialPassword(password))) {
      Alert.alert('Clave inválida', 'Password invalido.');
      return;
    }
    if (!selectedDetalle) return;
    await updatePedidoDetalleStatus(selectedDetalle.id, 'Anulada');
    setShowEditItem(false);
    await loadData();
  };

  // Actualiza el detalle en pantalla sin recargar; en pedidos activos recalcula los totales en vivo.
  const aplicarDetalle = (data: PedidoDetalleView[]) => {
    detalleRef.current = data;
    setDetalle(data);
    setTotales((prev) => (prev && !prev.historico ? calcularTotales(data, prev) : prev));
  };

  const cambiarCantidad = async (detalleId: number, delta: number) => {
    const item = detalleRef.current.find((d) => d.id === detalleId);
    if (!item) return;
    const nuevaCantidad = item.cantidad + delta;
    if (nuevaCantidad <= 0) {
      // Bajar de 1 equivale a anular la línea, que requiere clave.
      Alert.alert('Anular producto', `¿Desea anular ${item.producto_nombre} del pedido?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: () => {
            setSelectedDetalle(item);
            setShowPasswordItem(true);
          },
        },
      ]);
      return;
    }
    aplicarDetalle(
      detalleRef.current.map((d) =>
        d.id === detalleId ? { ...d, cantidad: nuevaCantidad, monto: nuevaCantidad * d.precio } : d
      )
    );
    await updatePedidoDetalleCantidad(detalleId, nuevaCantidad, item.precio);
  };

  // Tocar un producto lo agrega con cantidad 1; si ya está en el pedido suma 1 a su línea.
  const handleAddItem = async (producto: Producto) => {
    setShowAddItem(false);
    const existente = detalleRef.current.find(
      (d) => d.producto_id === producto.id && d.status === 'Activa'
    );
    if (existente) {
      await cambiarCantidad(existente.id, 1);
      return;
    }
    const linea = await nextLineaForPedido(pedidoId);
    await createPedidoDetalle({
      pedidoId,
      productoId: producto.id,
      linea,
      cantidad: 1,
      precio: producto.precio,
    });
    await loadData();
  };

  const openMover = async () => {
    const activosData = await listPedidosActivos();
    setPedidosDestino(activosData.filter((p) => p.id !== pedidoId));
    setDestinoMover('');
    setNuevoNombreMover('');
    setCantidadesMover({});
    setShowMover(true);
  };

  const ajustarMover = (item: PedidoDetalleView, delta: number) => {
    setCantidadesMover((prev) => {
      const actual = prev[item.id] ?? 0;
      const nueva = Math.min(Math.max(actual + delta, 0), item.cantidad);
      return { ...prev, [item.id]: nueva };
    });
  };

  const totalUnidadesMover = Object.values(cantidadesMover).reduce((sum, c) => sum + c, 0);

  const handleMover = async () => {
    if (!destinoMover) {
      Alert.alert('Separar / mover', 'Seleccione el pedido destino.');
      return;
    }
    if (totalUnidadesMover <= 0) {
      Alert.alert('Separar / mover', 'Indique cuántas unidades mover de al menos un producto.');
      return;
    }
    const destino =
      destinoMover === 'nuevo' ? { nuevoNombre: nuevoNombreMover } : { pedidoId: Number(destinoMover) };
    const items = Object.entries(cantidadesMover).map(([detalleId, cantidad]) => ({
      detalleId: Number(detalleId),
      cantidad,
    }));

    const mover = async () => {
      try {
        const destinoId = await moverProductos(pedidoId, destino, items);
        setShowMover(false);
        await loadData();
        Alert.alert('Productos movidos', 'Los productos se pasaron al otro pedido.', [
          { text: 'Quedarme aquí', style: 'cancel' },
          { text: 'Ir al pedido destino', onPress: () => navigation.push('Pedido', { pedidoId: destinoId }) },
        ]);
      } catch (e) {
        Alert.alert('Separar / mover', e instanceof Error ? e.message : String(e));
      }
    };

    if (pagos.some((p) => p.status === 'Activo')) {
      Alert.alert(
        'Pedido con pagos',
        'Este pedido ya tiene pagos registrados. Al mover productos el total cambia y los pagos podrían dejar de cuadrar. ¿Desea continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Mover', onPress: mover },
        ]
      );
      return;
    }
    await mover();
  };

  // Monto sugerido: lo pendiente convertido a la divisa de la forma de pago (vacío si no hay pendiente).
  const montoSugerido = (forma: FormaPago | undefined) => {
    if (!forma || !totales) return '';
    const pendienteUsd = -resumirPagos(pagos, totales.totalUsd).diferenciaUsd;
    const tasa = tasaDivisa(forma.divisa, totales);
    if (pendienteUsd <= 0 || tasa <= 0) return '';
    return redondear(pendienteUsd * tasa).toFixed(2);
  };

  const openAddPago = () => {
    const forma = formasPago[0];
    setFormaPagoId(forma ? String(forma.id) : '');
    setMontoPago(montoSugerido(forma));
    setShowAddPago(true);
  };

  const handleFormaPagoChange = (value: string) => {
    setFormaPagoId(value);
    setMontoPago(montoSugerido(formasPago.find((f) => String(f.id) === value)));
  };

  const formaPagoSeleccionada = formasPago.find((f) => String(f.id) === formaPagoId);

  const handleSavePago = async () => {
    if (!totales) return;
    const forma = formaPagoSeleccionada;
    if (!forma) {
      Alert.alert('Pago', 'Seleccione una forma de pago.');
      return;
    }
    const monto = parseDecimal(montoPago);
    if (monto === null || monto <= 0) {
      Alert.alert('Monto inválido', 'El monto debe ser un número mayor a 0.');
      return;
    }
    const tasa = tasaDivisa(forma.divisa, totales);
    if (tasa <= 0) {
      Alert.alert('Tasa no configurada', `Configure la tasa de cambio ${forma.divisa} en Parámetros.`);
      return;
    }
    const montoUsd = monto / tasa;

    const registrar = async () => {
      await createPedidoPago({
        pedidoId,
        formaPagoId: forma.id,
        divisa: forma.divisa,
        monto,
        tasa,
        montoUsd,
      });
      setShowAddPago(false);
      await loadData();
    };

    const nuevo = resumirPagos(pagos, totales.totalUsd, montoUsd);
    if (nuevo.exacto) {
      await registrar();
      return;
    }
    Alert.alert(
      'Monto diferente al total',
      `Con este pago se habrán pagado ${nuevo.pagadoUsd.toFixed(2)} USD de un total de ` +
        `${nuevo.totalUsd.toFixed(2)} USD.\n${describirDiferencia(nuevo)}.\n\n¿Desea registrar el pago?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Registrar', onPress: registrar },
      ]
    );
  };

  const handleAnularPagoPress = (pago: PedidoPagoView) => {
    Alert.alert(
      'Anular pago',
      `¿Desea anular el pago de ${pago.monto.toFixed(2)} ${pago.divisa} (${pago.forma_pago_nombre})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: () => {
            setSelectedPago(pago);
            setShowPasswordPago(true);
          },
        },
      ]
    );
  };

  const handleAnularPago = async (password: string) => {
    setShowPasswordPago(false);
    if (!(await verifySpecialPassword(password))) {
      Alert.alert('Clave inválida', 'Password invalido.');
      return;
    }
    if (!selectedPago) return;
    await updatePedidoPagoStatus(selectedPago.id, 'Anulado');
    await loadData();
  };

  const handleFinalizar = async () => {
    const finalizar = async () => {
      await finalizarPedidoConTotales(pedidoId);
      navigation.navigate('Drawer');
    };
    const resumen = totales ? resumirPagos(pagos, totales.totalUsd) : null;
    if (!resumen || resumen.exacto) {
      Alert.alert('Finalizar pedido', '¿Está seguro de finalizar este pedido?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Finalizar', onPress: finalizar },
      ]);
      return;
    }
    Alert.alert(
      'Finalizar pedido',
      `Pagado ${resumen.pagadoUsd.toFixed(2)} USD de ${resumen.totalUsd.toFixed(2)} USD.\n` +
        `${describirDiferencia(resumen)}.\n\n¿Desea finalizar de todas formas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar pago',
          onPress: () => {
            setTab('Pagos');
            openAddPago();
          },
        },
        { text: 'Finalizar', onPress: finalizar },
      ]
    );
  };

  const handleAnularPedido = async (password: string) => {
    setShowPasswordPedido(false);
    if (!(await verifySpecialPassword(password))) {
      Alert.alert('Clave inválida', 'Password invalido.');
      return;
    }
    await updatePedidoStatus(pedidoId, 'Anulado');
    navigation.navigate('Drawer');
  };

  const editable = pedido?.status === 'Activo';
  // Los pagos se pueden registrar también después de finalizar; solo un pedido anulado los bloquea.
  const pagosEditable = !!pedido && pedido.status !== 'Anulado';
  const montoPagoNum = parseDecimal(montoPago);
  const tasaPago = formaPagoSeleccionada && totales ? tasaDivisa(formaPagoSeleccionada.divisa, totales) : 0;
  const activos = detalle.filter((d) => d.status === 'Activa');

  const countByTipo = activos.reduce<Record<ProductoTipo, number>>((acc, item) => {
    const tipo = item.producto_tipo;
    acc[tipo] = (acc[tipo] || 0) + item.cantidad;
    return acc;
  }, { Entrada: 0, Bebidas: 0, Postres: 0, Principal: 0 });

  const productosFiltrados = productos
    .filter((item) => (tipoFiltro === 'Todos' ? true : item.tipo === tipoFiltro))
    .sort((a, b) => {
      const orderDiff = tipoOrder.indexOf(a.tipo) - tipoOrder.indexOf(b.tipo);
      if (orderDiff !== 0) return orderDiff;
      return a.nombre.localeCompare(b.nombre);
    });

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.label}>Mesa</Text>
        <TextInput
          style={commonStyles.input}
          value={pedido?.mesa_nombre || ''}
          onChangeText={handleMesaNombreChange}
          onBlur={handleMesaNombreBlur}
          editable={editable}
        />
        {pedido && !editable ? (
          <Text style={styles.readOnlyText}>
            Pedido {pedido.status}: solo lectura{pagosEditable ? ' (se pueden agregar pagos)' : ''}.
          </Text>
        ) : null}
        <Text style={commonStyles.mutedText}>
          Creado: {pedido ? new Date(pedido.created_at).toLocaleString() : '-'}
        </Text>
      </View>

      <SegmentedTabs
        tabs={['Productos', 'General', 'Pagos']}
        active={tab}
        onChange={(t) => setTab(t as PedidoTab)}
      />

      {tab === 'Productos' ? (
        <View style={commonStyles.card}>
          {editable && activos.length > 0 ? (
            <TouchableOpacity style={styles.moverButton} onPress={openMover}>
              <Text style={styles.moverButtonText}>Separar / mover productos</Text>
            </TouchableOpacity>
          ) : null}
          <FlatList
            data={activos}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.row}>
                {editable ? (
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => cambiarCantidad(item.id, -1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.rowCenter}
                  onPress={() => openEditDetalle(item)}
                  disabled={!editable}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.producto_nombre}</Text>
                    <Text style={commonStyles.mutedText}>{item.cantidad} x ${item.precio.toFixed(2)}</Text>
                    {item.origen_mesa_nombre ? (
                      <Text style={styles.origenText}>Movido de {item.origen_mesa_nombre}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.monto}>${item.monto.toFixed(2)}</Text>
                </TouchableOpacity>
                {editable ? (
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => cambiarCantidad(item.id, 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
            ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay productos en el pedido.</Text>}
          />
        </View>
      ) : tab === 'Pagos' ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>Pagos</Text>
          {totales ? (
            <PagosResumen
              pagos={pagos}
              totales={totales}
              onAnularPago={pagosEditable ? handleAnularPagoPress : undefined}
            />
          ) : null}
        </View>
      ) : (
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>Resumen</Text>
          {totales ? <TotalesResumen totales={totales} /> : null}

          <Text style={commonStyles.title}>Cantidad por tipo</Text>
          {tipoOrder.map((tipo) => (
            <Text key={tipo} style={styles.resumeLine}>
              {tipo}: {countByTipo[tipo] || 0}
            </Text>
          ))}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primary]}
              onPress={handleImprimir}
              disabled={imprimiendo}
            >
              <Text style={styles.actionText}>{imprimiendo ? 'Imprimiendo…' : 'Imprimir'}</Text>
            </TouchableOpacity>
            {editable ? (
              <>
                <TouchableOpacity style={[styles.actionButton, styles.success]} onPress={handleFinalizar}>
                  <Text style={styles.actionText}>Finalizar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.danger]} onPress={() => setShowPasswordPedido(true)}>
                  <Text style={styles.actionText}>Anular</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      )}

      {tab === 'Productos' && editable ? (
        <FloatingActionButton onPress={() => setShowAddItem(true)} />
      ) : null}

      {tab === 'Pagos' && pagosEditable ? <FloatingActionButton onPress={openAddPago} /> : null}

      <ModalContainer
        visible={showMover}
        title="Separar / mover productos"
        onClose={() => setShowMover(false)}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={handleMover}>
            <Text style={commonStyles.buttonText}>
              Mover{totalUnidadesMover > 0 ? ` (${totalUnidadesMover})` : ''}
            </Text>
          </TouchableOpacity>
        }
      >
        <Text style={commonStyles.label}>Pedido destino</Text>
        <SelectPicker
          options={[
            { label: 'Seleccione destino', value: '' },
            { label: '+ Nuevo pedido…', value: 'nuevo' },
            ...pedidosDestino.map((p) => ({ label: `${p.mesa_nombre} (#${p.id})`, value: String(p.id) })),
          ]}
          value={destinoMover}
          onChange={setDestinoMover}
        />
        {destinoMover === 'nuevo' ? (
          <>
            <Text style={commonStyles.label}>Nombre del nuevo pedido</Text>
            <TextInput
              style={commonStyles.input}
              value={nuevoNombreMover}
              onChangeText={setNuevoNombreMover}
              placeholder="Ej: Mesa 2 - Carlos"
            />
          </>
        ) : null}
        <Text style={commonStyles.label}>Cantidad a mover</Text>
        <ScrollView style={styles.moverList}>
          {activos.map((item) => {
            const cantidadMover = cantidadesMover[item.id] ?? 0;
            return (
              <View key={item.id} style={styles.moverRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.producto_nombre}</Text>
                  <Text style={commonStyles.mutedText}>En pedido: {item.cantidad}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.stepButton, cantidadMover <= 0 && styles.stepDisabled]}
                  onPress={() => ajustarMover(item, -1)}
                  disabled={cantidadMover <= 0}
                >
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.moverCantidad}>{cantidadMover}</Text>
                <TouchableOpacity
                  style={[styles.stepButton, cantidadMover >= item.cantidad && styles.stepDisabled]}
                  onPress={() => ajustarMover(item, 1)}
                  disabled={cantidadMover >= item.cantidad}
                >
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </ModalContainer>

      <ModalContainer
        visible={showAddPago}
        title="Agregar pago"
        onClose={() => setShowAddPago(false)}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={handleSavePago}>
            <Text style={commonStyles.buttonText}>Registrar pago</Text>
          </TouchableOpacity>
        }
      >
        {formasPago.length === 0 ? (
          <Text style={commonStyles.mutedText}>
            No hay formas de pago activas. Configúrelas en el menú Formas de pago.
          </Text>
        ) : (
          <>
            <Text style={commonStyles.label}>Forma de pago</Text>
            <SelectPicker
              options={formasPago.map((f) => ({ label: `${f.nombre} (${f.divisa})`, value: String(f.id) }))}
              value={formaPagoId}
              onChange={handleFormaPagoChange}
            />
            <Text style={commonStyles.label}>Monto ({formaPagoSeleccionada?.divisa})</Text>
            <TextInput
              style={commonStyles.input}
              value={montoPago}
              onChangeText={setMontoPago}
              keyboardType="decimal-pad"
            />
            {formaPagoSeleccionada && formaPagoSeleccionada.divisa !== 'USD' ? (
              <Text style={commonStyles.mutedText}>
                {tasaPago > 0
                  ? `Tasa ${tasaPago} · ≈ ${((montoPagoNum ?? 0) / tasaPago).toFixed(2)} USD`
                  : `Tasa ${formaPagoSeleccionada.divisa} sin configurar en Parámetros.`}
              </Text>
            ) : null}
          </>
        )}
      </ModalContainer>

      <ModalContainer
        visible={showAddItem}
        title="Agregar producto"
        onClose={() => setShowAddItem(false)}
      >
        <Text style={commonStyles.label}>Tipo</Text>
        <SelectPicker options={tipoFilterOptions} value={tipoFiltro} onChange={setTipoFiltro} />
        <Text style={commonStyles.mutedText}>Toque un producto para agregarlo (cantidad 1).</Text>
        <FlatList
          style={styles.productosList}
          data={productosFiltrados}
          keyExtractor={(producto) => producto.id.toString()}
          renderItem={({ item }) => {
            const enPedido = activos
              .filter((d) => d.producto_id === item.id)
              .reduce((sum, d) => sum + d.cantidad, 0);
            return (
              <TouchableOpacity style={styles.itemRow} onPress={() => handleAddItem(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.nombre}</Text>
                  <Text style={commonStyles.mutedText}>
                    {item.tipo}
                    {enPedido > 0 ? ` · en pedido: ${enPedido}` : ''}
                  </Text>
                </View>
                <Text style={styles.monto}>${item.precio.toFixed(2)}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay productos activos.</Text>}
        />
      </ModalContainer>

      <ModalContainer
        visible={showEditItem}
        title="Editar producto"
        onClose={() => setShowEditItem(false)}
        footer={
          <View style={styles.footerActions}>
            <TouchableOpacity style={[styles.actionButton, styles.danger]} onPress={() => setShowPasswordItem(true)}>
              <Text style={styles.actionText}>Anular</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.primary]} onPress={handleSaveCantidad}>
              <Text style={styles.actionText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={commonStyles.label}>Producto</Text>
        <Text style={styles.readonly}>{selectedDetalle?.producto_nombre}</Text>
        <Text style={commonStyles.label}>Cantidad</Text>
        <TextInput
          style={commonStyles.input}
          value={cantidad}
          onChangeText={setCantidad}
          keyboardType="decimal-pad"
        />
      </ModalContainer>

      <PasswordPrompt
        visible={showPasswordItem}
        title="Anular línea"
        onCancel={() => setShowPasswordItem(false)}
        onConfirm={handleAnularLinea}
      />

      <PasswordPrompt
        visible={showPasswordPedido}
        title="Anular pedido"
        onCancel={() => setShowPasswordPedido(false)}
        onConfirm={handleAnularPedido}
      />

      <PasswordPrompt
        visible={showPasswordPago}
        title="Anular pago"
        onCancel={() => setShowPasswordPago(false)}
        onConfirm={handleAnularPago}
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 22,
  },
  stepDisabled: {
    opacity: 0.3,
  },
  origenText: {
    fontSize: 12,
    color: colors.primary,
  },
  moverButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moverButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  moverList: {
    maxHeight: 360,
  },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moverCantidad: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  productosList: {
    maxHeight: 420,
    marginTop: spacing.xs,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  monto: {
    fontWeight: '600',
  },
  itemRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readonly: {
    marginBottom: spacing.sm,
  },
  readOnlyText: {
    color: colors.danger,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  resumeLine: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  success: {
    backgroundColor: colors.success,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
