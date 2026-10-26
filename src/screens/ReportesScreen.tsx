import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { commonStyles } from '../styles/common';

export const ReportesScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={commonStyles.screen}>
      <ScrollView>
        <TouchableOpacity
          accessibilityRole="button"
          style={commonStyles.card}
          onPress={() => navigation.navigate('Reporte')}
        >
          <Text style={commonStyles.title}>Reporte de pedidos</Text>
          <Text style={commonStyles.mutedText}>
            Consultar pedidos por fecha y estado, ver su detalle e imprimir tickets.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={commonStyles.card}
          onPress={() => navigation.navigate('ReportePagos')}
        >
          <Text style={commonStyles.title}>Reporte de pagos</Text>
          <Text style={commonStyles.mutedText}>
            Consultar e imprimir cobros por forma de pago, consolidados o detallados.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={commonStyles.card}
          onPress={() => navigation.navigate('ReporteVentas')}
        >
          <Text style={commonStyles.title}>Análisis de ventas</Text>
          <Text style={commonStyles.mutedText}>
            Productos vendidos por tipo y período, consolidados o por línea de pedido, con impresión.
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
