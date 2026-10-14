import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type { Mesa, StatusActivo } from '../db/types';
import { createMesa, listMesas, updateMesa } from '../repositories/mesasRepository';

const statusOptions: StatusActivo[] = ['Activo', 'Inactivo'];

export const MesasScreen = () => {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Mesa | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [status, setStatus] = useState<StatusActivo>('Activo');

  const loadData = useCallback(async () => {
    const data = await listMesas();
    setMesas(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openModal = (mesa?: Mesa) => {
    if (mesa) {
      setEditing(mesa);
      setCodigo(mesa.codigo);
      setNombre(mesa.nombre);
      setStatus(mesa.status);
    } else {
      setEditing(null);
      setCodigo('');
      setNombre('');
      setStatus('Activo');
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!codigo.trim() || !nombre.trim()) return;
    if (editing) {
      await updateMesa(editing.id, { codigo, nombre, status });
    } else {
      await createMesa({ codigo, nombre, status });
    }
    setShowModal(false);
    await loadData();
  };

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Mesas</Text>
        <FlatList
          data={mesas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openModal(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.nombre}</Text>
                <Text style={commonStyles.mutedText}>{item.codigo}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay mesas registradas.</Text>}
        />
      </View>

      <FloatingActionButton onPress={() => openModal()} />

      <ModalContainer
        visible={showModal}
        title={editing ? 'Editar mesa' : 'Agregar mesa'}
        onClose={() => setShowModal(false)}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={handleSave}>
            <Text style={commonStyles.buttonText}>Guardar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={commonStyles.label}>Código</Text>
        <TextInput
          style={commonStyles.input}
          value={codigo}
          onChangeText={setCodigo}
          maxLength={15}
        />
        <Text style={commonStyles.label}>Nombre</Text>
        <TextInput
          style={commonStyles.input}
          value={nombre}
          onChangeText={setNombre}
          maxLength={30}
        />
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
