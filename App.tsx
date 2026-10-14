import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/db/migrations';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/styles/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        setReady(true);
      } catch (e) {
        console.error('initDatabase', e);
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    setup();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        <Text style={{ color: colors.danger, fontWeight: '600', marginBottom: 8 }}>
          Error al iniciar la base de datos
        </Text>
        <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
