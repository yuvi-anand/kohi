// REEL SAVE FEATURE — entire screen commented out, infrastructure saved for later
// Uncomment when ready to implement: paste TikTok/Instagram link → AI extracts shop → save to list
//
// import React, { useState } from 'react';
// import {
//   View, Text, TextInput, TouchableOpacity, StyleSheet,
//   SafeAreaView, ActivityIndicator, Alert, ScrollView, Image,
// } from 'react-native';
// import { useLocalSearchParams, useRouter } from 'expo-router';
// import { Ionicons } from '@expo/vector-icons';
// import { Colors } from '../lib/colors';
// import { useAuth } from '../context/auth';
// import { useShops } from '../context/shops';
// import { processReel, saveReelSave, upsertShop } from '../lib/api';
// import { isSupabaseConfigured } from '../lib/supabase';
//
// export default function AddReelScreen() {
//   const router = useRouter();
//   const { user } = useAuth();
//   const { addToCache } = useShops();
//   const params = useLocalSearchParams<{ url?: string }>();
//
//   const [url, setUrl] = useState(params.url ?? '');
//   const [processing, setProcessing] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [result, setResult] = useState<{
//     platform: string;
//     extracted_name: string;
//     extracted_summary: string | null;
//     source_caption: string;
//     thumbnail_url: string | null;
//     shop: { id: string; name: string; address: string; lat: number | null; lng: number | null; photo_url: string | null } | null;
//   } | null>(null);
//
//   async function handleProcess() {
//     if (!url.trim()) return;
//     if (!isSupabaseConfigured()) {
//       Alert.alert('Not configured', 'Set up Supabase to use this feature.');
//       return;
//     }
//     setProcessing(true);
//     setResult(null);
//     try {
//       const data = await processReel(url.trim());
//       setResult(data);
//     } catch (e: any) {
//       Alert.alert('Could not process', e.message ?? 'Something went wrong.');
//     } finally {
//       setProcessing(false);
//     }
//   }
//
//   async function handleSave() {
//     if (!user || !result) return;
//     setSaving(true);
//     try {
//       let shopId: string | null = null;
//       if (result.shop) {
//         const shopRow = {
//           id: result.shop.id,
//           name: result.shop.name,
//           address: result.shop.address,
//           lat: result.shop.lat ?? undefined,
//           lng: result.shop.lng ?? undefined,
//           photo_url: result.shop.photo_url ?? undefined,
//         };
//         await upsertShop(shopRow as any);
//         addToCache([shopRow as any]);
//         shopId = result.shop.id;
//       }
//       await saveReelSave({
//         user_id: user.id,
//         url: url.trim(),
//         platform: result.platform,
//         shop_id: shopId,
//         extracted_name: result.extracted_name,
//         extracted_summary: result.extracted_summary,
//         source_caption: result.source_caption,
//         thumbnail_url: result.thumbnail_url,
//         status: result.shop ? 'processed' : 'unmatched',
//       });
//       Alert.alert('Saved!', `${result.extracted_name} added to your Want to Try list.`, [
//         { text: 'OK', onPress: () => router.back() },
//       ]);
//     } catch (e: any) {
//       Alert.alert('Error saving', e.message);
//     } finally {
//       setSaving(false);
//     }
//   }
//
//   const platformIcon = result?.platform === 'tiktok' ? 'musical-notes' : 'logo-instagram';
//   const platformLabel = result?.platform === 'tiktok' ? 'TikTok' : result?.platform === 'instagram' ? 'Instagram' : 'Reel';
//
//   return (
//     <SafeAreaView style={styles.safe}>
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
//           <Ionicons name="close" size={20} color={Colors.espresso} />
//         </TouchableOpacity>
//         <Text style={styles.title}>Save from Reel</Text>
//         <View style={{ width: 32 }} />
//       </View>
//       <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
//         <Text style={styles.label}>Paste a TikTok or Instagram link</Text>
//         <View style={styles.inputRow}>
//           <Ionicons name="link-outline" size={18} color={Colors.muted} />
//           <TextInput
//             style={styles.input}
//             placeholder="https://www.tiktok.com/..."
//             placeholderTextColor={Colors.muted}
//             value={url}
//             onChangeText={setUrl}
//             autoCapitalize="none"
//             autoCorrect={false}
//             keyboardType="url"
//           />
//           {url.length > 0 && (
//             <TouchableOpacity onPress={() => { setUrl(''); setResult(null); }}>
//               <Ionicons name="close-circle" size={18} color={Colors.muted} />
//             </TouchableOpacity>
//           )}
//         </View>
//         <TouchableOpacity
//           style={[styles.processBtn, (!url.trim() || processing) && styles.processBtnDisabled]}
//           onPress={handleProcess}
//           disabled={!url.trim() || processing}
//         >
//           {processing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.processBtnText}>Process Link</Text>}
//         </TouchableOpacity>
//         {result && (
//           <View style={styles.resultCard}>
//             {result.thumbnail_url && (
//               <Image source={{ uri: result.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
//             )}
//             <View style={styles.resultBody}>
//               <View style={styles.platformRow}>
//                 <Ionicons name={platformIcon as any} size={14} color={Colors.muted} />
//                 <Text style={styles.platformText}>{platformLabel}</Text>
//               </View>
//               <Text style={styles.shopName}>{result.extracted_name}</Text>
//               {result.extracted_summary && <Text style={styles.summary}>"{result.extracted_summary}"</Text>}
//               {result.shop ? (
//                 <View style={styles.matchedRow}>
//                   <Ionicons name="location" size={13} color={Colors.success} />
//                   <Text style={styles.matchedText}>{result.shop.address}</Text>
//                 </View>
//               ) : (
//                 <View style={styles.matchedRow}>
//                   <Ionicons name="help-circle-outline" size={13} color={Colors.muted} />
//                   <Text style={styles.unmatchedText}>Location not found — saved without map pin</Text>
//                 </View>
//               )}
//             </View>
//             <TouchableOpacity
//               style={[styles.saveBtn, saving && { opacity: 0.6 }]}
//               onPress={handleSave}
//               disabled={saving}
//             >
//               {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>Save to Want to Try</Text>}
//             </TouchableOpacity>
//           </View>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }
//
// const styles = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: Colors.cream },
//   header: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//     paddingHorizontal: 16, paddingVertical: 12,
//     backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.milk,
//   },
//   closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.foam, alignItems: 'center', justifyContent: 'center' },
//   title: { fontSize: 17, fontWeight: '700', color: Colors.espresso },
//   body: { padding: 20, gap: 16 },
//   label: { fontSize: 13, fontWeight: '600', color: Colors.muted, letterSpacing: 0.3 },
//   inputRow: {
//     flexDirection: 'row', alignItems: 'center', gap: 10,
//     backgroundColor: Colors.white, borderRadius: 8,
//     paddingHorizontal: 14, paddingVertical: 12,
//     borderWidth: 1, borderColor: Colors.milk,
//   },
//   input: { flex: 1, fontSize: 14, color: Colors.espresso },
//   processBtn: { backgroundColor: Colors.caramel, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
//   processBtnDisabled: { opacity: 0.5 },
//   processBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
//   loadingCard: {
//     flexDirection: 'row', alignItems: 'center', gap: 12,
//     backgroundColor: Colors.white, borderRadius: 8, padding: 16,
//     borderWidth: 1, borderColor: Colors.milk,
//   },
//   loadingText: { fontSize: 14, color: Colors.muted },
//   resultCard: { backgroundColor: Colors.white, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.milk },
//   thumbnail: { width: '100%', height: 180 },
//   resultBody: { padding: 16, gap: 6 },
//   platformRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
//   platformText: { fontSize: 12, color: Colors.muted },
//   shopName: { fontSize: 18, fontWeight: '700', color: Colors.espresso },
//   summary: { fontSize: 14, color: Colors.roast, fontStyle: 'italic', lineHeight: 20 },
//   matchedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
//   matchedText: { fontSize: 12, color: Colors.success, flex: 1 },
//   unmatchedText: { fontSize: 12, color: Colors.muted, flex: 1 },
//   saveBtn: { backgroundColor: Colors.caramel, margin: 16, marginTop: 0, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
//   saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
// });

// Placeholder — real screen is commented out above until feature is built
import React from 'react';
import { View } from 'react-native';
export default function AddReelScreen() { return <View />; }
