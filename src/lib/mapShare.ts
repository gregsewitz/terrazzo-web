import { ImportedPlace } from '@/types';
import { INK } from '@/constants/theme';

/**
 * Generate a self-contained HTML page with a Google Map showing all places as markers.
 * The page includes info windows with place details and links to Google Maps.
 */
export function generateShareableMapHTML(
  places: ImportedPlace[],
  collectionName: string,
  apiKey: string
): string {
  // Filter to places with coordinates
  const mappable = places.filter(p => p.google?.lat && p.google?.lng);

  // Type color mapping
  const typeColors: Record<string, string> = {
    restaurant: '#e87080',
    hotel: '#c8923a',
    bar: '#6844a0',
    museum: '#2a7a56',
    cafe: '#eeb420',
    activity: '#e86830',
    neighborhood: '#5a7a9a',
    shop: '#a06c28',
  };

  const placesJSON = JSON.stringify(
    mappable.map(p => ({
      name: p.name,
      lat: p.google?.lat,
      lng: p.google?.lng,
      type: p.type,
      address: p.google?.address || p.location || '',
      rating: p.google?.rating,
      category: p.google?.category || p.type,
      color: typeColors[p.type] || '#e86830',
      mapsUrl: p.google?.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${p.google.placeId}`
        : `https://www.google.com/maps/search/?api=1&query=${p.google?.lat},${p.google?.lng}`,
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(collectionName)} — Terrazzo Map</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    #map { width: 100vw; height: 100vh; }
    .header {
      position: fixed; top: 0; left: 0; right: 0; z-index: 10;
      background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
      padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.08);
      display: flex; align-items: center; gap: 12px;
    }
    .header h1 {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 18px; color: #1c1a17; font-weight: 400; font-style: italic;
    }
    .header .count {
      font-size: 11px; color: INK['70'];
      font-family: 'Space Mono', monospace;
    }
    .gm-style .info-window {
      font-family: 'DM Sans', -apple-system, sans-serif;
      padding: 4px 0;
    }
    .info-window h3 {
      font-size: 14px; font-weight: 600; color: #1c1a17; margin-bottom: 4px;
      font-family: 'DM Serif Display', Georgia, serif; font-style: italic;
    }
    .info-window .meta { font-size: 11px; color: INK['70']; margin-bottom: 6px; }
    .info-window .rating { color: #c8923a; font-weight: 600; }
    .info-window a {
      font-size: 11px; color: #c8923a; text-decoration: none; font-weight: 500;
    }
    .info-window a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(collectionName)}</h1>
    <span class="count">${mappable.length} places</span>
  </div>
  <div id="map"></div>

  <script>
    const PLACES = ${placesJSON};

    function initMap() {
      const bounds = new google.maps.LatLngBounds();
      const map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });

      let openInfoWindow = null;

      PLACES.forEach((p, i) => {
        const pos = { lat: p.lat, lng: p.lng };
        bounds.extend(pos);

        const marker = new google.maps.Marker({
          position: pos,
          map: map,
          title: p.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: p.color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 8,
          },
        });

        const ratingHtml = p.rating ? '<span class="rating">★ ' + p.rating + '</span> · ' : '';
        const content = '<div class="info-window">'
          + '<h3>' + escapeHtml(p.name) + '</h3>'
          + '<div class="meta">' + ratingHtml + escapeHtml(p.category) + '</div>'
          + (p.address ? '<div class="meta">' + escapeHtml(p.address) + '</div>' : '')
          + '<a href="' + p.mapsUrl + '" target="_blank">Open in Google Maps ↗</a>'
          + '</div>';

        const infoWindow = new google.maps.InfoWindow({ content });

        marker.addListener('click', () => {
          if (openInfoWindow) openInfoWindow.close();
          infoWindow.open(map, marker);
          openInfoWindow = infoWindow;
        });
      });

      map.fitBounds(bounds, { top: 80, bottom: 20, left: 20, right: 20 });
    }

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap">
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
