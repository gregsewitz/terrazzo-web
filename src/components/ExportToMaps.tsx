'use client';

import { useState, useMemo } from 'react';
import { ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface ExportToMapsProps {
  places: ImportedPlace[];
  collectionName: string;
  onClose: () => void;
}

type ExportScope = 'all' | 'starred';

function generateKML(places: ImportedPlace[], name: string): string {
  const placemarks = places.map(p => {
    const lat = p.google?.lat || 0;
    const lng = p.google?.lng || 0;
    const desc = [p.type, p.location, p.tasteNote].filter(Boolean).join(' · ');
    return `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(desc)}</description>
      ${lat && lng ? `<Point><coordinates>${lng},${lat},0</coordinates></Point>` : ''}
    </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <description>Exported from Terrazzo</description>
${placemarks}
  </Document>
</kml>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function googleMapsSearchUrl(place: ImportedPlace): string {
  const q = encodeURIComponent(`${place.name} ${place.location}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export default function ExportToMaps({ places, collectionName, onClose }: ExportToMapsProps) {
  const [scope, setScope] = useState<ExportScope>('all');
  const [exported, setExported] = useState(false);

  const starredPlaces = useMemo(() =>
    places.filter(p => p.isShortlisted || p.rating?.reaction === 'enjoyed'),
    [places]
  );

  const exportPlaces = scope === 'starred' ? starredPlaces : places;

  const handleDownloadKML = () => {
    const kml = generateKML(exportPlaces, collectionName);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collectionName.replace(/\s+/g, '-').toLowerCase()}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExported(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-full rounded-t-2xl overflow-hidden"
        style={{ background: 'white', maxWidth: 480, maxHeight: '80vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 4, background: 'var(--t-linen)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 style={{ fontFamily: FONT.serif, fontSize: 20, color: 'var(--t-ink)', margin: 0 }}>
              Export to Google Maps
            </h2>
            <button onClick={onClose} className="bg-transparent border-none cursor-pointer" style={{ color: INK['90'] }}>
              <PerriandIcon name="close" size={16} />
            </button>
          </div>
          <p className="text-[12px]" style={{ color: INK['95'] }}>
            Download as KML to import into Google Maps, or open places individually.
          </p>
        </div>

        {/* Scope toggle */}
        <div className="px-5 pb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setScope('all')}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-medium border-none cursor-pointer transition-all"
              style={{
                background: scope === 'all' ? 'var(--t-ink)' : 'var(--t-cream)',
                color: scope === 'all' ? 'white' : 'var(--t-ink)',
                fontFamily: FONT.sans,
              }}
            >
              All places ({places.length})
            </button>
            <button
              onClick={() => setScope('starred')}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-medium border-none cursor-pointer transition-all flex items-center justify-center gap-1"
              style={{
                background: scope === 'starred' ? 'var(--t-verde)' : 'var(--t-cream)',
                color: scope === 'starred' ? 'white' : 'var(--t-ink)',
                fontFamily: FONT.sans,
              }}
            >
              <PerriandIcon name="star" size={12} color={scope === 'starred' ? 'white' : 'var(--t-ink)'} /> Starred ({starredPlaces.length})
            </button>
          </div>
        </div>

        {/* KML download button */}
        <div className="px-5 pb-4">
          <button
            onClick={handleDownloadKML}
            className="w-full py-3 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all active:scale-[0.98]"
            style={{
              background: exported ? 'var(--t-verde)' : 'var(--t-ink)',
              color: 'white',
              fontFamily: FONT.sans,
            }}
          >
            {exported ? (
              <>
                <PerriandIcon name="check" size={14} /> KML Downloaded
              </>
            ) : (
              <>
                <PerriandIcon name="location" size={14} /> Download KML ({exportPlaces.length} places)
              </>
            )}
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: INK['90'] }}>
            Open Google Maps → Your places → Maps → Import → select the .kml file
          </p>
        </div>

        {/* Individual place links */}
        <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: '35vh' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: INK['90'], fontFamily: FONT.mono }}>
            Or open individually
          </p>
          <div className="flex flex-col gap-1.5">
            {exportPlaces.map(place => (
              <a
                key={place.id}
                href={googleMapsSearchUrl(place)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg no-underline transition-all hover:scale-[1.01]"
                style={{ background: 'var(--t-cream)', border: '1px solid var(--t-linen)' }}
              >
                <div className="flex-1 min-w-0 mr-2">
                  <div className="text-[12px] font-medium" style={{ color: 'var(--t-ink)' }}>
                    {place.name}
                  </div>
                  <div className="text-[10px]" style={{ color: INK['95'] }}>
                    {place.location} · {place.type}
                  </div>
                </div>
                <span className="text-[11px] flex-shrink-0" style={{ color: '#8a6a2a' }}>
                  Open ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
