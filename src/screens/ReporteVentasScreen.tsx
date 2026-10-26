import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SelectPicker } from '../components/SelectPicker';
import type { PresentacionReporte, RangoReporte, ReporteVentas } from '../db/types';
import { consultarReporteVentas } from '../services/reporteVentasService';
import { imprimirReporteVentas } from '../services/printService';
import { localDateString } from '../utils/format';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';

export const ReporteVentasScreen = () => {
  const [filtro, setFiltro] = useState<RangoReporte>(() => ({
    fechaInicio: localDateString(), fechaFin: localDateString(),
  }));
  const filtroRef = useRef(filtro);
  const consultaId = useRef(0);
  const impresionEnCurso = useRef(false);
  const [presentacion, setPresentacion] = useState<PresentacionReporte>('Consolidado');
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const loadData = useCallback(async () => {
    const id = ++consultaId.current;
    setCargando(true);
    setReporte(null);
    try {
      const resultado = await consultarReporteVentas({ ...filtroRef.current });
      if (id === consultaId.current) setReporte(resultado);
    } catch (error) {
      if (id === consultaId.current) {
        Alert.alert('No se pudo consultar el reporte', error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (id === consultaId.current) setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => { consultaId.current += 1; };
  }, [loadData]));

  const cambiarFiltro = (cambio: Partial<RangoReporte>) => {
    filtroRef.current = { ...filtroRef.current, ...cambio };
    setFiltro(filtroRef.current);
    consultaId.current += 1;
    setCargando(false);
    setReporte(null);
  };

  const handleImprimir = async () => {
    if (!reporte || impresionEnCurso.current) return;
    impresionEnCurso.current = true;
    setImprimiendo(true);
    try {
      await imprimirReporteVentas(reporte, presentacion);
    } catch (error) {
      Alert.alert('No se pudo completar la impresión',
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        'Si comenzó a imprimir, revise el papel antes de reintentar.');
    } finally {
      impresionEnCurso.current = false;
      setImprimiendo(false);
    }
  };

  return (
    <View style={commonStyles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>Análisis de ventas por producto</Text>
          <Text style={styles.nota}>
            Solo pedidos finalizados. Período por fecha de creación del pedido.
            Precios e importes originales en USD, no los precios actuales del catálogo.
          </Text>
          <Text style={commonStyles.label}>Fecha inicio (YYYY-MM-DD)</Text>
          <TextInput style={commonStyles.input} value={filtro.fechaInicio} editable={!imprimiendo}
            onChangeText={(fechaInicio) => cambiarFiltro({ fechaInicio })} />
          <Text style={commonStyles.label}>Fecha fin (YYYY-MM-DD)</Text>
          <TextInput style={commonStyles.input} value={filtro.fechaFin} editable={!imprimiendo}
            onChangeText={(fechaFin) => cambiarFiltro({ fechaFin })} />
          <Text style={commonStyles.label}>Presentación en pantalla e impresión</Text>
          <SelectPicker<PresentacionReporte> options={['Consolidado', 'Detallado']}
            value={presentacion} onChange={setPresentacion} disabled={imprimiendo} />
          <TouchableOpacity style={[commonStyles.button, (cargando || imprimiendo) && styles.disabled]}
            onPress={loadData} disabled={cargando || imprimiendo}>
            <Text style={commonStyles.buttonText}>{cargando ? 'Consultando…' : 'Consultar'}</Text>
          </TouchableOpacity>
        </View>
        <View style={commonStyles.card}>
          <TouchableOpacity
            style={[commonStyles.button, (!reporte || cargando || imprimiendo) && styles.disabled]}
            onPress={handleImprimir} disabled={!reporte || cargando || imprimiendo}>
            <Text style={commonStyles.buttonText}>
              {imprimiendo ? 'Imprimiendo…' : `Imprimir ${presentacion.toLowerCase()}`}
            </Text>
          </TouchableOpacity>
          {reporte ? (
            <Text style={styles.nota}>
              {reporte.filtro.fechaInicio} al {reporte.filtro.fechaFin}
              {'\n'}Consultado: {new Date(reporte.consultadoEn).toLocaleString()}
              {'\n'}{reporte.cantidadPedidos} pedidos finalizados
              {reporte.cantidadPedidos === 0 ? '\nSin ventas en el período.' : ''}
            </Text>
          ) : (
            <Text style={styles.nota}>Consulte para ver e imprimir los resultados de estos filtros.</Text>
          )}
        </View>
        {reporte?.grupos.filter((grupo) => grupo.productos.length > 0).map((grupo) => (
          <View key={grupo.tipo} style={commonStyles.card}>
            <Text style={commonStyles.title}>{grupo.tipo}</Text>
            {grupo.productos.map((producto) => (
              <View key={producto.productoId} style={styles.producto}>
                <Text style={styles.valor}>{producto.nombre}</Text>
                {presentacion === 'Detallado' ? producto.lineas.map((linea) => (
                  <View key={linea.id} style={styles.linea}>
                    <Text style={styles.valor}>Pedido #{linea.pedido_id} · {linea.mesa_nombre}</Text>
                    <Text style={styles.nota}>
                      Fecha pedido: {new Date(linea.fecha_pedido).toLocaleString()}
                    </Text>
                    <Text style={styles.valor}>
                      Línea {linea.linea}: {linea.cantidad} x {linea.precio.toFixed(2)} USD
                      {' = '}{linea.monto.toFixed(2)} USD
                    </Text>
                  </View>
                )) : null}
                <Text style={styles.valor}>
                  {producto.cantidad} unidades · Total: {producto.montoUsd.toFixed(2)} USD
                </Text>
              </View>
            ))}
            <Text style={styles.valor}>
              Subtotal {grupo.tipo}: {grupo.cantidad} unidades · {grupo.montoUsd.toFixed(2)} USD
            </Text>
          </View>
        ))}
        {reporte ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.title}>Resumen por tipo</Text>
            {reporte.grupos.map((grupo) => (
              <Text key={grupo.tipo} style={styles.nota}>
                {grupo.tipo}: {grupo.cantidad} unidades · {grupo.montoUsd.toFixed(2)} USD
              </Text>
            ))}
            <Text style={styles.valor}>Total unidades: {reporte.cantidad}</Text>
            <Text style={styles.valor}>Venta bruta: {reporte.brutoUsd.toFixed(2)} USD</Text>
            <Text style={styles.valor}>Descuentos: {reporte.descuentosUsd.toFixed(2)} USD</Text>
            <Text style={styles.valor}>Total neto: {reporte.netoUsd.toFixed(2)} USD</Text>
            <Text style={styles.nota}>
              Descuentos del conjunto de pedidos, sin repartir entre productos o tipos.
              Sin propina. No es un reporte de cobros.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  nota: { color: colors.muted, marginVertical: spacing.xs },
  valor: { color: colors.text, fontWeight: '600', marginVertical: spacing.xs },
  producto: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  linea: { paddingVertical: spacing.xs, paddingLeft: spacing.sm },
  disabled: { opacity: 0.5 },
});
