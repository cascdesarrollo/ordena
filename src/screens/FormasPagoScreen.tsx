import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type { Divisa, FormaPago, StatusActivo } from '../db/types';
import { createFormaPago, listFormasPago, updateFormaPago } from '../repositories/formasPagoRepository';
import { divisas } from '../services/pagosService';

const statusOptions: StatusActivo[] = ['Activo', 'Inactivo'];

export const FormasPagoScreen = () => {
  const [formas, setFormas] = useState<FormaPago[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FormaPago | null>(null);
  const [nombre, setNombre] = useState('');
  const [divisa, setDivisa] = useState<Divisa>('USD');
  const [status, setStatus] = useState<StatusActivo>('Activo');

  const loadData = useCallback(async () => {
    const data = await listFormasPago();
    setFormas(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openModal = (forma?: FormaPago) => {
    if (forma) {
      setEditing(forma);
      setNombre(forma.nombre);
      setDivisa(forma.divisa);
      setStatus(forma.status);
    } else {
      setEditing(null);
      setNombre('');
      setDivisa('USD');
      setStatus('Activo');
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      Alert.alert('Forma de pago', 'El nombre es obligatorio.');
      return;
    }
    const duplicada = formas.some(
      (f) => f.id !== editing?.id && f.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    );
    if (duplicada) {
      Alert.alert('Forma de pago', 'Ya existe una forma de pago con ese nombre.');
      return;
    }
    if (editing) {
      await updateFormaPago(editing.id, { nombre, divisa, status });
    } else {
      await createFormaPago({ nombre, divisa, status });
    }
    setShowModal(false);
    await loadData();
  };

  return (
    <View style={[commonStyles.screen, commonStyles.screenWithFab]}>
      <View style={[commonStyles.card, commonStyles.listCard]}>
        <Text style={commonStyles.title}>Formas de pago</Text>
        <FlatList
          data={formas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openModal(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.nombre}</Text>
                <Text style={commonStyles.mutedText}>{item.divisa}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay formas de pago registradas.</Text>}
        />
      </View>

      <FloatingActionButton onPress={() => openModal()} />

      <ModalContainer
        visible={showModal}
        title={editing ? 'Editar forma de pago' : 'Agregar forma de pago'}
        onClose={() => setShowModal(false)}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={handleSave}>
            <Text style={commonStyles.buttonText}>Guardar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={commonStyles.label}>Nombre</Text>
        <TextInput
          style={commonStyles.input}
          value={nombre}
          onChangeText={setNombre}
          maxLength={30}
        />
        <Text style={commonStyles.label}>Divisa</Text>
        <SelectPicker options={divisas} value={divisa} onChange={setDivisa} />
        <Text style={commonStyles.label}>Status</Text>
        <SelectPicker options={statusOptions} value={status} onChange={setStatus} />
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
  status: {
    color: colors.primary,
    fontWeight: '600',
  },
});
