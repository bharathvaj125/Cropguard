import {
  Activity,
  BookOpen,
  CalendarCheck,
  CloudSun,
  History,
  LayoutDashboard,
  Leaf,
  LogOut,
  Megaphone,
  Menu,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Sprout,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Loading } from './ui.jsx';

const FARMER_NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/scan', label: 'Scan a crop', icon: ScanLine },
  { to: '/app/history', label: 'Scan history', icon: History },
  { to: '/app/farms', label: 'My farms', icon: Sprout },
  { to: '/app/activities', label: 'Activities', icon: CalendarCheck },
  { to: '/app/weather', label: 'Weather', icon: CloudSun },
  { to: '/app/market', label: 'Market prices', icon: TrendingUp },
  { to: '/app/library', label: 'Disease & pest guide', icon: BookOpen },
];

const ADMIN_NAV = [
  { to: '/app/admin', label: 'Overview', icon: ShieldCheck, end: true },
  { to: '/app/admin/users', label: 'Users', icon: Users },
  { to: '/app/admin/farms', label: 'Farms', icon: Sprout },
  { to: '/app/admin/reports', label: 'AI reports', icon: Activity },
  { to: '/app/admin/advisories', label: 'Advisories', icon: Megaphone },
  { to: '/app/admin/log', label: 'Activity log', icon: ScrollText },
];

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark">
        <Leaf size={19} />
      </span>
      CropGuard
    </Link>
  );
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={onNavigate}>
      <Icon size={18} />
      {item.label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Start each page at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const close = () => setOpen(false);
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <header className="topbar">
        <Brand to="/app" />
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </header>
      {open ? <div className="scrim" onClick={close} aria-hidden="true" /> : null}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <Brand to="/app" />
        <nav aria-label="Main">
          {FARMER_NAV.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={close} />
          ))}
          {isAdmin ? (
            <>
              <div className="nav-label">Administration</div>
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={close} />
              ))}
            </>
          ) : null}
        </nav>

        <div className="sidebar-foot stack-sm">
          <NavItem item={{ to: '/app/profile', label: 'Profile & security', icon: UserCog }} onNavigate={close} />
          <div className="user-chip">
            <span className="avatar">{initials}</span>
            <div className="grow">
              <div className="truncate strong" style={{ color: '#fff', fontSize: '0.9rem' }}>
                {user.name}
              </div>
              <div className="truncate tiny" style={{ color: '#9db8a8' }}>
                {isAdmin ? 'Administrator' : 'Farmer'}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" style={{ color: '#cfe0d5' }} onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="container">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
