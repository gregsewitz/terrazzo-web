# Terrazzo Next.js App - Files Created

## Pages (Client Components)

### 1. Root & Trips
- `/src/app/page.tsx` - Root page with redirect to /trips
- `/src/app/trips/page.tsx` - Trip list page showing all trips
- `/src/app/trips/[id]/page.tsx` - Trip detail page with day planner, pool tray, import, and chat

### 2. Navigation Pages
- `/src/app/discover/page.tsx` - Discover curated collections page
- `/src/app/saved/page.tsx` - Saved places and bookmarks page
- `/src/app/profile/page.tsx` - User profile with taste profile visualization

## API Routes

### Places API
- `/src/app/api/places/search/route.ts` - POST endpoint to search places using Google Places API

### Email Authentication (Nylas)
- `/src/app/api/auth/nylas/connect/route.ts` - GET endpoint to initiate OAuth flow
- `/src/app/api/auth/nylas/callback/route.ts` - GET endpoint to handle OAuth callback

### Email Parsing & Scanning
- `/src/app/api/email/scan/route.ts` - POST endpoint to scan Gmail for booking emails
- `/src/app/api/email/parse/route.ts` - POST endpoint to parse email body to bookings

### Content Import
- `/src/app/api/import/url/route.ts` - POST endpoint to import places from article URLs
- `/src/app/api/import/text/route.ts` - POST endpoint to import places from pasted text

## Directory Structure

```
src/app/
├── page.tsx                          # Root redirect
├── layout.tsx                        # (existing)
│
├── trips/
│   ├── page.tsx                      # Trip list
│   └── [id]/
│       └── page.tsx                  # Trip detail
│
├── discover/
│   └── page.tsx                      # Discover page
│
├── saved/
│   └── page.tsx                      # Saved places
│
├── profile/
│   └── page.tsx                      # Profile page
│
└── api/
    ├── places/
    │   └── search/
    │       └── route.ts              # Place search
    │
    ├── auth/
    │   └── nylas/
    │       ├── connect/
    │       │   └── route.ts          # Nylas OAuth initiate
    │       └── callback/
    │           └── route.ts          # Nylas OAuth callback
    │
    ├── email/
    │   ├── scan/
    │   │   └── route.ts              # Email scanning
    │   └── parse/
    │       └── route.ts              # Email parsing
    │
    └── import/
        ├── url/
        │   └── route.ts              # URL import
        └── text/
            └── route.ts              # Text import
```

## Features Implemented

### Pages
1. **Root Page** - Redirects to /trips
2. **Trips List** - Shows all trips with trip card previews
3. **Trip Detail** - Main trip interface with:
   - Day planner for itinerary
   - Pool tray for saved places
   - Import drawer for adding places
   - Chat sidebar for AI assistance
   - Place detail sheet for viewing place info
4. **Discover** - Curated collections (placeholder)
5. **Saved** - Bookmarked places and collections (empty state)
6. **Profile** - User taste profile with visual axes

### API Endpoints
1. **Places Search** - Integrates with Google Places API
2. **Email OAuth** - Connects Gmail via Nylas
3. **Email Scanning** - Finds booking confirmations in email
4. **Email Parsing** - Extracts place data from email bodies
5. **URL Import** - Scrapes and extracts places from articles
6. **Text Import** - Parses pasted text lists of places

## Dependencies Used
- Next.js App Router (with client components and server routes)
- Zustand (for trip and import state management)
- Google Places API
- Nylas Mail API
- OpenAI API

All files are ready for integration with existing components and stores.
