import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../styles/theme';

interface Props {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export const SegmentedTabs: React.FC<Props> = ({ tabs, active, onChange }) => (
  <View style={styles.container}>
    {tabs.map((tab) => {
      const isActive = tab === active;
      return (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, isActive && styles.tabActive]}
          onPress={() => onChange(tab)}
        >
          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    color: colors.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },
});
