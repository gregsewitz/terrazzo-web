import { describe, it, expect } from 'vitest';
import {
  detectInputType,
  detectInput,
  extractPlaceIdFromMapsUrl,
  getPlatformLabel,
} from '../detect-input';
import type { InputMeta } from '../detect-input';

// ─── detectInputType (backward-compatible simple API) ──────────────────────

describe('detectInputType', () => {
  describe('Google Maps Lists', () => {
    it('detects placelists/list/ URLs', () => {
      expect(detectInputType('https://www.google.com/maps/placelists/list/ABC123xyz')).toBe('google-maps-list');
    });

    it('detects share_token URLs', () => {
      expect(detectInputType('https://www.google.com/maps/@40.7,-74.0,15z?share_token=ABCDEF123')).toBe('google-maps-list');
    });

    it('detects data-param list URLs (with !2s)', () => {
      expect(detectInputType('https://www.google.com/maps/@40.7,-74.0,15z/data=!4m3!11m2!2sCgsvZy8xMXRncXA1c2Y!3e3')).toBe('google-maps-list');
    });

    it('detects short maps.app.goo.gl URLs (ambiguous → defaults to list)', () => {
      expect(detectInputType('https://maps.app.goo.gl/abc123')).toBe('google-maps-list');
    });

    it('detects entitylist URLs', () => {
      expect(detectInputType('https://www.google.com/maps/preview/entitylist/getlist?id=123')).toBe('google-maps-list');
    });
  });

  describe('Google Maps Single Places', () => {
    it('detects /maps/place/ URLs', () => {
      expect(detectInputType('https://www.google.com/maps/place/Aman+Tokyo/@35.6,139.7,17z')).toBe('google-maps-place');
    });

    it('detects ?cid= URLs', () => {
      expect(detectInputType('https://google.com/maps?cid=1234567890')).toBe('google-maps-place');
    });

    it('detects /maps/search/ URLs', () => {
      expect(detectInputType('https://www.google.com/maps/search/restaurants+near+me')).toBe('google-maps-place');
    });
  });

  describe('Article URLs', () => {
    it('detects regular HTTP URLs', () => {
      expect(detectInputType('https://cntraveler.com/best-hotels-tokyo')).toBe('url');
    });

    it('detects www URLs', () => {
      expect(detectInputType('www.tripadvisor.com/Hotel-Review')).toBe('url');
    });

    it('detects HTTP URLs', () => {
      expect(detectInputType('http://example.com/article')).toBe('url');
    });
  });

  describe('Text input', () => {
    it('detects plain text', () => {
      expect(detectInputType('Aman Tokyo, Park Hyatt, Hoshinoya')).toBe('text');
    });

    it('detects search queries', () => {
      expect(detectInputType('Best restaurants in Kyoto')).toBe('text');
    });

    it('handles empty input', () => {
      expect(detectInputType('')).toBe('text');
    });

    it('handles whitespace-only input', () => {
      expect(detectInputType('   ')).toBe('text');
    });
  });

  describe('Case insensitivity', () => {
    it('handles uppercase URLs', () => {
      expect(detectInputType('HTTPS://WWW.GOOGLE.COM/MAPS/PLACE/Test')).toBe('google-maps-place');
    });

    it('handles mixed case', () => {
      expect(detectInputType('Https://Maps.App.Goo.GL/abc123')).toBe('google-maps-list');
    });
  });
});

// ─── detectInput (rich metadata API) ──────────────────────────────────────

