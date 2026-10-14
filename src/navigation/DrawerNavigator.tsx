import React from 'react';
import { Alert } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { HomeScreen } from '../screens/HomeScreen';
import { MesasScreen } from '../screens/MesasScreen';
import { ProductosScreen } from '../screens/ProductosScreen';
import { ParametrosScreen } from '../screens/ParametrosScreen';
import { ReporteScreen } from '../screens/ReporteScreen';
import { FormasPagoScreen } from '../screens/FormasPagoScreen';
import { exportDatabase } from '../services/exportService';
import type { ReporteFiltro } from '../db/types';

export type DrawerParamList = {
  Home: undefined;
  Mesas: undefined;
  Productos: undefined;
  Parametros: undefined;
  Reporte: ReporteFiltro | undefined;
  FormasPago: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const handleExport = () => {
  Alert.alert('Exportar DB', '¿Desea exportar la base de datos?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Exportar',
      onPress: async () => {
        try {
          await exportDatabase();
          Alert.alert('Exportación', 'Base de datos exportada.');
        } catch {
          Alert.alert('Exportación', 'No se pudo exportar la base de datos.');
        }
      },
    },
  ]);
};

const DrawerContent = (props: DrawerContentComponentProps) => (
  <DrawerContentScrollView {...props}>
    <DrawerItemList {...props} />
    <DrawerItem
      label="Exportar DB"
      onPress={() => {
        props.navigation.closeDrawer();
        handleExport();
      }}
    />
  </DrawerContentScrollView>
);

export const DrawerNavigator = () => (
  <Drawer.Navigator
    screenOptions={{ headerTitleAlign: 'center' }}
    drawerContent={(props) => <DrawerContent {...props} />}
  >
    <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'ORDENA' }} />
    <Drawer.Screen name="Mesas" component={MesasScreen} />
    <Drawer.Screen name="Productos" component={ProductosScreen} />
    <Drawer.Screen name="Parametros" component={ParametrosScreen} />
    <Drawer.Screen name="Reporte" component={ReporteScreen} />
    <Drawer.Screen name="FormasPago" component={FormasPagoScreen} options={{ title: 'Formas de pago' }} />
  </Drawer.Navigator>
);
