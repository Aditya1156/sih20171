import type { SensitiveType, BoundingBox } from '../shared/schemas';

export interface Detection {
  type: SensitiveType;
  confidence: number;
  source: 'dom-rules' | 'text-pattern' | 'ner' | 'vision';
  elementId?: string;
  boundingBox?: BoundingBox;
  matchedText?: string;
  placeholder?: string;
}

export type SensitivityMode = 'strict' | 'balanced';

export interface DetectorOptions {
  mode: SensitivityMode;
}

export interface Detector {
  name: string;
  detect(elements: DetectorInput[], options: DetectorOptions): Detection[];
}

export interface DetectorInput {
  id: string;
  tag: string;
  type?: string;
  role?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  autocomplete?: string;
  alt?: string;
  boundingBox: BoundingBox;
  isVisible: boolean;
  attributes?: Record<string, string>;
}
