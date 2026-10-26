import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import type { PedidoDescuentoView } from '../db/types';
import { colors, spacing } from '../styles/theme';

interface Props {
  descuentos: PedidoDescuentoView[];
  onAnular?: (descuento: PedidoDescuentoView) => void;
}

export const DescuentosResumen: React.FC<Props> = ({ descuentos, onAnular }) => {
  const activos = descuentos.filter((descuento) => descuento.status === 'Activo');
  if (activos.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Descuentos</Text>
      {activos.map((descuento) => (
        <View key={descuento.id} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.description}>{descuento.descripcion}</Text>
            {descuento.producto_nombre ? (
              <Text style={styles.association}>
                Asociado a: {descuento.producto_nombre}
                {descuento.producto_linea !== null &&
                descuento.producto_linea !== undefined &&
                descuento.producto_cantidad !== null &&
                descuento.producto_cantidad !== undefined &&
                descuento.producto_precio !== null &&
                descuento.producto_precio !== undefined
                  ? ` (línea ${descuento.producto_linea}: ${descuento.producto_cantidad} x $${descuento.producto_precio?.toFixed(2)})`
                  : ''}
              </Text>
            ) : null}
          </View>
          <Text style={styles.amount}>-${descuento.monto_usd.toFixed(2)}</Text>
          {onAnular ? (
            <TouchableOpacity onPress={() => onAnular(descuento)} style={styles.cancel}>
              <Text style={styles.cancelText}>Anular</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  title: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
  },
  description: {
    color: colors.text,
    fontWeight: '600',
  },
  association: {
    color: colors.muted,
    fontSize: 12,
  },
  amount: {
    color: colors.danger,
    fontWeight: '700',
  },
  cancel: {
    padding: spacing.xs,
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '600',
  },
});
