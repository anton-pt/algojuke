import { NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import './AppHeader.css';

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-content">
        <h1 className="app-title">AlgoJuke</h1>
        <nav className="app-nav">
          <NavLink
            to="/search"
            className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}
          >
            Search
          </NavLink>
          <NavLink
            to="/discover"
            className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}
          >
            Discover
          </NavLink>
          <NavLink
            to="/library/albums"
            className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}
          >
            Library
          </NavLink>
        </nav>
        <div className="app-header-user">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
