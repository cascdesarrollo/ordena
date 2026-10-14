import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerNavigator } from './DrawerNavigator';
import { PedidoScreen } from '../screens/PedidoScreen';
import type { PedidoTab } from '../db/types';

export type RootStackParamList = {
  Drawer: undefined;
  Pedido: { pedidoId: number; tab?: PedidoTab };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Drawer" component={DrawerNavigator} />
      <Stack.Screen
        name="Pedido"
        component={PedidoScreen}
        options={({ route }) => ({ headerShown: true, title: `Pedido #${route.params.pedidoId}` })}
      />
    </Stack.Navigator>
  </NavigationContainer>
);