describe('detectInput', () => {
  describe('platform detection', () => {
    it('detects Instagram links', () => {
      const result = detectInput('https://www.instagram.com/p/ABC123/');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('instagram');
    });

    it('detects Instagram short links', () => {
      const result = detectInput('https://instagr.am/p/ABC123/');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('instagram');
    });

    it('detects TikTok links', () => {
      const result = detectInput('https://www.tiktok.com/@user/video/123');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('tiktok');
    });

    it('detects TikTok short links', () => {
      const result = detectInput('https://vm.tiktok.com/ABC123/');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('tiktok');
    });

    it('detects TripAdvisor links', () => {
      const result = detectInput('https://www.tripadvisor.com/Hotel_Review-g123');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('tripadvisor');
    });

    it('detects Yelp links', () => {
      const result = detectInput('https://www.yelp.com/biz/restaurant-name');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('yelp');
    });

    it('detects Eater links', () => {
      const result = detectInput('https://www.eater.com/maps/best-restaurants-tokyo');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('eater');
    });

    it('detects Infatuation links', () => {
      const result = detectInput('https://www.theinfatuation.com/new-york/guides/best-restaurants');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('infatuation');
    });

    it('detects Condé Nast Traveler links', () => {
      const result = detectInput('https://www.cntraveler.com/gallery/best-hotels-paris');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('cntraveler');
    });

    it('detects Time Out links', () => {
      const result = detectInput('https://www.timeout.com/tokyo/restaurants/best-restaurants-in-tokyo');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('timeout');
    });

    it('detects Thrillist links', () => {
      const result = detectInput('https://www.thrillist.com/eat/nation/best-new-restaurants');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('thrillist');
    });

    it('detects Michelin Guide links', () => {
      const result = detectInput('https://guide.michelin.com/en/restaurants');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('michelin');
    });

    it('returns generic for unknown platforms', () => {
      const result = detectInput('https://example.com/some-article');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('generic');
    });
  });

  describe('URL normalization', () => {
    it('adds https:// to www. URLs', () => {
      const result = detectInput('www.example.com/article');
      expect(result.normalized).toBe(true);
      expect(result.cleanedInput).toBe('https://www.example.com/article');
    });

    it('does not normalize URLs that already have protocol', () => {
      const result = detectInput('https://example.com/article');
      expect(result.normalized).toBeFalsy();
    });
  });

  describe('Google Maps disambiguation', () => {
    it('identifies list patterns correctly', () => {
      const result = detectInput('https://www.google.com/maps/placelists/list/ABC123');
      expect(result.type).toBe('google-maps-list');
      expect(result.platform).toBe('google-maps');
    });

    it('identifies single place patterns correctly', () => {
      const result = detectInput('https://www.google.com/maps/place/Nobu+Restaurant/@40.7,-74.0');
      expect(result.type).toBe('google-maps-place');
      expect(result.platform).toBe('google-maps');
    });

    it('defaults short maps URLs to list', () => {
      const result = detectInput('https://maps.app.goo.gl/xyz789');
      expect(result.type).toBe('google-maps-list');
      expect(result.platform).toBe('google-maps');
    });
  });

  describe('text input', () => {
    it('returns text type for non-URL input', () => {
      const result = detectInput('Aman Tokyo, Park Hyatt');
      expect(result.type).toBe('text');
      expect(result.platform).toBeUndefined();
    });

    it('returns text type for empty input', () => {
      const result = detectInput('');
      expect(result.type).toBe('text');
    });
  });
});

// ─── extractPlaceIdFromMapsUrl ──────────────────────────────────────────

describe('extractPlaceIdFromMapsUrl', () => {
  it('extracts place name from /maps/place/ URL', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/Aman+Tokyo/@35.6,139.7,17z');
    expect(result).not.toBeNull();
    expect(result?.placeName).toBe('Aman Tokyo');
  });

  it('extracts coordinates from URL', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/Test/@35.6895,139.6917,17z');
    expect(result?.coordinates).toEqual({ lat: 35.6895, lng: 139.6917 });
  });

  it('extracts CID from query params', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.google.com/maps?cid=12345678901234');
    expect(result?.cid).toBe('12345678901234');
  });

  it('extracts hex CID from data params', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/Test/@35.6,139.7/data=!4m2!3m1!1s0x60188b857f56c3b3:0x5a1aed80fb1e2e98');
    expect(result?.placeId).toBe('0x60188b857f56c3b3:0x5a1aed80fb1e2e98');
  });

  it('extracts ChIJ place ID', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(result?.placeId).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
  });

  it('handles URL-encoded place names', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/L%27Atelier+de+Jo%C3%ABl+Robuchon/@35.6,139.7');
    expect(result?.placeName).toBe("L'Atelier de Joël Robuchon");
  });

  it('returns null for non-place URLs', () => {
    const result = extractPlaceIdFromMapsUrl('https://www.example.com/page');
    expect(result).toBeNull();
  });

  it('handles malformed URLs gracefully', () => {
    const result = extractPlaceIdFromMapsUrl('not a url at all');
    expect(result).toBeNull();
  });
});

// ─── getPlatformLabel ──────────────────────────────────────────────────────

