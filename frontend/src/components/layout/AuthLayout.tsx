/**
 * Auth Layout Component
 *
 * Layout wrapper for authentication-related pages (landing, waitlist, connect).
 * Provides consistent styling and branding for the auth flow.
 */

import { ReactNode } from 'react';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Centered layout for auth pages with AlgoJuke branding
 */
export function AuthLayout({ children }: AuthLayoutProps): ReactNode {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <header className="auth-header">
          <h1 className="auth-logo">AlgoJuke</h1>
          <span className="auth-beta-badge">Private Beta</span>
        </header>
        <main className="auth-content">{children}</main>
        <footer className="auth-footer">
          <p>&copy; {new Date().getFullYear()} AlgoJuke. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
