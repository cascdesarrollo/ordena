import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SelectPicker } from '../components/SelectPicker';
import type {
  FormaPago,
  PresentacionReportePagos,
  ReportePagos,
  ReportePagosFiltro,
} from '../db/types';
import { consultarReportePagos } from '../services/reportePagosService';
import { imprimirReportePagos } from '../services/printService';
import { divisas } from '../services/pagosService';
import { localDateString } from '../utils/format';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';

const presentaciones: PresentacionReportePagos[] = ['Consolidado', 'Detallado', 'Ambos'];

export const ReportePagosScreen = () => {
  const [filtro, setFiltro] = useState<ReportePagosFiltro>(() => ({
    fechaInicio: localDateString(),
    fechaFin: localDateString(),
    formaPagoId: null,
  }));
  const filtroRef = useRef(filtro);
  const consultaId = useRef(0);
  const impresionEnCurso = useRef(false);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [presentacion, setPresentacion] = useState<PresentacionReportePagos>('Consolidado');
  const [reporte, setReporte] = useState<ReportePagos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const loadData = useCallback(async () => {
    const id = ++consultaId.current;
    const filtroConsulta = { ...filtroRef.current };
    setCargando(true);
    setReporte(null);
    try {
      const resultado = await consultarReportePagos(filtroConsulta);
      if (consultaId.current !== id) return;
      setFormasPago(resultado.formasPago);
      setReporte(resultado.reporte);
    } catch (error) {
      if (consultaId.current === id) {
        Alert.alert('No se pudo consultar el reporte', error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (consultaId.current === id) setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => { consultaId.current += 1; };
  }, [loadData]));

  const cambiarFiltro = (cambio: Partial<ReportePagosFiltro>) => {
    const nuevo = { ...filtroRef.current, ...cambio };
    filtroRef.current = nuevo;
    setFiltro(nuevo);
    consultaId.current += 1;
    setCargando(false);
    setReporte(null);
  };

  const handleImprimir = async () => {
    if (!reporte || impresionEnCurso.current) return;
    impresionEnCurso.current = true;
    setImprimiendo(true);
    try {
      await imprimirReportePagos(reporte, presentacion);
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

  const ocupado = cargando || imprimiendo;
  return (
    <View style={commonStyles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>Filtros de pagos</Text>
          <Text style={styles.nota}>Por fecha del pago, no del pedido. Solo pagos vigentes.</Text>
          <Text style={commonStyles.label}>Fecha inicio (YYYY-MM-DD)</Text>
          <TextInput
            style={commonStyles.input}
            value={filtro.fechaInicio}
            editable={!ocupado}
            onChangeText={(fechaInicio) => cambiarFiltro({ fechaInicio })}
          />
          <Text style={commonStyles.label}>Fecha fin (YYYY-MM-DD)</Text>
          <TextInput
            style={commonStyles.input}
            value={filtro.fechaFin}
            editable={!ocupado}
            onChangeText={(fechaFin) => cambiarFiltro({ fechaFin })}
          />
          <Text style={commonStyles.label}>Forma de pago</Text>
          <SelectPicker
            value={filtro.formaPagoId === null ? '' : String(filtro.formaPagoId)}
            options={[
              { label: 'Todas', value: '' },
              ...formasPago.map((forma) => ({
                label: `${forma.nombre}${forma.status === 'Inactivo' ? ' (inactiva)' : ''}`,
                value: String(forma.id),
              })),
            ]}
            onChange={(value) => cambiarFiltro({ formaPagoId: value ? Number(value) : null })}
            disabled={ocupado}
          />
          <Text style={commonStyles.label}>Presentación en pantalla e impresión</Text>
          <SelectPicker
            value={presentacion}
            options={presentaciones}
            onChange={setPresentacion}
            disabled={ocupado}
          />
          <TouchableOpacity
            style={[commonStyles.button, ocupado && styles.disabled]}
            onPress={loadData}
            disabled={ocupado}
          >
            <Text style={commonStyles.buttonText}>{cargando ? 'Consultando…' : 'Consultar'}</Text>
          </TouchableOpacity>
        </View>

        <View style={commonStyles.card}>
          <TouchableOpacity
            style={[commonStyles.button, (!reporte || ocupado) && styles.disabled]}
            onPress={handleImprimir}
            disabled={!reporte || ocupado}
          >
            <Text style={commonStyles.buttonText}>
              {imprimiendo ? 'Imprimiendo…' : `Imprimir ${presentacion.toLowerCase()}`}
            </Text>
          </TouchableOpacity>
          {!reporte ? (
            <Text style={styles.nota}>
              {cargando ? 'Cargando pagos…' : 'Consulte para ver e imprimir los resultados de estos filtros.'}
            </Text>
          ) : (
            <>
              <Text style={styles.titulo}>Resultados consultados</Text>
              <Text style={styles.nota}>
                {reporte.filtro.fechaInicio} al {reporte.filtro.fechaFin} · {reporte.formaPagoNombre}
                {'\n'}Consultado: {new Date(reporte.consultadoEn).toLocaleString()}
              </Text>
              {reporte.pagosPedidosAnulados > 0 ? (
                <Text style={styles.advertencia}>
                  Atención: se incluyen {reporte.pagosPedidosAnulados} pagos vigentes de pedidos anulados.
                  Revise esos cobros; no se excluyen del total.
                </Text>
              ) : null}
              {reporte.cantidadPagos === 0 ? (
                <Text style={styles.nota}>Sin pagos vigentes en el período.</Text>
              ) : null}

              {presentacion !== 'Detallado' ? (
                <>
                  <Text style={styles.titulo}>Consolidado por forma de pago</Text>
                  {reporte.grupos.map((grupo) => (
                    <View key={`${grupo.formaPagoId}:${grupo.divisa}`} style={styles.grupo}>
                      <Text style={styles.valor}>{grupo.nombre} ({grupo.divisa})</Text>
                      <Text style={styles.valor}>
                        {grupo.pagos.length} pagos · {grupo.monto.toFixed(2)} {grupo.divisa}
                      </Text>
                      <Text style={styles.nota}>Equivalente: {grupo.montoUsd.toFixed(2)} USD</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {presentacion !== 'Consolidado' ? (
                <>
                  <Text style={styles.titulo}>Detalle por forma de pago</Text>
                  {reporte.grupos.map((grupo) => (
                    <View key={`${grupo.formaPagoId}:${grupo.divisa}`} style={styles.grupo}>
                      <Text style={styles.valor}>{grupo.nombre} ({grupo.divisa})</Text>
                      {grupo.pagos.map((pago) => (
                        <View key={pago.id} style={styles.pago}>
                          <Text style={styles.valor}>Pago #{pago.id} · Pedido #{pago.pedido_id}</Text>
                          <Text style={styles.nota}>
                            {pago.mesa_nombre} · {new Date(pago.created_at).toLocaleString()}
                          </Text>
                          <Text style={pago.pedido_status === 'Anulado' ? styles.advertencia : styles.nota}>
                            Pedido {pago.pedido_status}
                          </Text>
                          <Text style={styles.valor}>{pago.monto.toFixed(2)} {pago.divisa}</Text>
                          <Text style={styles.nota}>
                            Tasa guardada: {pago.tasa} por USD · Equivalente: {pago.monto_usd.toFixed(2)} USD
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.valor}>
                        Subtotal ({grupo.pagos.length} pagos): {grupo.monto.toFixed(2)} {grupo.divisa}
                      </Text>
                      <Text style={styles.nota}>Equivalente: {grupo.montoUsd.toFixed(2)} USD</Text>
                    </View>
                  ))}
                </>
              ) : null}

              <Text style={styles.titulo}>Totales recibidos ({reporte.cantidadPagos} pagos)</Text>
              {divisas.map((divisa) => (
                <Text key={divisa} style={styles.valor}>
                  {divisa}: {reporte.totalesPorDivisa[divisa].toFixed(2)}
                </Text>
              ))}
              <Text style={styles.titulo}>Equivalente total: {reporte.equivalenteUsd.toFixed(2)} USD</Text>
              <Text style={styles.nota}>
                Equivalentes calculados con los importes USD guardados en cada pago, no con las tasas actuales.
                Este reporte de cobros no es un cierre de caja.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  valor: {
    color: colors.text,
    fontWeight: '600',
  },
  nota: {
    color: colors.muted,
    marginVertical: spacing.xs,
  },
  advertencia: {
    color: colors.danger,
    fontWeight: '600',
    marginVertical: spacing.xs,
  },
  grupo: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  pago: {
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
});
