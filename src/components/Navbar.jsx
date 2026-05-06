import { Link, NavLink } from 'react-router-dom'

function navLinkClass({ isActive }) {
  return `app-navbar-link${isActive ? ' app-navbar-link--active' : ''}`
}

export default function Navbar() {
  return (
    <nav className="app-navbar" aria-label="Main">
      <div className="app-navbar-inner">
        <Link to="/" className="app-navbar-brand">
          LA28 Momentum Exchange
        </Link>
        <div className="app-navbar-links">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/market" className={navLinkClass}>
            Market
          </NavLink>
          <NavLink to="/portfolio" className={navLinkClass}>
            Portfolio
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
