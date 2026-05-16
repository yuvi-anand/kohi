import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { useAuth } from '../context/auth';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={handleSignOut}>
          <Text style={styles.rowTextDanger}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.roast },

  section: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 20, paddingVertical: 16 },
  rowTextDanger: { fontSize: 15, color: Colors.error, fontWeight: '600' },
});
