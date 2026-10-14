import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { PedidoPagoView, TotalesPedido } from '../db/types';
import { divisas, resumirPagos, tasaDivisa } from '../services/pagosService';
import { colors, radius, spacing } from '../styles/theme';

interface Props {
  pagos: PedidoPagoView[];
  totales: TotalesPedido;
  // Si se pasa, cada pago muestra un botón Anular.
  onAnularPago?: (pago: PedidoPagoView) => void;
}

export const PagosResumen: React.FC<Props> = ({ pagos, totales, onAnularPago }) => {
  const activos = pagos.filter((p) => p.status === 'Activo');
  const resumen = resumirPagos(pagos, totales.totalUsd);
  const diferencia = Math.abs(resumen.diferenciaUsd);
  const pendiente = resumen.diferenciaUsd < 0;

  return (
    <View>
      {activos.length === 0 ? <Text style={styles.muted}>Sin pagos registrados.</Text> : null}
      {activos.map((pago) => (
        <View key={pago.id} style={styles.pagoRow}>
          <View style={styles.pagoInfo}>
            <Text style={styles.pagoNombre}>{pago.forma_pago_nombre}</Text>
            {pago.divisa !== 'USD' ? (
              <Text style={styles.muted}>
                ≈ {pago.monto_usd.toFixed(2)} USD (tasa {pago.tasa})
              </Text>
            ) : null}
          </View>
          <Text style={styles.pagoMonto}>
            {pago.monto.toFixed(2)} {pago.divisa}
          </Text>
          {onAnularPago ? (
            <TouchableOpacity
              style={styles.anularButton}
              onPress={() => onAnularPago(pago)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.anularText}>Anular</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      <View style={styles.resumen}>
        <View style={styles.resumenRow}>
          <Text style={styles.muted}>Total pedido</Text>
          <Text style={styles.valor}>{resumen.totalUsd.toFixed(2)} USD</Text>
        </View>
        <View style={styles.resumenRow}>
          <Text style={styles.muted}>Pagado</Text>
          <Text style={styles.valor}>{resumen.pagadoUsd.toFixed(2)} USD</Text>
        </View>
        {resumen.exacto ? (
          <Text style={[styles.estado, styles.ok]}>Pagado completo</Text>
        ) : (
          <View>
            <Text style={[styles.estado, pendiente ? styles.pendiente : styles.excedente]}>
              {pendiente ? 'Pendiente' : 'Excedente (propina)'}
            </Text>
            <Text style={styles.equivalencias}>
              {divisas
                .filter((divisa) => tasaDivisa(divisa, totales) > 0)
                .map((divisa) => `${(diferencia * tasaDivisa(divisa, totales)).toFixed(2)} ${divisa}`)
                .join('  ·  ')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pagoInfo: {
    flex: 1,
  },
  pagoNombre: {
    fontWeight: '600',
    color: colors.text,
  },
  pagoMonto: {
    fontWeight: '600',
    color: colors.text,
  },
  anularButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  anularText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 12,
  },
  muted: {
    color: colors.muted,
  },
  resumen: {
    marginTop: spacing.sm,
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  valor: {
    fontWeight: '600',
    color: colors.text,
  },
  estado: {
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  ok: {
    color: colors.success,
  },
  pendiente: {
    color: colors.danger,
  },
  excedente: {
    color: colors.primary,
  },
  equivalencias: {
    color: colors.text,
    marginTop: 2,
  },
});
