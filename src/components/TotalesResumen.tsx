import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TotalesPedido } from '../db/types';
import { colors, spacing } from '../styles/theme';

interface Props {
  totales: TotalesPedido;
}

const formatMonto = (value: number) => value.toFixed(2);

export const TotalesResumen: React.FC<Props> = ({ totales }) => {
  const propina = (total: number) => (total * totales.propinaPct) / 100;
  const filas = [
    { divisa: 'USD', total: totales.totalUsd },
    { divisa: 'COP', total: totales.totalCop },
    { divisa: 'BS', total: totales.totalBs },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.row, styles.header]}>
        <Text style={[styles.divisa, styles.headerText]}>Divisa</Text>
        <Text style={[styles.cell, styles.headerText]}>Total</Text>
        <Text style={[styles.cell, styles.headerText]}>Propina {totales.propinaPct}%</Text>
      </View>
      {filas.map((fila) => (
        <View key={fila.divisa} style={styles.row}>
          <Text style={styles.divisa}>{fila.divisa}</Text>
          <Text style={[styles.cell, styles.total]}>{formatMonto(fila.total)}</Text>
          <Text style={styles.cell}>{formatMonto(propina(fila.total))}</Text>
        </View>
      ))}
      <Text style={styles.nota}>
        {totales.historico ? 'Tasas al finalizar' : 'Calculado con tasas actuales'}: COP {totales.tasaCop} · BS{' '}
        {totales.tasaBs}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    color: colors.muted,
    fontWeight: '600',
  },
  divisa: {
    width: 56,
    fontWeight: '600',
    color: colors.text,
  },
  cell: {
    flex: 1,
    textAlign: 'right',
    color: colors.text,
  },
  total: {
    fontWeight: '600',
  },
  nota: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.muted,
  },
});
