import type { DetectionResult } from './pipeline';
import type { SensitiveType } from '../shared/schemas';

export interface PrivacyScore {
  score: number;
  level: 'safe' | 'moderate' | 'high' | 'critical';
  breakdown: Record<string, number>;
}

const TYPE_WEIGHTS: Partial<Record<SensitiveType, number>> = {
  PASSWORD: 15,
  AADHAAR: 10,
  PAN: 10,
  CARD: 10,
  EMAIL: 8,
  PHONE: 8,
  UPI: 5,
  IFSC: 5,
  NAME: 3,
};

function getLevel(score: number): 'safe' | 'moderate' | 'high' | 'critical' {
  if (score <= 25) return 'safe';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'critical';
}

export function calculatePrivacyScore(
  detectionResult: DetectionResult,
  url: string,
): PrivacyScore {
  const breakdown: Record<string, number> = {};
  let rawScore = 0;

  const seen = new Map<SensitiveType, Set<string>>();

  for (const detection of detectionResult.detections) {
    const weight = TYPE_WEIGHTS[detection.type];
    if (weight === undefined) continue;

    if (!seen.has(detection.type)) {
      seen.set(detection.type, new Set());
    }

    const key = detection.matchedText ?? detection.elementId ?? String(Math.random());
    const typeSet = seen.get(detection.type)!;

    if (typeSet.has(key)) continue;
    typeSet.add(key);

    const points = weight;
    rawScore += points;
    breakdown[detection.type] = (breakdown[detection.type] ?? 0) + points;
  }

  const isHttp = url.startsWith('http://');
  if (isHttp) {
    breakdown['HTTP_PENALTY'] = Math.round(rawScore * 0.5);
    rawScore = Math.round(rawScore * 1.5);
  }

  const score = Math.min(rawScore, 100);

  return {
    score,
    level: getLevel(score),
    breakdown,
  };
}
