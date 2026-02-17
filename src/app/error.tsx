'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: '#d63020' }}>Something went wrong</h2>
      <pre style={{
        background: '#f5f0e6',
        padding: '1rem',
        borderRadius: '8px',
        overflow: 'auto',
        fontSize: '12px',
        whiteSpace: 'pre-wrap',
      }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#1c1a17',
          color: '#f8f3ea',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
