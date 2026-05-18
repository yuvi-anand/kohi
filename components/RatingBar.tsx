import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../lib/colors';
import { overallColor } from '../lib/utils';

interface Props {
  label: string;
  emoji: string;
  score: number;
  maxScore?: number;
}

export default function RatingBar({ label, emoji, score, maxScore = 10 }: Props) {
  const fill = score / maxScore;
  const normalizedFor10 = (score / maxScore) * 10;
  const color = overallColor(normalizedFor10);

  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.labelCol}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[styles.score, { color }]}>
    {score}<Text style={styles.max}>/{maxScore}</Text>
  </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  emoji: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  labelCol: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '500',
  },
  track: {
    height: 6,
    backgroundColor: Colors.foam,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  score: {
    fontSize: 15,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  max: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.muted,
  },
});
