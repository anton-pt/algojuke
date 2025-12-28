import { NavLink } from 'react-router-dom';
import './LibraryNav.css';

export function LibraryNav() {
  return (
    <nav className="library-nav">
      <NavLink
        to="/library/albums"
        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
      >
        Albums
      </NavLink>
      <NavLink
        to="/library/tracks"
        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
      >
        Tracks
      </NavLink>
    </nav>
  );
}
