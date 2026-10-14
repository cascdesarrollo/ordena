import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { ModalContainer } from './ModalContainer';
import { colors, spacing } from '../styles/theme';

interface Props {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}

export const PasswordPrompt: React.FC<Props> = ({ visible, title, onCancel, onConfirm }) => {
  const [password, setPassword] = useState('');

  const handleConfirm = () => {
    onConfirm(password);
    setPassword('');
  };

  const handleCancel = () => {
    setPassword('');
    onCancel();
  };

  return (
    <ModalContainer visible={visible} title={title} onClose={handleCancel}>
      <Text style={styles.label}>Clave de autorización</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Ingrese la clave"
        secureTextEntry
      />
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.cancel]} onPress={handleCancel}>
          <Text style={styles.buttonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.confirm]} onPress={handleConfirm}>
          <Text style={styles.buttonText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </ModalContainer>
  );
};

const styles = StyleSheet.create({
  label: {
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: colors.muted,
  },
  confirm: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
