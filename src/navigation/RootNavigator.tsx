import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerNavigator } from './DrawerNavigator';
import { PedidoScreen } from '../screens/PedidoScreen';
import { ReporteScreen } from '../screens/ReporteScreen';
import { ReportePagosScreen } from '../screens/ReportePagosScreen';
import { ReporteVentasScreen } from '../screens/ReporteVentasScreen';
import type { PedidoTab, ReporteFiltro } from '../db/types';

export type RootStackParamList = {
  Drawer: undefined;
  Pedido: { pedidoId: number; tab?: PedidoTab };
  Reporte: ReporteFiltro | undefined;
  ReportePagos: undefined;
  ReporteVentas: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Drawer" component={DrawerNavigator} />
      <Stack.Screen
        name="Reporte"
        component={ReporteScreen}
        options={{ headerShown: true, title: 'Reporte de pedidos' }}
      />
      <Stack.Screen
        name="ReportePagos"
        component={ReportePagosScreen}
        options={{ headerShown: true, title: 'Reporte de pagos' }}
      />
      <Stack.Screen
        name="ReporteVentas"
        component={ReporteVentasScreen}
        options={{ headerShown: true, title: 'Análisis de ventas' }}
      />
      <Stack.Screen
        name="Pedido"
        component={PedidoScreen}
        options={({ route }) => ({ headerShown: true, title: `Pedido #${route.params.pedidoId}` })}
      />
    </Stack.Navigator>
  </NavigationContainer>
);
