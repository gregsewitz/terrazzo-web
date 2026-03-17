'use client';

import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Shared Google Maps APIProvider — loads the SDK once for the entire app.
 * Wrap the app tree with this instead of having each component load its own APIProvider.
 * Falls back to rendering children without the provider when no API key is configured.
 */
export default function MapsProvider({ children }: { children: React.ReactNode }) {
  if (!API_KEY) {
    return <>{children}</>;
  }

  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      {children}
    </APIProvider>
  );
}
