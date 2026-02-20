import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface Collaborator {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: 'viewer' | 'suggester';
  status: 'pending' | 'accepted' | 'declined';
  invitedAt: string;
  acceptedAt: string | null;
}

export interface TripOwner {
  id: string;
  email: string;
  name: string | null;
}

export interface Suggestion {
  id: string;
  tripId: string;
  userId: string;
  user: { id: string; email: string; name: string | null };
  placeName: string;
  placeType: string;
  placeLocation: string | null;
  placeData: Record<string, unknown> | null;
  targetDay: number;
  targetSlotId: string;
  reason: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  respondedAt: string | null;
  createdAt: string;
}

export interface Reaction {
  id: string;
  tripId: string;
  userId: string;
  user: { id: string; email: string; name: string | null };
  placeKey: string;
  reaction: 'love' | 'not_for_me';
  note: string | null;
  createdAt: string;
}

export interface SlotNoteItem {
  id: string;
  tripId: string;
  userId: string;
  user: { id: string; email: string; name: string | null };
  dayNumber: number;
  slotId: string;
  content: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  tripId: string;
  userId: string | null;
  type: string;
  summary: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

// ═══════════════════════════════════════════
// Store
// ═══════════════════════════════════════════

interface CollaborationState {
  // Data
  tripId: string | null;
  owner: TripOwner | null;
  collaborators: Collaborator[];
  suggestions: Suggestion[];
  reactions: Reaction[];
  slotNotes: SlotNoteItem[];
  activities: Activity[];
  myRole: 'owner' | 'suggester' | 'viewer' | null;

  // Sync state
  lastSyncAt: string | null;
  isLoading: boolean;

