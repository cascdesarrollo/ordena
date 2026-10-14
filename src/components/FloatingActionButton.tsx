import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../styles/theme';

interface Props {
  onPress: () => void;
  icon?: string;
}

export const FloatingActionButton: React.FC<Props> = ({ onPress, icon = '+' }) => (
  <TouchableOpacity style={styles.fab} onPress={onPress}>
    <Text style={styles.fabText}>{icon}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 2,
  },
});
