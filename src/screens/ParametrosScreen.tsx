import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ModalContainer } from '../components/ModalContainer';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type { Parametro } from '../db/types';
import { listParametros, updateParametroValor } from '../repositories/parametrosRepository';
import {
  SPECIAL_PASSWORD_CODE,
  setSpecialPassword,
  verifySpecialPassword,
} from '../services/passwordService';
import { parseDecimal } from '../utils/format';

export const ParametrosScreen = () => {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [editing, setEditing] = useState<Parametro | null>(null);
  const [valor, setValor] = useState('');
  const [claveActual, setClaveActual] = useState('');
  const [claveConfirmacion, setClaveConfirmacion] = useState('');

  const isPassword = editing?.codigo === SPECIAL_PASSWORD_CODE;
  const tieneClave = isPassword && !!editing?.valor;
  const numeroInvalido =
    editing?.tipo === 'Numerico' && !!valor.trim() && (parseDecimal(valor) ?? -1) < 0;

  const loadData = useCallback(async () => {
    const data = await listParametros();
    setParametros(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openModal = (param: Parametro) => {
    setEditing(param);
    setValor(param.codigo === SPECIAL_PASSWORD_CODE ? '' : param.valor);
    setClaveActual('');
    setClaveConfirmacion('');
  };

  const handleSavePassword = async () => {
    if (tieneClave && !(await verifySpecialPassword(claveActual))) {
      Alert.alert('Clave inválida', 'La clave actual no es correcta.');
      return;
    }
    if (valor.trim() !== claveConfirmacion.trim()) {
      Alert.alert('Clave', 'La nueva clave y su confirmación no coinciden.');
      return;
    }
    await setSpecialPassword(valor);
    setEditing(null);
    await loadData();
  };

  const handleSave = async () => {
    if (!editing) return;
    if (isPassword) {
      await handleSavePassword();
      return;
    }
    if (numeroInvalido) return;
    const nuevoValor =
      editing.tipo === 'Numerico' && valor.trim() ? String(parseDecimal(valor)) : valor;
    await updateParametroValor(editing.codigo, nuevoValor);
    setEditing(null);
    await loadData();
  };

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Parámetros</Text>
        <FlatList
          data={parametros}
          keyExtractor={(item) => item.codigo}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openModal(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.descripcion}</Text>
                <Text style={commonStyles.mutedText}>{item.codigo}</Text>
              </View>
              <Text style={styles.value}>
                {item.codigo === SPECIAL_PASSWORD_CODE
                  ? item.valor ? 'Configurada' : 'Sin configurar'
                  : item.valor || '-'}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay parámetros.</Text>}
        />
      </View>

      <ModalContainer
        visible={!!editing}
        title="Editar parámetro"
        onClose={() => setEditing(null)}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={handleSave}>
            <Text style={commonStyles.buttonText}>Guardar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={commonStyles.label}>Código</Text>
        <Text style={styles.readonly}>{editing?.codigo}</Text>
        <Text style={commonStyles.label}>Descripción</Text>
        <Text style={styles.readonly}>{editing?.descripcion}</Text>
        <Text style={commonStyles.label}>Tipo</Text>
        <Text style={styles.readonly}>{editing?.tipo}</Text>
        {isPassword ? (
          <>
            {tieneClave ? (
              <>
                <Text style={commonStyles.label}>Clave actual</Text>
                <TextInput
                  style={commonStyles.input}
                  value={claveActual}
                  onChangeText={setClaveActual}
                  secureTextEntry
                  maxLength={30}
                />
              </>
            ) : null}
            <Text style={commonStyles.label}>Nueva clave</Text>
            <TextInput
              style={commonStyles.input}
              value={valor}
              onChangeText={setValor}
              secureTextEntry
              maxLength={30}
            />
            <Text style={commonStyles.label}>Confirmar nueva clave</Text>
            <TextInput
              style={commonStyles.input}
              value={claveConfirmacion}
              onChangeText={setClaveConfirmacion}
              secureTextEntry
              maxLength={30}
            />
            <Text style={commonStyles.mutedText}>
              Dejar vacía para desactivar las operaciones especiales.
            </Text>
          </>
        ) : (
          <>
            <Text style={commonStyles.label}>Valor</Text>
            <TextInput
              style={commonStyles.input}
              value={valor}
              onChangeText={setValor}
              keyboardType={editing?.tipo === 'Numerico' ? 'decimal-pad' : 'default'}
              maxLength={30}
            />
            {numeroInvalido ? (
              <Text style={styles.errorText}>Debe ingresar un número válido mayor o igual a 0.</Text>
            ) : null}
          </>
        )}
      </ModalContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    fontWeight: '600',
  },
  readonly: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
  },
});
