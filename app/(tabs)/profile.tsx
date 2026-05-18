import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { useAuth } from '../../context/auth';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getRatings, getBookmarks, getProfile, upsertProfile, getShopsForIds } from '../../lib/api';
import { Rating, DrinkType } from '../../lib/types';
import { formatScore, overallColor } from '../../lib/utils';

const BIO_LIMIT = 160;

export default function ProfileScreen() {
  const { user } = useAuth();
  const { shopById, addToCache } = useShops();
  const router = useRouter();

  const [ratingCount, setRatingCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [coffeeRatings, setCoffeeRatings] = useState<Rating[]>([]);
  const [matchaRatings, setMatchaRatings] = useState<Rating[]>([]);
  const [rankDrinkType, setRankDrinkType] = useState<DrinkType>('coffee');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      const [allRatings, bookmarks, profile] = await Promise.all([
        getRatings(user.id),
        getBookmarks(user.id),
        getProfile(user.id),
      ]);
      const coffee = allRatings.filter((r) => (r.drink_type ?? 'coffee') === 'coffee');
      const matcha = allRatings.filter((r) => r.drink_type === 'matcha');
      setCoffeeRatings(coffee);
      setMatchaRatings(matcha);
      const uniqueShops = new Set(allRatings.map((r) => r.shop_id));
      setRatingCount(uniqueShops.size);
      setBookmarkCount(bookmarks.length);
      const missingIds = allRatings.map((r) => r.shop_id).filter((id) => !shopById[id]);
      if (missingIds.length > 0) {
        const fetched = await getShopsForIds([...new Set(missingIds)]);
        addToCache(fetched);
      }
      if (profile) {
        setName(profile.name ?? '');
        setUsername(profile.username ?? '');
        setBio(profile.bio ?? '');
      }
    } catch {
      // silently fail
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function startEdit() {
    setDraftName(name);
    setDraftUsername(username);
    setDraftBio(bio);
    setEditing(true);
  }

  async function saveProfile() {
    if (!user) return;
    const trimmedUsername = draftUsername.trim().replace(/^@/, '').toLowerCase();
    const trimmedName = draftName.trim();
    const trimmedBio = draftBio.trim();
    setSaving(true);
    try {
      await upsertProfile({
        id: user.id,
        username: trimmedUsername || null,
        name: trimmedName || null,
        bio: trimmedBio || null,
      });
      setUsername(trimmedUsername);
      setName(trimmedName);
      setBio(trimmedBio);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'Username may already be taken.');
    } finally {
      setSaving(false);
    }
  }

  const topRatings = (rankDrinkType === 'coffee' ? coffeeRatings : matchaRatings).slice(0, 5);
  const initials = name ? name[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? '?');
  const needsSetup = !username && !editing;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerActions}>
          {!editing && (
            <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {editing ? (
            <View style={styles.editFields}>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={Colors.muted}
                value={draftName}
                onChangeText={setDraftName}
                autoCapitalize="words"
              />
              <View style={styles.usernameInputRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={[styles.input, styles.usernameInput]}
                  placeholder="username"
                  placeholderTextColor={Colors.muted}
                  value={draftUsername}
                  onChangeText={(t) => setDraftUsername(t.replace(/[^a-z0-9_.]/gi, '').toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  placeholder="Bio (optional)"
                  placeholderTextColor={Colors.muted}
                  value={draftBio}
                  onChangeText={(t) => setDraftBio(t.slice(0, BIO_LIMIT))}
                  multiline
                  maxLength={BIO_LIMIT}
                />
                <Text style={styles.bioCounter}>{draftBio.length}/{BIO_LIMIT}</Text>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.nameSection}>
              {name ? <Text style={styles.displayName}>{name}</Text> : null}
              {username ? (
                <Text style={styles.displayUsername}>@{username}</Text>
              ) : (
                <Text style={styles.emailFallback}>{user?.email ?? ''}</Text>
              )}
              {bio ? <Text style={styles.displayBio}>{bio}</Text> : null}
            </View>
          )}
        </View>

        {needsSetup && (
          <TouchableOpacity style={styles.setupPrompt} onPress={startEdit}>
            <Text style={styles.setupPromptText}>Set your name and username →</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{ratingCount}</Text>
            <Text style={styles.statLabel}>Rated</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{bookmarkCount}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        {/* Rankings */}
        {(coffeeRatings.length > 0 || matchaRatings.length > 0) && (
          <View style={styles.rankingsCard}>
            <View style={styles.rankingsHeader}>
              <Text style={styles.rankingsTitle}>My Rankings</Text>
              <View style={styles.drinkToggle}>
                <TouchableOpacity
                  style={[styles.drinkBtn, rankDrinkType === 'coffee' && styles.drinkBtnActive]}
                  onPress={() => setRankDrinkType('coffee')}
                >
                  <Text style={[styles.drinkBtnText, rankDrinkType === 'coffee' && styles.drinkBtnTextActive]}>☕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.drinkBtn, rankDrinkType === 'matcha' && { ...styles.drinkBtnActive, backgroundColor: Colors.matcha }]}
                  onPress={() => setRankDrinkType('matcha')}
                >
                  <Text style={[styles.drinkBtnText, rankDrinkType === 'matcha' && styles.drinkBtnTextActive]}>🍵</Text>
                </TouchableOpacity>
              </View>
            </View>
            {topRatings.length === 0 ? (
              <Text style={styles.rankingsEmpty}>
                No {rankDrinkType} ratings yet.
              </Text>
            ) : topRatings.map((r, i) => {
              const shop = shopById[r.shop_id];
              if (!shop) return null;
              return (
                <TouchableOpacity
                  key={r.shop_id}
                  style={styles.rankRow}
                  onPress={() => router.push(`/shop/${r.shop_id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rankNum}>{i + 1}</Text>
                  <View style={styles.rankInfo}>
                    <Text style={styles.rankName} numberOfLines={1}>{shop.name}</Text>
                    <Text style={styles.rankAddr} numberOfLines={1}>{shop.address}</Text>
                  </View>
                  <View style={[styles.rankBadge, { backgroundColor: overallColor(r.overall) }]}>
                    <Text style={styles.rankScore}>{formatScore(r.overall)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.roast, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: Colors.foam,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.caramel },
  settingsBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.foam,
  },

  avatarSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.caramel,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },

  nameSection: { alignItems: 'center', gap: 4 },
  displayName: { fontSize: 20, fontWeight: '800', color: Colors.espresso },
  displayUsername: { fontSize: 14, color: Colors.muted, fontWeight: '500' },
  emailFallback: { fontSize: 14, color: Colors.muted },
  displayBio: { fontSize: 14, color: Colors.roast, textAlign: 'center', lineHeight: 20, marginTop: 6 },

  editFields: { width: '100%', gap: 10 },
  input: {
    backgroundColor: Colors.white, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.espresso,
    borderWidth: 1, borderColor: Colors.milk,
  },
  usernameInputRow: { flexDirection: 'row', alignItems: 'center' },
  atSign: { fontSize: 18, fontWeight: '700', color: Colors.muted, paddingRight: 6 },
  usernameInput: { flex: 1 },
  bioInput: { minHeight: 72, textAlignVertical: 'top' },
  bioCounter: { fontSize: 11, color: Colors.muted, textAlign: 'right', marginTop: 4 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.milk, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.muted },
  saveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.caramel, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  setupPrompt: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: Colors.foam, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.milk,
  },
  setupPromptText: { fontSize: 13, color: Colors.caramel, fontWeight: '600', textAlign: 'center' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 16, padding: 20,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    marginBottom: 16,
  },
  statCard: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.milk },
  statNumber: { fontSize: 28, fontWeight: '800', color: Colors.roast },
  statLabel: { fontSize: 12, color: Colors.muted, marginTop: 2, fontWeight: '500' },

  rankingsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 16,
    paddingVertical: 16,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  rankingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rankingsTitle: { fontSize: 14, fontWeight: '800', color: Colors.espresso },
  drinkToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.milk,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  drinkBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  drinkBtnActive: { backgroundColor: Colors.caramel },
  drinkBtnText: { fontSize: 16, color: Colors.muted },
  drinkBtnTextActive: { color: Colors.white },
  rankingsEmpty: { fontSize: 13, color: Colors.muted, paddingHorizontal: 16, paddingBottom: 8 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  rankNum: { fontSize: 13, fontWeight: '700', color: Colors.muted, width: 20, textAlign: 'center' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  rankAddr: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  rankBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  rankScore: { fontSize: 13, fontWeight: '800', color: Colors.white },
});
