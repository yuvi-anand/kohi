import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../lib/colors';
import { useAuth } from '../context/auth';
import { upsertProfile } from '../lib/api';

const BIO_LIMIT = 160;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!trimmedName) { Alert.alert('Name required', 'Please enter your name.'); return; }
    if (!trimmedUsername) { Alert.alert('Username required', 'Please choose a username.'); return; }
    if (!user) return;
    setSaving(true);
    try {
      await upsertProfile({
        id: user.id,
        name: trimmedName,
        username: trimmedUsername,
        bio: bio.trim() || null,
      });
      router.replace('/(tabs)/');
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'Username may already be taken.');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    router.replace('/(tabs)/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Kōhī</Text>
          <Text style={styles.heading}>Set up your profile</Text>
          <Text style={styles.sub}>This is how other coffee lovers will find you.</Text>

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Colors.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <View style={styles.usernameRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={[styles.input, styles.usernameInput]}
              placeholder="username"
              placeholderTextColor={Colors.muted}
              value={username}
              onChangeText={(t) => setUsername(t.replace(/[^a-z0-9_.]/gi, '').toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Bio (optional)"
              placeholderTextColor={Colors.muted}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, BIO_LIMIT))}
              multiline
              maxLength={BIO_LIMIT}
            />
            <Text style={styles.bioCounter}>{bio.length}/{BIO_LIMIT}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && { opacity: 0.6 }]}
            onPress={handleContinue}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  flex: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  logo: { fontSize: 36, fontWeight: '800', color: Colors.roast, letterSpacing: -1, marginBottom: 24 },
  heading: { fontSize: 24, fontWeight: '700', color: Colors.espresso, marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.muted, marginBottom: 32, lineHeight: 20 },
  input: {
    backgroundColor: Colors.white, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.espresso,
    borderWidth: 1, borderColor: Colors.milk, marginBottom: 12,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  atSign: { fontSize: 18, fontWeight: '700', color: Colors.muted, paddingRight: 6, marginBottom: 12 },
  usernameInput: { flex: 1 },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  bioCounter: { fontSize: 11, color: Colors.muted, textAlign: 'right', marginTop: -8, marginBottom: 12 },
  button: {
    backgroundColor: Colors.caramel, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center' },
  skipText: { fontSize: 14, color: Colors.muted },
});
