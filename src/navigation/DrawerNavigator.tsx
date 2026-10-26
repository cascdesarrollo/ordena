import React from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
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
import { ReportesScreen } from '../screens/ReportesScreen';
import { FormasPagoScreen } from '../screens/FormasPagoScreen';
import { exportDatabase } from '../services/exportService';
import { colors, spacing } from '../styles/theme';

export type DrawerParamList = {
  Home: undefined;
  Mesas: undefined;
  Productos: undefined;
  Parametros: undefined;
  Reportes: undefined;
  FormasPago: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();
const logo = require('../../assets/icon.png');
const logoHorizontal = require('../../assets/logo-horizontal.png');

const HeaderLogo = () => (
  <Image source={logoHorizontal} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="ORDENA" />
);

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
    <View style={styles.drawerBrand}>
      <Image source={logo} style={styles.drawerLogo} resizeMode="contain" accessibilityLabel="ORDENA" />
    </View>
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
    <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'ORDENA', headerTitle: HeaderLogo }} />
    <Drawer.Screen name="Mesas" component={MesasScreen} />
    <Drawer.Screen name="Productos" component={ProductosScreen} />
    <Drawer.Screen name="Parametros" component={ParametrosScreen} />
    <Drawer.Screen name="Reportes" component={ReportesScreen} />
    <Drawer.Screen name="FormasPago" component={FormasPagoScreen} options={{ title: 'Formas de pago' }} />
  </Drawer.Navigator>
);

const styles = StyleSheet.create({
  drawerBrand: {
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerLogo: {
    width: 152,
    height: 152,
  },
  headerLogo: {
    width: 120,
    height: 32,
  },
});