describe('getPlatformLabel', () => {
  it('returns correct labels for all platforms', () => {
    expect(getPlatformLabel('google-maps')).toBe('Google Maps');
    expect(getPlatformLabel('instagram')).toBe('Instagram');
    expect(getPlatformLabel('tiktok')).toBe('TikTok');
    expect(getPlatformLabel('tripadvisor')).toBe('TripAdvisor');
    expect(getPlatformLabel('yelp')).toBe('Yelp');
    expect(getPlatformLabel('eater')).toBe('Eater');
    expect(getPlatformLabel('infatuation')).toBe('The Infatuation');
    expect(getPlatformLabel('cntraveler')).toBe('Condé Nast Traveler');
    expect(getPlatformLabel('timeout')).toBe('Time Out');
    expect(getPlatformLabel('thrillist')).toBe('Thrillist');
    expect(getPlatformLabel('michelin')).toBe('Michelin Guide');
  });

  it('returns "article" for generic/unknown', () => {
    expect(getPlatformLabel('generic')).toBe('article');
    expect(getPlatformLabel(undefined)).toBe('article');
  });
});

// ─── Real-world URL edge cases ─────────────────────────────────────────────

describe('Real-world URL patterns', () => {
  describe('Google Maps URLs from the wild', () => {
    it('handles long Google Maps place URLs with data params', () => {
      const url = 'https://www.google.com/maps/place/Aman+Tokyo/@35.6876532,139.7602204,17z/data=!3m1!4b1!4m6!3m5!1s0x60188b857f56c3b3:0x5a1aed80fb1e2e98!8m2!3d35.6876489!4d139.7627953!16s%2Fg%2F11tnqp5sf';
      expect(detectInputType(url)).toBe('google-maps-place');
    });

    it('handles Google Maps search URLs', () => {
      const url = 'https://www.google.com/maps/search/best+restaurants+in+tokyo/@35.6762,139.6503,14z';
      expect(detectInputType(url)).toBe('google-maps-place');
    });

    it('handles Google Maps list URL with complex data param', () => {
      const url = 'https://www.google.com/maps/@35.6762,139.6503,14z/data=!4m3!11m2!2sCgsvZy8xMXRucXA1c2Y!3e3';
      expect(detectInputType(url)).toBe('google-maps-list');
    });
  });

  describe('Travel article URLs', () => {
    it('handles CN Traveler gallery URLs', () => {
      const result = detectInput('https://www.cntraveler.com/gallery/best-new-hotels-in-the-world');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('cntraveler');
    });

    it('handles Eater map URLs', () => {
      const result = detectInput('https://www.eater.com/maps/best-restaurants-london-2024');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('eater');
    });

    it('handles Substack newsletter URLs', () => {
      const result = detectInput('https://travelnewsletter.substack.com/p/best-hotels-europe');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('generic');
    });

    it('handles Medium article URLs', () => {
      const result = detectInput('https://medium.com/@user/my-favorite-restaurants-in-paris-abc123');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('generic');
    });
  });

  describe('Social media URLs', () => {
    it('handles Instagram reel URLs', () => {
      const result = detectInput('https://www.instagram.com/reel/ABC123xyz/');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('instagram');
    });

    it('handles TikTok video URLs with tracking params', () => {
      const result = detectInput('https://www.tiktok.com/@foodie/video/123456?is_from_webapp=1');
      expect(result.type).toBe('url');
      expect(result.platform).toBe('tiktok');
    });
  });

  describe('Edge cases', () => {
    it('handles URLs with trailing whitespace', () => {
      expect(detectInputType('  https://www.cntraveler.com/article  ')).toBe('url');
    });

    it('handles URLs with capital letters', () => {
      expect(detectInputType('HTTPS://WWW.EATER.COM/maps/tokyo')).toBe('url');
    });

    it('does not treat email addresses as URLs', () => {
      expect(detectInputType('user@example.com')).toBe('text');
    });

    it('does not treat partial URLs without protocol as URLs', () => {
      // Only www. prefix gets auto-normalized
      expect(detectInputType('example.com/article')).toBe('text');
    });

    it('handles www. prefix normalization for maps', () => {
      const result = detectInput('www.google.com/maps/place/Test');
      expect(result.type).toBe('google-maps-place');
      expect(result.normalized).toBe(true);
    });
  });
});
