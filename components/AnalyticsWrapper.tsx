'use client';

import { Analytics } from '@vercel/analytics/next';

export default function AnalyticsWrapper() {
  return (
    <Analytics
      beforeSend={(event) => {
        // CCPA compliance: respect Do Not Track and Global Privacy Control
        if (
          typeof navigator !== 'undefined' &&
          (navigator.doNotTrack === '1' ||
            (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl)
        ) {
          return null;
        }
        return event;
      }}
    />
  );
}
