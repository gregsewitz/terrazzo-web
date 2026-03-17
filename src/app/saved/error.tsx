'use client';

export default function SavedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
      <h2 style={{ fontSize: '1.25rem', color: '#002a55', marginBottom: '0.5rem' }}>
        Couldn&apos;t load your saved places
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        {error.message || 'Something went wrong while loading your library.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.25rem',
          background: '#002a55',
          color: '#f8f3ea',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Try again
      </button>
    </div>
  );
}
