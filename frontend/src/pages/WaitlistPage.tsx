/**
 * Waitlist Page
 *
 * Shown to authenticated users who are not on the approved allowlist.
 */

import { UserButton } from '@clerk/clerk-react';
import { AuthLayout } from '../components/layout/AuthLayout';

export function WaitlistPage(): JSX.Element {
  return (
    <AuthLayout>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
        <h2>Thanks for Your Interest!</h2>
        <p>
          AlgoJuke is currently in private beta with limited access. We're
          working hard to open up to more users soon.
        </p>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '1.5rem',
            margin: '1.5rem 0',
          }}
        >
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
            You're on the waitlist!
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            We'll notify you via email when access becomes available.
          </p>
        </div>

        <p style={{ marginTop: '1.5rem' }}>
          In the meantime, make sure you have a Tidal subscription ready – you'll
          need it to use AlgoJuke when you get access.
        </p>

        <div
          style={{
            marginTop: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>Signed in as:</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </AuthLayout>
  );
}
