import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, Wrench, BookOpen, Cpu, Menu, X, Bookmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { trackEvent } from '../../services/telemetry';
import styles from './Layout.module.css';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickVin, setQuickVin] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view', { path: location.pathname, search: location.search });
  }, [location.pathname, location.search]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickVin.trim().length === 17) {
      navigate(`/vin?vin=${quickVin.trim().toUpperCase()}`);
      setQuickVin('');
      setMenuOpen(false);
    } else if (quickVin.trim().length > 0) {
      navigate(`/search?q=${encodeURIComponent(quickVin.trim())}`);
      setQuickVin('');
      setMenuOpen(false);
    }
  };

  return (
    <div className={styles.app}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          {/* Logo */}
          <Link to="/" className={styles.logo}>
            <Wrench size={20} className={styles.logoIcon} />
            <span className={styles.logoText}>
              Auto<span className={styles.logoAccent}>Parts</span>
            </span>
            <span className={styles.logoBeta}>BETA</span>
          </Link>

          {/* Quick search */}
          <form
            onSubmit={handleQuickSearch}
            className={styles.headerSearch}
            role="search"
            aria-label="Vehicle search"
          >
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              aria-label="Search by VIN, part number, or model"
              placeholder="VIN, part #, or model..."
              value={quickVin}
              onChange={e => setQuickVin(e.target.value)}
              maxLength={40}
            />
          </form>

          {/* Nav */}
          <nav className={styles.nav}>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navActive : ''}`
              }
              end
            >
              <Cpu size={15} />
              Home
            </NavLink>
            <NavLink
              to="/vin"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navActive : ''}`
              }
            >
              <Search size={15} />
              VIN Decoder
            </NavLink>
            <NavLink
              to="/catalog"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navActive : ''}`
              }
            >
              <BookOpen size={15} />
              Catalog
            </NavLink>
            <NavLink
              to="/garage"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navActive : ''}`
              }
            >
              <Bookmark size={15} />
              Garage
            </NavLink>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className={styles.mobileToggle}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div id="mobile-menu" className={styles.mobileMenu}>
            <NavLink to="/" onClick={() => setMenuOpen(false)}>Home</NavLink>
            <NavLink to="/vin" onClick={() => setMenuOpen(false)}>VIN Decoder</NavLink>
            <NavLink to="/catalog" onClick={() => setMenuOpen(false)}>Catalog</NavLink>
            <NavLink to="/garage" onClick={() => setMenuOpen(false)}>My Garage</NavLink>
            <form
              onSubmit={handleQuickSearch}
              className={styles.mobileSearch}
              role="search"
              aria-label="Mobile vehicle search"
            >
              <input
                className="input"
                aria-label="Search by VIN, part number, or model"
                placeholder="Search VIN, part #, or model..."
                value={quickVin}
                onChange={e => setQuickVin(e.target.value)}
              />
            </form>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <span className={styles.footerLogo}>
            <Wrench size={14} />
            AutoParts
          </span>
          <span className={styles.footerText}>
            Representative parts catalog · frontend-only · VIN data from NHTSA
          </span>
          <div className={styles.footerLinks}>
            <a href="https://github.com/len-golani/AutoParts-fb/issues" target="_blank" rel="noreferrer">Issues</a>
            <a href="https://github.com/len-golani/AutoParts-fb" target="_blank" rel="noreferrer">Source</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
