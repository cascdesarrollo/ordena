import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, radius, spacing } from '../styles/theme';

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: readonly (T | SelectOption<T>)[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

// Colores explícitos: en Android el Picker nativo toma el color de texto del tema
// del sistema (blanco en modo oscuro) y el valor seleccionado queda invisible.
export const SelectPicker = <T extends string>({ options, value, onChange, disabled = false }: Props<T>) => (
  <View style={[styles.wrapper, disabled && styles.disabled]}>
    <Picker
      enabled={!disabled}
      selectedValue={value}
      onValueChange={(selected) => onChange(selected as T)}
      style={styles.picker}
      dropdownIconColor={colors.muted}
      mode="dropdown"
    >
      {options.map((option, index) => {
        const item = typeof option === 'string' ? { label: option, value: option } : option;
        return (
          <Picker.Item
            key={`${index}-${item.value}`}
            label={item.label}
            value={item.value}
            color={colors.text}
            style={styles.item}
          />
        );
      })}
    </Picker>
  </View>
);

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  wrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  picker: {
    color: colors.text,
    backgroundColor: colors.card,
  },
  item: {
    backgroundColor: colors.card,
  },
});