  // Actions
  loadTripCollaboration: (tripId: string) => Promise<void>;
  inviteCollaborator: (tripId: string, email: string, role?: string) => Promise<{ inviteUrl?: string; error?: string }>;
  suggestPlace: (tripId: string, data: {
    placeName: string;
    placeType: string;
    placeLocation?: string;
    placeData?: Record<string, unknown>;
    targetDay: number;
    targetSlotId: string;
    reason?: string;
  }) => Promise<void>;
  respondToSuggestion: (tripId: string, suggestionId: string, status: 'accepted' | 'rejected') => Promise<void>;
  addReaction: (tripId: string, placeKey: string, reaction: 'love' | 'not_for_me', note?: string) => Promise<void>;
  addSlotNote: (tripId: string, dayNumber: number, slotId: string, content: string) => Promise<void>;
  pollActivity: (tripId: string) => Promise<boolean>;
  reset: () => void;
}

// Safe fetch that returns null on error (for parallel loading)
async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    return await apiFetch<T>(url);
  } catch {
    return null;
  }
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  tripId: null,
  owner: null,
  collaborators: [],
  suggestions: [],
  reactions: [],
  slotNotes: [],
  activities: [],
  myRole: null,
  lastSyncAt: null,
  isLoading: false,

  loadTripCollaboration: async (tripId) => {
    set({ isLoading: true, tripId });

    try {
      const [collabRes, suggestRes, reactRes, notesRes, activityRes] = await Promise.all([
        safeFetch<{ owner: TripOwner; collaborators: Collaborator[]; myRole: string }>(`/api/trips/${tripId}/collaborators`),
        safeFetch<{ suggestions: Suggestion[] }>(`/api/trips/${tripId}/suggestions`),
        safeFetch<{ reactions: Reaction[] }>(`/api/trips/${tripId}/reactions`),
        safeFetch<{ notes: SlotNoteItem[] }>(`/api/trips/${tripId}/notes`),
        safeFetch<{ activities: Activity[]; lastActivityAt: string; count: number }>(`/api/trips/${tripId}/activity?limit=50`),
      ]);

      set({
        owner: collabRes?.owner || null,
        collaborators: collabRes?.collaborators || [],
        myRole: (collabRes?.myRole as CollaborationState['myRole']) || null,
        suggestions: suggestRes?.suggestions || [],
        reactions: reactRes?.reactions || [],
        slotNotes: notesRes?.notes || [],
        activities: activityRes?.activities || [],
        lastSyncAt: activityRes?.lastActivityAt || new Date().toISOString(),
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  inviteCollaborator: async (tripId, email, role = 'suggester') => {
    try {
      const data = await apiFetch<{ inviteUrl?: string; collaborator: Collaborator }>(
        `/api/trips/${tripId}/collaborators`,
        { method: 'POST', body: JSON.stringify({ email, role }) },
      );

      // Refresh collaborators list
      const collabData = await safeFetch<{ collaborators: Collaborator[] }>(`/api/trips/${tripId}/collaborators`);
      if (collabData) {
        set({ collaborators: collabData.collaborators });
      }

      return { inviteUrl: data.inviteUrl };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to invite' };
    }
  },

  suggestPlace: async (tripId, suggestData) => {
    try {
      const data = await apiFetch<{ suggestion: Suggestion }>(
        `/api/trips/${tripId}/suggestions`,
        { method: 'POST', body: JSON.stringify(suggestData) },
      );
      set(s => ({ suggestions: [data.suggestion, ...s.suggestions] }));
    } catch {
      // silently fail
    }
  },

  respondToSuggestion: async (tripId, suggestionId, status) => {
    try {
      await apiFetch(
        `/api/trips/${tripId}/suggestions/${suggestionId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      set(s => ({
        suggestions: s.suggestions.map(sg =>
          sg.id === suggestionId ? { ...sg, status, respondedAt: new Date().toISOString() } : sg
        ),
      }));
    } catch {
      // silently fail
    }
  },

  addReaction: async (tripId, placeKey, reaction, note) => {
    try {
      const data = await apiFetch<{ reaction: Reaction }>(
        `/api/trips/${tripId}/reactions`,
        { method: 'POST', body: JSON.stringify({ placeKey, reaction, note }) },
      );
      set(s => {
        const filtered = s.reactions.filter(
          r => !(r.userId === data.reaction.userId && r.placeKey === data.reaction.placeKey)
        );
        return { reactions: [data.reaction, ...filtered] };
      });
    } catch {
      // silently fail
    }
  },

  addSlotNote: async (tripId, dayNumber, slotId, content) => {
    try {
      const data = await apiFetch<{ note: SlotNoteItem }>(
        `/api/trips/${tripId}/notes`,
        { method: 'POST', body: JSON.stringify({ dayNumber, slotId, content }) },
      );
      set(s => ({ slotNotes: [...s.slotNotes, data.note] }));
    } catch {
      // silently fail
    }
  },

  pollActivity: async (tripId) => {
    const { lastSyncAt } = get();
    const since = lastSyncAt || new Date(Date.now() - 60000).toISOString();

    try {
      const data = await apiFetch<{ activities: Activity[]; lastActivityAt: string; count: number }>(
        `/api/trips/${tripId}/activity?since=${since}`,
      );

      if (data.count > 0) {
        set(s => ({
          activities: [...data.activities, ...s.activities].slice(0, 200),
          lastSyncAt: data.lastActivityAt,
        }));

        // Refresh suggestions, reactions, notes if there were changes
        const types = new Set(data.activities.map((a: Activity) => a.type));
        if (types.has('suggestion_added') || types.has('suggestion_accepted') || types.has('suggestion_rejected')) {
          const suggestData = await safeFetch<{ suggestions: Suggestion[] }>(`/api/trips/${tripId}/suggestions`);
          if (suggestData) set({ suggestions: suggestData.suggestions });
        }
        if (types.has('reaction_added')) {
          const reactData = await safeFetch<{ reactions: Reaction[] }>(`/api/trips/${tripId}/reactions`);
          if (reactData) set({ reactions: reactData.reactions });
        }
        if (types.has('note_added')) {
          const notesData = await safeFetch<{ notes: SlotNoteItem[] }>(`/api/trips/${tripId}/notes`);
          if (notesData) set({ slotNotes: notesData.notes });
        }

        return true;
      }

      set({ lastSyncAt: data.lastActivityAt || since });
      return false;
    } catch {
      return false;
    }
  },

  reset: () => set({
    tripId: null,
    owner: null,
    collaborators: [],
    suggestions: [],
    reactions: [],
    slotNotes: [],
    activities: [],
    myRole: null,
    lastSyncAt: null,
    isLoading: false,
  }),
}));
