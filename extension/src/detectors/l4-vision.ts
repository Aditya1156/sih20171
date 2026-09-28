import type { Detection, Detector, DetectorInput, DetectorOptions } from './types';

export const l4Vision: Detector = {
  name: 'vision',

  detect(elements: DetectorInput[], options: DetectorOptions): Detection[] {
    const detections: Detection[] = [];

    for (const el of elements) {
      if (el.tag === 'canvas') {
        if (options.mode === 'strict') {
          detections.push({
            type: 'PII_IMAGE',
            confidence: 0.6,
            source: 'vision',
            elementId: el.id,
            boundingBox: el.boundingBox,
          });
        }
      }

      if (el.tag === 'video') {
        if (options.mode === 'strict') {
          detections.push({
            type: 'FACE',
            confidence: 0.5,
            source: 'vision',
            elementId: el.id,
            boundingBox: el.boundingBox,
          });
        }
      }

      if (el.tag === 'img') {
        const alt = el.alt ?? '';
        const isProfilePhoto = /photo|avatar|profile|headshot|portrait|face/i.test(alt);
        if (isProfilePhoto) {
          detections.push({
            type: 'FACE',
            confidence: 0.80,
            source: 'vision',
            elementId: el.id,
            boundingBox: el.boundingBox,
          });
        }

        if (options.mode === 'strict') {
          const isLargeImage = el.boundingBox.width > 200 && el.boundingBox.height > 100;
          if (isLargeImage && !isProfilePhoto) {
            detections.push({
              type: 'PII_IMAGE',
              confidence: 0.4,
              source: 'vision',
              elementId: el.id,
              boundingBox: el.boundingBox,
            });
          }
        }
      }
    }

    return detections;
  },
};
