import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ActivityIndicator, ScrollView, Alert, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../lib/colors';
import { useAuth } from '../../context/auth';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getRatings, getBookmarks, getProfile, upsertProfile, getShopsForIds, getFollowCounts } from '../../lib/api';
import { Rating, DrinkType } from '../../lib/types';
import { formatScore, overallColor, normalizeScore, NORMALIZE_THRESHOLD, timeAgo } from '../../lib/utils';

const BIO_LIMIT = 160;

export default function ProfileScreen() {
  const { user } = useAuth();
  const { shopById, addToCache } = useShops();
  const router = useRouter();

  const [ratingCount, setRatingCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
  const [coffeeRatings, setCoffeeRatings] = useState<Rating[]>([]);
  const [matchaRatings, setMatchaRatings] = useState<Rating[]>([]);
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [rankDrinkType, setRankDrinkType] = useState<DrinkType>('coffee');
  const [topExpanded, setTopExpanded] = useState(false);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      const [ratings, bookmarks, profile, counts] = await Promise.all([
        getRatings(user.id),
        getBookmarks(user.id),
        getProfile(user.id),
        getFollowCounts(user.id),
      ]);
      setFollowCounts(counts);
      setAllRatings(ratings);
      const coffee = ratings.filter((r) => (r.drink_type ?? 'coffee') === 'coffee');
      const matcha = ratings.filter((r) => r.drink_type === 'matcha');
      setCoffeeRatings(coffee);
      setMatchaRatings(matcha);
      const uniqueShops = new Set(ratings.map((r) => r.shop_id));
      setRatingCount(uniqueShops.size);
      setBookmarkCount(bookmarks.length);
      const missingIds = ratings.map((r) => r.shop_id).filter((id) => !shopById[id]);
      if (missingIds.length > 0) {
        const fetched = await getShopsForIds([...new Set(missingIds)]);
        addToCache(fetched);
      }
      if (profile) {
        setName(profile.name ?? '');
        setUsername(profile.username ?? '');
        setBio(profile.bio ?? '');
        setAvatarUrl(profile.avatar_url ?? null);
      }
    } catch { /* silently fail */ }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handlePickAvatar() {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl + `?t=${Date.now()}`;
      await upsertProfile({ id: user.id, avatar_url: url });
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  function startEdit() {
    setDraftName(name); setDraftUsername(username); setDraftBio(bio); setEditing(true);
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
        username: usernameIsLocked ? username : (trimmedUsername || null),
        name: trimmedName || null,
        bio: trimmedBio || null,
      });
      if (!usernameIsLocked) setUsername(trimmedUsername);
      setName(trimmedName); setBio(trimmedBio); setEditing(false);
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'Username may already be taken.');
    } finally { setSaving(false); }
  }

  // Deduplicate by shop keeping best score, then sort desc
  function dedupeAndSort(list: Rating[]): Rating[] {
    const best: Record<string, Rating> = {};
    for (const r of list) {
      if (!best[r.shop_id] || r.overall > best[r.shop_id].overall) best[r.shop_id] = r;
    }
    return Object.values(best).sort((a, b) => b.overall - a.overall);
  }

  const drinkRatings = rankDrinkType === 'coffee' ? coffeeRatings : matchaRatings;
  const sortedRatings = dedupeAndSort(drinkRatings);
  const scoresUnlocked = sortedRatings.length >= NORMALIZE_THRESHOLD;
  const userMax = scoresUnlocked ? Math.max(...sortedRatings.map(r => r.overall)) : 0;
  const topFive = sortedRatings.slice(0, 5);

  // Recent feed: all ratings sorted by visited_at / created_at desc
  const recentFeed = [...allRatings]
    .filter(r => r.visited_at || r.created_at)
    .sort((a, b) => {
      const ta = new Date(a.visited_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.visited_at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, 15);

  const initials = name ? name[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? '?');
  const needsSetup = !username && !editing;
  const usernameIsLocked = !!username;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerActions}>
          {!editing && (
            <>
              <TouchableOpacity onPress={() => router.push('/find-friends')} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Find Friends</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar + info */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={Colors.white} size="small" />
              </View>
            ) : (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color={Colors.white} />
              </View>
            )}
          </TouchableOpacity>

          {editing ? (
            <View style={styles.editFields}>
              <TextInput style={styles.input} placeholder="Name" placeholderTextColor={Colors.muted}
                value={draftName} onChangeText={setDraftName} autoCapitalize="words" />
              {usernameIsLocked ? (
                <View style={styles.lockedRow}>
                  <Ionicons name="lock-closed-outline" size={14} color={Colors.muted} />
                  <Text style={styles.lockedText}>@{username}</Text>
                  <Text style={styles.lockedHint}>Username cannot be changed</Text>
                </View>
              ) : (
                <View style={styles.usernameInputRow}>
                  <Text style={styles.atSign}>@</Text>
                  <TextInput style={[styles.input, styles.usernameInput]} placeholder="username"
                    placeholderTextColor={Colors.muted} value={draftUsername}
                    onChangeText={(t) => setDraftUsername(t.replace(/[^a-z0-9_.]/gi, '').toLowerCase())}
                    autoCapitalize="none" autoCorrect={false} />
                </View>
              )}
              <View>
                <TextInput style={[styles.input, styles.bioInput]} placeholder="Bio (optional)"
                  placeholderTextColor={Colors.muted} value={draftBio}
                  onChangeText={(t) => setDraftBio(t.slice(0, BIO_LIMIT))} multiline maxLength={BIO_LIMIT} />
                <Text style={styles.bioCounter}>{draftBio.length}/{BIO_LIMIT}</Text>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.white} size="small" /> :
                    <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.nameSection}>
              {name ? <Text style={styles.displayName}>{name}</Text> : null}
              {username ? <Text style={styles.displayUsername}>@{username}</Text> :
                <Text style={styles.emailFallback}>{user?.email ?? ''}</Text>}
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
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/mylist')}>
              <Text style={styles.statNumber}>{ratingCount}</Text>
              <Text style={styles.statLabel}>Rated</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/mylist')}>
              <Text style={styles.statNumber}>{bookmarkCount}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statRowDivider} />
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statCard} onPress={() => router.push(`/followers?userId=${user?.id}&type=following`)}>
              <Text style={styles.statNumber}>{followCounts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statCard} onPress={() => router.push(`/followers?userId=${user?.id}&type=followers`)}>
              <Text style={styles.statNumber}>{followCounts.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Top 5 */}
        {(coffeeRatings.length > 0 || matchaRatings.length > 0) && (
          <View style={styles.rankingsCard}>
            {/* Header row — tapping toggles expand */}
            <TouchableOpacity style={styles.rankingsHeader} onPress={() => setTopExpanded(v => !v)} activeOpacity={0.7}>
              <View style={styles.rankingsTitleRow}>
                <Text style={styles.rankingsTitle}>Top 5 Rankings</Text>
                <View style={styles.drinkToggle}>
                  <TouchableOpacity
                    style={[styles.drinkBtn, rankDrinkType === 'coffee' && styles.drinkBtnActive]}
                    onPress={(e) => { e.stopPropagation?.(); setRankDrinkType('coffee'); }}
                  >
                    <Text style={[styles.drinkBtnText, rankDrinkType === 'coffee' && styles.drinkBtnTextActive]}>☕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.drinkBtn, rankDrinkType === 'matcha' && { ...styles.drinkBtnActive, backgroundColor: Colors.matcha }]}
                    onPress={(e) => { e.stopPropagation?.(); setRankDrinkType('matcha'); }}
                  >
                    <Text style={[styles.drinkBtnText, rankDrinkType === 'matcha' && styles.drinkBtnTextActive]}>🍵</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Ionicons name={topExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
            </TouchableOpacity>

            {/* Expanded content */}
            {topExpanded && (
              <>
                {topFive.length === 0 ? (
                  <Text style={styles.rankingsEmpty}>No {rankDrinkType} ratings yet.</Text>
                ) : topFive.map((r, i) => {
                  const shop = shopById[r.shop_id];
                  if (!shop) return null;
                  const score = scoresUnlocked ? normalizeScore(r.overall, userMax) : null;
                  return (
                    <TouchableOpacity
                      key={r.shop_id}
                      style={styles.rankRow}
                      onPress={() => router.push(`/user-ratings/${user?.id}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rankNum}>{i + 1}</Text>
                      <View style={styles.rankInfo}>
                        <Text style={styles.rankName} numberOfLines={1}>{shop.name}</Text>
                        <Text style={styles.rankAddr} numberOfLines={1}>{shop.neighborhood ?? shop.address}</Text>
                      </View>
                      {score != null ? (
                        <View style={[styles.rankBadge, { backgroundColor: overallColor(score) }]}>
                          <Text style={styles.rankScore}>{formatScore(score)}</Text>
                        </View>
                      ) : (
                        <View style={styles.rankBadgeLocked}>
                          <Ionicons name="lock-closed" size={13} color={Colors.muted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => router.push(`/user-ratings/${user?.id}`)}
                >
                  <Text style={styles.seeAllText}>See all {sortedRatings.length} ratings →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Recent activity feed */}
        {recentFeed.length > 0 && (
          <View style={styles.feedSection}>
            <Text style={styles.feedTitle}>Recent Activity</Text>
            {recentFeed.map((r, i) => {
              const shop = shopById[r.shop_id];
              const drinkEmoji = r.drink_type === 'matcha' ? '🍵' : '☕';
              // Normalize using the appropriate drink type's max
              const drinkList = (r.drink_type ?? 'coffee') === 'coffee' ? coffeeRatings : matchaRatings;
              const deduped = dedupeAndSort(drinkList);
              const unlocked = deduped.length >= NORMALIZE_THRESHOLD;
              const max = unlocked ? Math.max(...deduped.map(d => d.overall)) : 0;
              const score = unlocked ? normalizeScore(r.overall, max) : null;
              const dateStr = r.visited_at ?? r.created_at;

              return (
                <TouchableOpacity
                  key={`${r.shop_id}-${r.drink_type}-${i}`}
                  style={styles.feedCard}
                  onPress={() => router.push(`/shop/${r.shop_id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.feedLeft}>
                    <Text style={styles.feedEmoji}>{drinkEmoji}</Text>
                  </View>
                  <View style={styles.feedMiddle}>
                    <Text style={styles.feedShop} numberOfLines={1}>{shop?.name ?? '…'}</Text>
                    {r.notes ? (
                      <Text style={styles.feedNotes} numberOfLines={2}>"{r.notes}"</Text>
                    ) : null}
                    {dateStr ? (
                      <Text style={styles.feedDate}>{timeAgo(dateStr)}</Text>
                    ) : null}
                  </View>
                  {score != null ? (
                    <View style={[styles.feedBadge, { backgroundColor: overallColor(score) }]}>
                      <Text style={styles.feedBadgeText}>{formatScore(score)}</Text>
                    </View>
                  ) : (
                    <View style={styles.feedBadgeLocked}>
                      <Ionicons name="lock-closed" size={12} color={Colors.muted} />
                    </View>
                  )}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: Colors.roast, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.foam },
  editBtnText: { fontSize: 13, fontWeight: '500', color: Colors.caramel },
  settingsBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.foam },

  avatarSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 32 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.caramel, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.caramel, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.cream },
  nameSection: { alignItems: 'center', gap: 4 },
  displayName: { fontSize: 20, fontWeight: '700', color: Colors.espresso },
  displayUsername: { fontSize: 14, color: Colors.muted, fontWeight: '500' },
  emailFallback: { fontSize: 14, color: Colors.muted },
  displayBio: { fontSize: 14, color: Colors.roast, textAlign: 'center', lineHeight: 20, marginTop: 6 },

  editFields: { width: '100%', gap: 10 },
  input: { backgroundColor: Colors.white, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.espresso, borderWidth: 1, borderColor: Colors.milk },
  usernameInputRow: { flexDirection: 'row', alignItems: 'center' },
  atSign: { fontSize: 18, fontWeight: '700', color: Colors.muted, paddingRight: 6 },
  usernameInput: { flex: 1 },
  bioInput: { minHeight: 72, textAlignVertical: 'top' },
  bioCounter: { fontSize: 11, color: Colors.muted, textAlign: 'right', marginTop: 4 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.milk, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: Colors.caramel, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  setupPrompt: { marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.foam, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.milk },
  setupPromptText: { fontSize: 13, color: Colors.caramel, fontWeight: '500', textAlign: 'center' },

  statsCard: {
    backgroundColor: Colors.white, marginHorizontal: 16, borderRadius: 8,
    shadowColor: Colors.espresso, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', padding: 20 },
  statRowDivider: { height: 1, backgroundColor: Colors.foam, marginHorizontal: 20 },
  statCard: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.milk },
  statNumber: { fontSize: 28, fontWeight: '700', color: Colors.roast },
  statLabel: { fontSize: 12, color: Colors.muted, marginTop: 2, fontWeight: '500' },

  rankingsCard: {
    backgroundColor: Colors.white, marginHorizontal: 16, borderRadius: 10,
    shadowColor: Colors.espresso, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 16,
    overflow: 'hidden',
  },
  rankingsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rankingsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rankingsTitle: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  drinkToggle: { flexDirection: 'row', backgroundColor: Colors.milk, borderRadius: 5, padding: 2, gap: 2 },
  drinkBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  drinkBtnActive: { backgroundColor: Colors.caramel },
  drinkBtnText: { fontSize: 16 },
  drinkBtnTextActive: { color: Colors.white },
  rankingsEmpty: { fontSize: 13, color: Colors.muted, paddingHorizontal: 16, paddingBottom: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  rankNum: { fontSize: 13, fontWeight: '700', color: Colors.muted, width: 20, textAlign: 'center' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  rankAddr: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankScore: { fontSize: 13, fontWeight: '700', color: Colors.white },
  rankBadgeLocked: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.foam, borderWidth: 1.5, borderColor: Colors.milk, alignItems: 'center', justifyContent: 'center' },
  seeAllBtn: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.foam },
  seeAllText: { fontSize: 13, color: Colors.caramel, fontWeight: '600', textAlign: 'center' },

  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.foam, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.milk },
  lockedText: { fontSize: 15, color: Colors.espresso, fontWeight: '500' },
  lockedHint: { fontSize: 12, color: Colors.muted, marginLeft: 4 },

  feedSection: { marginHorizontal: 16, marginBottom: 16 },
  feedTitle: { fontSize: 14, fontWeight: '700', color: Colors.espresso, marginBottom: 10 },
  feedCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 10,
    padding: 12, marginBottom: 8, gap: 10,
    shadowColor: Colors.espresso, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  feedLeft: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.foam, alignItems: 'center', justifyContent: 'center' },
  feedEmoji: { fontSize: 18 },
  feedMiddle: { flex: 1, gap: 2 },
  feedShop: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  feedNotes: { fontSize: 12, color: Colors.muted, fontStyle: 'italic', lineHeight: 16 },
  feedDate: { fontSize: 11, color: Colors.caramel, fontWeight: '500' },
  feedBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  feedBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  feedBadgeLocked: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.foam, borderWidth: 1.5, borderColor: Colors.milk, alignItems: 'center', justifyContent: 'center' },
});
