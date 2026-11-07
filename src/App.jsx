import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  FolderKanban,
  HandCoins,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { makeId, useWorkspace } from './context/WorkspaceContext';
import api from './services/apiClient';
import { changePassword } from './services/authService';

const statusClasses = {
  'Approved': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Under Review': 'border-amber-200 bg-amber-50 text-amber-700',
  'Screening': 'border-sky-200 bg-sky-50 text-sky-700',
  'Rejected': 'border-rose-200 bg-rose-50 text-rose-700',
  'Successful': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Pending': 'border-amber-200 bg-amber-50 text-amber-700',
  'Failed': 'border-rose-200 bg-rose-50 text-rose-700',
  'Active': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Pending Lease': 'border-amber-200 bg-amber-50 text-amber-700',
  'Ended': 'border-slate-200 bg-slate-100 text-slate-700',
  'Available': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Occupied': 'border-sky-200 bg-sky-50 text-sky-700',
  'Maintenance': 'border-amber-200 bg-amber-50 text-amber-700',
  'Awaiting Review': 'border-amber-200 bg-amber-50 text-amber-700',
  'In Progress': 'border-sky-200 bg-sky-50 text-sky-700',
  'Scheduled': 'border-violet-200 bg-violet-50 text-violet-700',
  'High': 'border-rose-200 bg-rose-50 text-rose-700',
  'Medium': 'border-amber-200 bg-amber-50 text-amber-700',
  'Low': 'border-slate-200 bg-slate-100 text-slate-700',
  'Unpaid': 'border-amber-200 bg-amber-50 text-amber-700',
  'Paid': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Partial': 'border-violet-200 bg-violet-50 text-violet-700',
  'Submitted': 'border-sky-200 bg-sky-50 text-sky-700',
  'Acknowledge': 'border-violet-200 bg-violet-50 text-violet-700',
  'Completed': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Cancelled': 'border-rose-200 bg-rose-50 text-rose-700',
  'Archived': 'border-slate-200 bg-slate-100 text-slate-700',
  'Inactive': 'border-slate-200 bg-slate-100 text-slate-700',
  'Overdue': 'border-rose-200 bg-rose-50 text-rose-700',
  'Void': 'border-slate-200 bg-slate-100 text-slate-600',
  'Not applicable': 'border-slate-200 bg-slate-100 text-slate-700',
};

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<RootRedirect user={user} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/landlord"
        element={
          <ProtectedRoute role="landlord">
            <LandlordLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LandlordDashboardPage />} />
        <Route path="dashboard" element={<LandlordDashboardPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="units" element={<RentalUnitsPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="screening" element={<ScreeningPage />} />
        <Route path="leases" element={<LeasesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="activity" element={<ActivityLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/tenant"
        element={
          <ProtectedRoute role="tenant">
            <TenantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TenantDashboardPage />} />
        <Route path="dashboard" element={<TenantDashboardPage />} />
        <Route path="applications" element={<TenantApplicationsPage />} />
        <Route path="rentals" element={<TenantRentalsPage />} />
        <Route path="lease" element={<TenantLeasePage />} />
        <Route path="invoices" element={<TenantInvoicesPage />} />
        <Route path="payments" element={<TenantPaymentsPage />} />
        <Route path="maintenance" element={<TenantMaintenancePage />} />
        <Route path="notifications" element={<TenantNotificationsPage />} />
        <Route path="settings" element={<TenantSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRedirect({ user }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'landlord' ? '/landlord' : '/tenant'} replace />;
}

function ProtectedRoute({ children, role }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-slate-700 shadow-soft">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        Loading dashboard...
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }

    try {
      const user = await login({ ...form });
      if (user?.role === 'landlord') {
        navigate('/landlord');
      } else {
        navigate('/tenant');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft lg:grid-cols-2">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-8 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2.5"><Building2 className="h-6 w-6" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">Portfolio</p>
              <h1 className="text-2xl font-bold">TenantFlow</h1>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-100">Property operations</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">Smarter rent, lease, and maintenance workflows.</h2>
            </div>

            <div className="space-y-4">
              {[
                'Role-based landlord and tenant access',
                'Payment verification through backend workflow',
                'Maintenance and leasing lifecycle tracking',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-100" />
                  <span className="text-sm text-emerald-50">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-600">Welcome back</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900">Sign in</h3>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-email" className="label">Email</label>
              <input
                id="login-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="field"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="label">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="field"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}

            <button type="submit" className="primary-btn w-full">
              Sign in
            </button>

            <div className="text-center text-sm text-slate-600">
              Don’t have an account?{' '}
              <button type="button" onClick={() => navigate('/register')} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
                Create account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [state, setState] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const user = await register(state);
      navigate(user.role === 'landlord' ? '/landlord' : '/tenant');
    } catch (registerError) {
      setError(registerError.message || 'Account registration failed.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-600">Create account</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">Register</h3>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="register-name" className="label">Full name</label>
            <input
              id="register-name"
              required
              value={state.name}
              onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
              className="field"
              placeholder="Jordan Smith"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="label">Email</label>
            <input
              id="register-email"
              type="email"
              required
              value={state.email}
              onChange={(event) => setState((prev) => ({ ...prev, email: event.target.value }))}
              className="field"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="label">Password</label>
            <input
              id="register-password"
              type="password"
              minLength={8}
              required
              value={state.password}
              onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
              className="field"
              placeholder="Create a secure password"
            />
          </div>

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <button type="submit" className="primary-btn w-full">Create account</button>
          <div className="text-center text-sm text-slate-600">
            Already registered?{' '}
            <button type="button" onClick={() => navigate('/login')} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="panel w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Access denied</h2>
        <p className="mt-3 text-slate-600">This account does not have permission to view that dashboard.</p>
        <button className="primary-btn mt-6" onClick={() => window.location.href = '/login'}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function LandlordLayout() {
  const { logout, user } = useAuth();
  const { data, loading, error } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', to: '/landlord/dashboard', icon: LayoutDashboard },
    { label: 'Properties', to: '/landlord/properties', icon: Building2 },
    { label: 'Rental Units', to: '/landlord/units', icon: Home },
    { label: 'Applications', to: '/landlord/applications', icon: Users },
    { label: 'Screening', to: '/landlord/screening', icon: FileText },
    { label: 'Leases', to: '/landlord/leases', icon: CalendarDays },
    { label: 'Invoices', to: '/landlord/invoices', icon: ReceiptText },
    { label: 'Expenses', to: '/landlord/expenses', icon: HandCoins },
    { label: 'Maintenance', to: '/landlord/maintenance', icon: Wrench },
    { label: 'Notifications', to: '/landlord/notifications', icon: Bell },
    { label: 'Activity log', to: '/landlord/activity', icon: ClipboardList },
    { label: 'Settings', to: '/landlord/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const submitSearch = (event) => {
    if (event.key !== 'Enter' || !headerSearch.trim()) return;
    const term = headerSearch.toLowerCase();
    const destination = term.includes('unit') ? '/landlord/units'
      : term.includes('application') || term.includes('applicant') ? '/landlord/applications'
        : term.includes('lease') ? '/landlord/leases'
          : term.includes('invoice') || term.includes('payment') ? '/landlord/invoices'
            : term.includes('maintenance') ? '/landlord/maintenance'
              : '/landlord/properties';
    navigate(`${destination}?q=${encodeURIComponent(headerSearch)}`);
  };
  const accountName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Landlord';

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className={`${isCollapsed ? 'w-24' : 'w-72'} hidden border-r border-slate-200 bg-white lg:flex lg:flex-col`}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">TF</div>
            {!isCollapsed && <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Portfolio</p><p className="text-lg font-bold text-slate-900">TenantFlow</p></div>}
          </div>
          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" onClick={() => setIsCollapsed((prev) => !prev)}>
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
              {!isCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            {!isCollapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white transition lg:hidden`}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">TF</div>
            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Portfolio</p><p className="text-lg font-bold text-slate-900">TenantFlow</p></div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Landlord dashboard</p>
              <h1 className="text-xl font-bold text-slate-900">Operations overview</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={headerSearch} onChange={(event) => setHeaderSearch(event.target.value)} onKeyDown={submitSearch} className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" placeholder="Search and press Enter" />
            </div>
            <button onClick={() => navigate('/landlord/notifications')} aria-label={`${data.notifications.filter((item) => !item.read).length} unread notifications`} className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Bell className="h-4 w-4" />{data.notifications.some((item) => !item.read) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />}</button>
            <button onClick={() => navigate('/landlord/settings')} className="flex items-center gap-3 rounded-xl border border-slate-200 px-2.5 py-1.5 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">{shortInitials(accountName)}</div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold text-slate-900">{accountName}</div>
                <div className="text-xs text-slate-500">Landlord</div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-4 p-4 sm:p-6">
          <PreviewNotice loading={loading} error={error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TenantLayout() {
  const { logout, user } = useAuth();
  const { data, loading, error } = useWorkspace();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Tenant';
  const navItems = [
    { label: 'Dashboard', to: '/tenant/dashboard', icon: LayoutDashboard },
    { label: 'Available rentals', to: '/tenant/rentals', icon: Building2 },
    { label: 'Applications', to: '/tenant/applications', icon: FolderKanban },
    { label: 'My Lease', to: '/tenant/lease', icon: Home },
    { label: 'Invoices', to: '/tenant/invoices', icon: ReceiptText },
    { label: 'Payments', to: '/tenant/payments', icon: CreditCard },
    { label: 'Maintenance', to: '/tenant/maintenance', icon: Wrench },
    { label: 'Notifications', to: '/tenant/notifications', icon: Bell },
    { label: 'Settings', to: '/tenant/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">TF</div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant portal</p>
              <p className="text-lg font-bold text-slate-900">Resident</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white transition lg:hidden`}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">TF</div>
            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant portal</p><p className="text-lg font-bold text-slate-900">Resident</p></div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"><LogOut className="h-4 w-4" /> Logout</button>
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div>
            <button onClick={() => setMobileOpen(true)} className="mr-3 rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"><Menu className="h-4 w-4" /></button>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resident dashboard</p>
            <h1 className="text-xl font-bold text-slate-900">Lease and payments</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/tenant/notifications')} aria-label={`${data.notifications.filter((item) => !item.read).length} unread notifications`} className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Bell className="h-4 w-4" />{data.notifications.some((item) => !item.read) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />}</button>
            <button onClick={() => navigate('/tenant/settings')} className="flex items-center gap-3 rounded-xl border border-slate-200 px-2.5 py-1.5 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">{shortInitials(accountName)}</div>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900">{accountName}</div>
                <div className="text-xs text-slate-500">Tenant</div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-4 p-4 sm:p-6">
          <PreviewNotice loading={loading} error={error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function LandlordDashboardPage() {
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const activeLeaseCount = data.leases.filter((item) => item.status === 'Active').length;
  const occupiedCount = data.units.filter((item) => ['occupied', 'Occupied'].includes(item.status)).length;
  const unpaidTotal = data.invoices.filter((item) => ['unpaid', 'overdue', 'partially_paid', 'Unpaid', 'Partial'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dashboardStats = [
    { label: 'Total Properties', value: data.properties.length, delta: 'In this portfolio', tone: 'emerald' },
    { label: 'Total Rental Units', value: data.units.length, delta: `${occupiedCount} currently occupied`, tone: 'sky' },
    { label: 'Occupied Units', value: occupiedCount, delta: data.units.length ? `${Math.round((occupiedCount / data.units.length) * 100)}% occupancy` : 'No units yet', tone: 'violet' },
    { label: 'Available Units', value: data.units.filter((item) => ['vacant', 'Available'].includes(item.status)).length, delta: 'Ready to lease', tone: 'amber' },
    { label: 'Active Leases', value: activeLeaseCount, delta: 'Current agreements', tone: 'emerald' },
    { label: 'Pending Applications', value: data.applications.filter((item) => ['Submitted', 'Under Review', 'Screening'].includes(item.status)).length, delta: 'Awaiting review', tone: 'rose' },
    { label: 'Unpaid Invoices', value: `$${unpaidTotal.toLocaleString()}`, delta: 'Outstanding total', tone: 'amber' },
    { label: 'Monthly Income', value: `$${data.leases.filter((item) => item.status === 'Active').reduce((sum, item) => sum + Number(item.rent || 0), 0).toLocaleString()}`, delta: 'Based on active leases', tone: 'sky' },
  ];
  const recentPayments = data.paymentHistory.slice(0, 3);
  const occupancyData = [
    { name: 'Occupied', value: data.units.length ? Math.round((occupiedCount / data.units.length) * 100) : 0 },
    { name: 'Vacant', value: data.units.length ? Math.round((data.units.filter((item) => ['vacant', 'Available'].includes(item.status)).length / data.units.length) * 100) : 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio dashboard"
        subtitle="Track occupancy, revenue, maintenance, and application activity."
        action={<button className="primary-btn" onClick={() => downloadCsv('portfolio-summary.csv', [['Metric', 'Value'], ...dashboardStats.map((item) => [item.label, item.value])])}>Generate report</button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Rental income overview</h3>
            <span className="text-sm text-slate-500">Recent verified payments</span>
          </div>
          <div className="flex h-56 items-end gap-3">
            {recentPayments.map((item) => (
              <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-2xl bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${Math.min(100, (Number(item.amount || 0) / Math.max(1, ...data.paymentHistory.map((payment) => Number(payment.amount || 0)))) * 100)}%` }} />
                <span className="text-xs text-slate-500">{item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short' }) : '—'}</span>
              </div>
            ))}
            {!recentPayments.length && <p className="m-auto text-sm text-slate-500">No verified payment data yet.</p>}
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Property occupancy</h3>
          <div className="space-y-4">
            {occupancyData.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                  <span>{item.name}</span>
                  <span className="font-semibold text-slate-900">{item.value}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="panel p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent applications</h3>
            <button className="text-sm font-medium text-emerald-700" onClick={() => navigate('/landlord/applications')}>View all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Applicant</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.applications.slice(0, 4).map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4 font-medium text-slate-800">{item.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{item.date}</td>
                    <td className="py-3 pr-4"><StatusBadge label={item.status} /></td>
                    <td className="py-3 text-slate-800">{item.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent payments</h3>
            <button className="text-sm font-medium text-emerald-700" onClick={() => navigate('/landlord/invoices')}>Review</button>
          </div>
          <div className="space-y-4">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{payment.receiptNumber || `Payment ${payment.id}`}</p>
                    <p className="text-xs text-slate-500">{payment.method || 'Payment'}</p>
                  </div>
                  <StatusBadge label={payment.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span>{payment.date}</span>
                  <span className="font-semibold text-slate-900">${Number(payment.amount || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {!recentPayments.length && <p className="text-sm text-slate-500">No payment records yet.</p>}
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Maintenance requests needing attention</h3>
          <button className="text-sm font-medium text-emerald-700" onClick={() => navigate('/landlord/maintenance')}>Manage</button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {data.maintenance.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.unit}</p>
                </div>
                <StatusBadge label={item.priority} />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className="font-medium text-slate-800">{item.status}</span>
              </div>
            </div>
          ))}
          {!data.maintenance.length && <p className="text-sm text-slate-500">No maintenance requests yet.</p>}
        </div>
      </div>
    </div>
  );
}

function PropertiesPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const visibleProperties = data.properties.filter((item) =>
    `${item.name} ${item.address} ${item.type}`.toLowerCase().includes(query.toLowerCase()),
  );
  const fields = [
    { name: 'name', label: 'Property name', required: true },
    { name: 'type', label: 'Property type', type: 'select', options: ['apartment', 'house', 'condo', 'townhouse', 'boarding_house', 'commercial', 'other'], required: true },
    { name: 'address', label: 'Address', type: 'textarea', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Properties" subtitle="Manage portfolios, units, and property health across your asset base." action={<button className="primary-btn" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add property</button>} />
      <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search properties" />
      <div className="grid gap-4 xl:grid-cols-3">
        {visibleProperties.map((property) => (
          <div key={property.id} className="panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{property.type}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{property.name}</h3>
              </div>
              <StatusBadge label={property.status === 'active' ? 'Active' : property.status === 'archived' ? 'Archived' : 'Inactive'} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{property.address}</p>
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
              <span>Rental units</span>
              <span className="font-semibold text-slate-900">{data.units.filter((unit) => String(unit.propertyId) === String(property.id) || unit.property === property.name).length}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="secondary-btn" onClick={() => { setEditing(property); setDialogOpen(true); }}>Edit</button>
              <button className="secondary-btn" onClick={async () => {
                if (property.status !== 'archived' && !window.confirm(`Archive ${property.name}?`)) return;
                try {
                  await api.put(`/properties/${property.id}`, { property_status: property.status === 'archived' ? 'active' : 'archived' });
                  refresh();
                } catch (error) {
                  window.alert(error.message);
                }
              }}>{property.status === 'archived' ? 'Restore' : 'Archive'}</button>
            </div>
          </div>
        ))}
      </div>
      {visibleProperties.length === 0 && <EmptyState title="No properties found" description="Try another search or add your first property." />}
      <FormDialog
        open={dialogOpen}
        title={editing ? 'Edit property' : 'Add property'}
        fields={fields}
        initialValues={editing || { name: '', type: 'apartment', address: '', description: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (values) => {
          const payload = {
            property_name: values.name,
            property_type: values.type,
            address: values.address,
            description: values.description,
          };
          if (editing) await api.put(`/properties/${editing.id}`, payload);
          else await api.post('/properties', payload);
          refresh();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function RentalUnitsPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const visibleUnits = data.units.filter((item) =>
    `${item.id} ${item.unitNumber} ${item.property} ${item.propertyId}`.toLowerCase().includes(query.toLowerCase()),
  );
  const fields = [
    { name: 'unitNumber', label: 'Unit number', required: true },
    { name: 'propertyId', label: 'Property', type: 'select', options: data.properties.map((item) => ({ value: item.id, label: item.name })), required: true },
    { name: 'unitType', label: 'Unit type' },
    { name: 'bedrooms', label: 'Bedrooms', type: 'number', min: 0, required: true },
    { name: 'bathrooms', label: 'Bathrooms', type: 'number', min: 0, required: true },
    { name: 'rent', label: 'Monthly rent', type: 'number', min: 1, required: true },
    { name: 'deposit', label: 'Security deposit', type: 'number', min: 0, required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'imageFiles', label: 'Add photos (up to 8, 5 MB each, 30 MB total)', type: 'file', multiple: true, accept: 'image/jpeg,image/png,image/webp' },
    { name: 'status', label: 'Status', type: 'select', options: ['vacant', 'reserved', 'occupied', 'maintenance', 'inactive'], required: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Rental units" subtitle="Track occupancy, upcoming leases, and unit details by property." action={<button className="primary-btn" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add unit</button>} />
      <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search units and properties" />
      <div className="grid gap-4 xl:grid-cols-3">
        {visibleUnits.map((unit) => (
          <div key={unit.id} className="panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{unit.property || data.properties.find((item) => item.id === unit.propertyId)?.name}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{unit.unitNumber || unit.id}</h3>
              </div>
              <StatusBadge label={unit.status === 'vacant' ? 'Available' : unit.status.charAt(0).toUpperCase() + unit.status.slice(1)} />
            </div>
            {unit.images?.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {unit.images.map((image) => <img key={image.image_id} src={image.image_url} alt={`${unit.unitNumber} rental unit`} className="h-24 w-full rounded-lg object-cover" />)}
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div><span className="block text-slate-400">Type</span><span className="font-medium text-slate-900">{unit.unitType || unit.type || '—'}</span></div>
              <div><span className="block text-slate-400">Rent</span><span className="font-medium text-slate-900">${unit.rent}</span></div>
              <div><span className="block text-slate-400">Bedrooms</span><span className="font-medium text-slate-900">{unit.bedrooms}</span></div>
              <div><span className="block text-slate-400">Bathrooms</span><span className="font-medium text-slate-900">{unit.bathrooms}</span></div>
            </div>
            {unit.description && <p className="mt-4 text-sm leading-6 text-slate-600">{unit.description}</p>}
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Current lease</p>
              <p className="mt-1">{unit.lease || (unit.status === 'vacant' ? 'Available now' : 'See lease records')}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="secondary-btn" onClick={() => { setEditing(unit); setDialogOpen(true); }}>Edit</button>
              <button className="secondary-btn" onClick={async () => {
                if (unit.status !== 'inactive' && !window.confirm(`Deactivate unit ${unit.unitNumber || unit.id}?`)) return;
                try {
                  await api.put(`/units/${unit.id}`, { unit_status: unit.status === 'inactive' ? 'vacant' : 'inactive' });
                  refresh();
                } catch (error) {
                  window.alert(error.message);
                }
              }}>{unit.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>
            </div>
          </div>
        ))}
      </div>
      {visibleUnits.length === 0 && <EmptyState title="No units found" description="Adjust the search or add a rental unit." />}
      <FormDialog
        open={dialogOpen}
        title={editing ? 'Edit rental unit' : 'Add rental unit'}
        fields={fields}
        initialValues={editing ? { ...editing, imageFiles: [] } : { unitNumber: '', propertyId: data.properties[0]?.id || '', unitType: '', bedrooms: 0, bathrooms: 1, rent: '', deposit: 0, description: '', imageFiles: [], status: 'vacant' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (values) => {
          const payload = {
            property_id: Number(values.propertyId),
            unit_number: values.unitNumber,
            unit_type: values.unitType,
            bedroom_count: Number(values.bedrooms),
            bathroom_count: Number(values.bathrooms),
            monthly_rent: Number(values.rent),
            security_deposit: Number(values.deposit),
            unit_status: values.status,
            description: values.description,
          };
          if (values.imageFiles.length > 8) throw new Error('You can upload at most 8 images per save.');
          if (values.imageFiles.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
            || values.imageFiles.reduce((total, file) => total + file.size, 0) > 30 * 1024 * 1024) {
            throw new Error('Choose JPEG, PNG, or WebP images no larger than 5 MB each or 30 MB total.');
          }
          const response = editing
            ? await api.put(`/units/${editing.id}`, payload)
            : await api.post('/units', payload);
          const unitId = editing ? editing.id : response.data.unit_id;
          if (values.imageFiles.length) {
            const formData = new FormData();
            values.imageFiles.forEach((file) => formData.append('images[]', file));
            try {
              await api.post(`/units/${unitId}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } catch (uploadError) {
              refresh();
              setDialogOpen(false);
              window.alert(`Unit details were saved, but the photos were not uploaded: ${uploadError.message} Edit the unit to try again.`);
              return;
            }
          }
          refresh();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function ApplicationsPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const applications = data.applications.filter((item) => {
    const matchesQuery = `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status.toLowerCase().replaceAll(' ', '_') === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const changeStatus = async (application, status) => {
    try {
      await api.patch(`/applications/${application.id}/status`, { status: status.toLowerCase().replaceAll(' ', '_') });
      refresh();
    } catch (error) {
      window.alert(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" subtitle="Track submissions, screenings, and application status by applicant." />
      <div className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="field !rounded-lg pl-9" placeholder="Search applicant" />
            </div>
            <select className="field md:max-w-52" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{app.name}</p>
                      <p className="text-xs text-slate-500">{app.id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{app.date}</td>
                  <td className="px-4 py-3"><StatusBadge label={app.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{app.reviewedBy ? <><span>{app.reviewedBy}</span><span className="block text-xs text-slate-400">{app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : ''}</span></> : 'Not reviewed'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-sm font-medium text-emerald-700" onClick={async () => {
                        try {
                          const response = await api.get(`/applications/${app.id}/documents`);
                          const documents = response.data.map((item) => ({
                            ...item,
                            id: item.document_id,
                            name: item.file_path,
                            type: item.document_type,
                            status: item.verification_status,
                          }));
                          setSelected({ ...app, documents });
                        } catch (error) {
                          window.alert(error.message);
                        }
                      }}>Details</button>
                      {['Submitted', 'Under Review'].includes(app.status) && <button className="text-sm font-medium text-sky-700" onClick={() => changeStatus(app, 'Under Review')}>Start review</button>}
                      {app.status === 'Under Review' && <button className="text-sm font-medium text-emerald-700" onClick={() => changeStatus(app, 'Approved')}>Approve</button>}
                      {!['Approved', 'Rejected', 'Withdrawn'].includes(app.status) && <button className="text-sm font-medium text-rose-700" onClick={() => changeStatus(app, 'Rejected')}>Reject</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {applications.length === 0 && <EmptyState title="No applications match" description="Try another name or status filter." />}
      {selected && <DetailsDialog title={`Application ${selected.id}`} onClose={() => setSelected(null)}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailItem label="Applicant" value={selected.name} />
          <DetailItem label="Status" value={selected.status} />
          <DetailItem label="Desired move-in" value={selected.desiredMoveInDate || 'Not provided'} />
          <DetailItem label="Employment status" value={selected.employmentStatus || 'Not provided'} />
          <DetailItem label="Monthly income" value={selected.monthlyIncome ? `$${selected.monthlyIncome}` : 'Not provided'} />
          <DetailItem label="Reviewed at" value={selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString() : 'Not reviewed'} />
          <div className="sm:col-span-2"><DetailItem label="Notes" value={selected.additionalNotes || 'No notes provided'} /></div>
          <div className="sm:col-span-2">
            <p className="mb-2 font-semibold text-slate-800">Documents</p>
            {selected.documents?.length ? selected.documents.map((document) => (
              <div key={document.name || document.path} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2">
                <span className="text-slate-600">{document.name || document.path} · {document.type || 'other'}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge label={document.status === 'verified' ? 'Successful' : document.status === 'rejected' ? 'Rejected' : 'Pending'} />
                  {document.status !== 'verified' && <button className="text-xs font-medium text-emerald-700" onClick={async () => {
                    try {
                  await api.patch(`/documents/${document.id}/verification`, { verification_status: 'verified' });
                  const documents = selected.documents.map((item) => item.id === document.id ? { ...item, status: 'verified' } : item);
                  setSelected({ ...selected, documents });
                    } catch (error) {
                  window.alert(error.message);
                    }
                  }}>Verify</button>}
                  {document.status !== 'rejected' && <button className="text-xs font-medium text-rose-700" onClick={async () => {
                    try {
                  await api.patch(`/documents/${document.id}/verification`, { verification_status: 'rejected' });
                  const documents = selected.documents.map((item) => item.id === document.id ? { ...item, status: 'rejected' } : item);
                  setSelected({ ...selected, documents });
                    } catch (error) {
                  window.alert(error.message);
                    }
                  }}>Reject</button>}
                </div>
              </div>
            )) : <p className="text-slate-500">No documents uploaded.</p>}
          </div>
        </dl>
      </DetailsDialog>}
    </div>
  );
}

function ScreeningPage() {
  const { data, refresh } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState(null);
  const activeApplications = data.applications.filter((application) => ['Submitted', 'Under Review'].includes(application.status));
  const fields = [
    { name: 'name', label: 'Criterion name', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
  const evaluationFields = [
    { name: 'applicationId', label: 'Applicant', type: 'select', options: activeApplications.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` })), required: true },
    { name: 'result', label: 'Evaluation result', type: 'select', options: ['passed', 'failed', 'not_applicable'], required: true },
    { name: 'remarks', label: 'Reviewer remarks', type: 'textarea' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Screening criteria" subtitle="Manage evaluation standards and review applicant compliance." action={<button className="primary-btn" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add criterion</button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.criteria.map((criterion) => (
          <div key={criterion.id} className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{criterion.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{criterion.description}</p>
              </div>
              <button onClick={async () => {
                try {
                  await api.put(`/screening-criteria/${criterion.id}`, { is_active: !criterion.active });
                  refresh();
                } catch (error) {
                  window.alert(error.message);
                }
              }} className={`status-badge ${criterion.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                {criterion.active ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
              <span>Evaluation data</span>
              <span className="font-semibold text-slate-900">Available per application</span>
            </div>
            <button className="primary-btn mt-5 w-full" disabled={!criterion.active || !activeApplications.length} onClick={() => setSelectedCriterion(criterion)}>Evaluate applicants</button>
          </div>
        ))}
      </div>
      {data.screenings.length > 0 && <div className="panel p-5">
        <h3 className="text-lg font-semibold text-slate-900">Recent screening results</h3>
        <div className="mt-4 divide-y divide-slate-200">
          {data.screenings.map((screening) => <div key={screening.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
            <div><p className="font-medium text-slate-900">{screening.applicantName} — {screening.criterionName}</p><p className="text-sm text-slate-500">{screening.remarks || 'No remarks'} · {new Date(screening.date).toLocaleString()}</p></div>
            <StatusBadge label={screening.result.replace('_', ' ')} />
          </div>)}
        </div>
      </div>}
      <FormDialog
        open={dialogOpen}
        title="Add screening criterion"
        fields={fields}
        initialValues={{ name: '', description: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (values) => {
          await api.post('/screening-criteria', {
            criteria_name: values.name,
            description: values.description,
            is_active: true,
          });
          refresh();
          setDialogOpen(false);
        }}
      />
      <FormDialog open={Boolean(selectedCriterion)} title={`Evaluate: ${selectedCriterion?.name || ''}`} fields={evaluationFields} initialValues={{ applicationId: activeApplications[0]?.id || '', result: 'passed', remarks: '' }} onClose={() => setSelectedCriterion(null)} onSubmit={async (values) => {
        const screeningResponse = await api.post(`/applications/${values.applicationId}/screenings`, { remarks: values.remarks });
        await api.post(`/screenings/${screeningResponse.data.screening_id}/results`, {
          criteria_id: selectedCriterion.id,
          result_status: values.result,
          remarks: values.remarks,
        });
        refresh();
        setSelectedCriterion(null);
      }} />
    </div>
  );
}

function LeasesPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const eligibleApplications = data.applications.filter((item) => item.status === 'Approved' && !data.leases.some((lease) => lease.applicationId === item.id));
  const fields = [
    { name: 'applicationId', label: 'Approved application', type: 'select', options: eligibleApplications.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` })), required: true },
    { name: 'unitId', label: 'Vacant unit', type: 'select', options: data.units.filter((item) => ['vacant', 'Available'].includes(item.status)).map((item) => ({ value: item.id, label: `${item.unitNumber || item.id} — ${item.property || item.propertyId}` })), required: true },
    { name: 'start', label: 'Lease start', type: 'date', required: true },
    { name: 'end', label: 'Lease end', type: 'date', required: true },
    { name: 'rent', label: 'Monthly rent', type: 'number', min: 1, required: true },
    { name: 'securityDeposit', label: 'Security deposit', type: 'number', min: 0, required: true },
    { name: 'advancePayment', label: 'Advance payment', type: 'number', min: 0 },
    { name: 'paymentDueDay', label: 'Payment due day (1–28)', type: 'number', min: 1, max: 28, required: true },
  ];
  const createLease = async (values) => {
    const applicant = data.applications.find((item) => item.id === values.applicationId);
    const conflict = data.leases.some((lease) => lease.unitId === values.unitId && ['Active', 'Pending'].includes(lease.status)
      && values.start <= lease.end && values.end >= lease.start);
    if (!applicant || applicant.status !== 'Approved') {
      throw new Error('Only approved applications can be converted into a lease.');
    }
    if (new Date(values.end) <= new Date(values.start)) {
      throw new Error('The lease end date must be after its start date.');
    }
    if (conflict) {
      throw new Error('This unit already has a pending or active lease with overlapping dates.');
    }
    await api.post('/leases', {
      application_id: Number(values.applicationId),
      unit_id: Number(values.unitId),
      lease_start_date: values.start,
      lease_end_date: values.end,
      monthly_rent: Number(values.rent),
      security_deposit: Number(values.securityDeposit),
      advance_payment: Number(values.advancePayment || 0),
      payment_due_day: Number(values.paymentDueDay),
    });
    refresh();
    setDialogOpen(false);
    setError('');
  };
  const visibleLeases = data.leases.filter((lease) =>
    (statusFilter === 'all' || lease.status.toLowerCase() === statusFilter)
    && `${lease.id} ${lease.tenant} ${lease.unit}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Leases" subtitle="Create, review, and manage active, pending, and ended rental agreements." action={<button className="primary-btn" disabled={!eligibleApplications.length} onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New lease</button>} />
      {!eligibleApplications.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">A lease can be created only after an application is approved and an unassigned unit is available.</div>}
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search leases, tenants, or units" />
        <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All lease statuses</option>{['pending', 'active', 'ended', 'terminated', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {visibleLeases.map((lease) => (
          <div key={lease.id} className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lease</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{lease.id}</h3>
              </div>
              <StatusBadge label={lease.status} />
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p><span className="text-slate-400">Tenant</span> <span className="font-medium text-slate-900">{lease.tenant}</span></p>
              <p><span className="text-slate-400">Unit</span> <span className="font-medium text-slate-900">{lease.unit}</span></p>
              <p><span className="text-slate-400">Dates</span> <span className="font-medium text-slate-900">{lease.start} to {lease.end}</span></p>
              <p><span className="text-slate-400">Rent</span> <span className="font-medium text-slate-900">${lease.rent}</span></p>
              <p><span className="text-slate-400">Deposit</span> <span className="font-medium text-slate-900">${lease.securityDeposit || 0}</span></p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {lease.status === 'Pending' && <button className="primary-btn" onClick={async () => {
                try {
                  await api.put(`/leases/${lease.id}`, { lease_status: 'active' });
                  refresh();
                } catch (error) {
                  window.alert(error.message);
                }
              }}>Activate lease</button>}
              {lease.status === 'Active' && <button className="secondary-btn" onClick={async () => {
                if (!window.confirm(`End the lease for ${lease.tenant}?`)) return;
                try {
                  await api.put(`/leases/${lease.id}`, { lease_status: 'ended' });
                  refresh();
                } catch (error) {
                  window.alert(error.message);
                }
              }}>End lease</button>}
            </div>
          </div>
        ))}
      </div>
      <FormDialog open={dialogOpen} title="Create lease" fields={fields} initialValues={{ applicationId: eligibleApplications[0]?.id || '', coTenantIds: [], unitId: '', start: '', end: '', rent: '', securityDeposit: 0, advancePayment: 0, paymentDueDay: 1 }} onClose={() => setDialogOpen(false)} onSubmit={createLease} />
    </div>
  );
}

function InvoicesPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const fields = [
    { name: 'leaseId', label: 'Lease', type: 'select', options: data.leases.filter((item) => item.status === 'Active').map((item) => ({ value: item.id, label: `${item.id} — ${item.tenant}` })), required: true },
    { name: 'periodStart', label: 'Billing period start', type: 'date', required: true },
    { name: 'periodEnd', label: 'Billing period end', type: 'date', required: true },
    { name: 'issueDate', label: 'Issue date', type: 'date', required: true },
    { name: 'dueDate', label: 'Due date', type: 'date', required: true },
    { name: 'amount', label: 'Total amount', type: 'number', min: 0, required: true },
  ];
  const visibleInvoices = data.invoices.filter((invoice) =>
    (statusFilter === 'all' || invoice.status === statusFilter)
    && `${invoice.id || invoice.number} ${invoice.tenant} ${invoice.period}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices & payments" subtitle="Review invoice status, outstanding balances, and successful payment verification." action={<button className="primary-btn" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Generate invoice</button>} />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search invoices and tenants" />
        <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All invoice statuses</option>{['unpaid', 'partially_paid', 'paid', 'overdue', 'void'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Billing period</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((invoice) => (
                <tr key={invoice.id || invoice.number} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{invoice.id || invoice.number}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.tenant}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.period}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.dueDate}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">${invoice.amount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge label={invoice.status === 'partially_paid' ? 'Partial' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)} />
                      {invoice.status !== 'paid' && invoice.status !== 'void' && <button className="text-sm font-medium text-rose-700" onClick={async () => {
                        if (!window.confirm(`Void invoice ${invoice.id || invoice.number}?`)) return;
                        try {
                          await api.patch(`/invoices/${invoice.id}/status`, { status: 'void' });
                          refresh();
                        } catch (error) {
                          window.alert(error.message);
                        }
                      }}>Void</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel p-5">
        <h3 className="text-lg font-semibold text-slate-900">Payment attempts and verified receipts</h3>
        <p className="mt-1 text-sm text-slate-600">An attempt is not a payment. Receipts appear only after server-side gateway verification.</p>
        {data.paymentAttempts.length ? (
          <div className="mt-4 divide-y divide-slate-200">
            {data.paymentAttempts.map((attempt) => (
              <div key={attempt.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                <div><p className="font-medium text-slate-900">{attempt.id} · Invoice {attempt.invoiceId}</p><p className="text-sm text-slate-500">{attempt.paymentMethod?.replace('_', ' ') || 'Payment method'} · {new Date(attempt.initiatedAt).toLocaleString()}</p></div>
                <div className="flex items-center gap-3"><span className="font-semibold text-slate-900">${Number(attempt.amount).toLocaleString()}</span><StatusBadge label={humanizeStatus(attempt.status)} /></div>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">No payment attempts recorded.</p>}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h4 className="font-medium text-slate-900">Verified receipts</h4>
          {data.paymentHistory.filter((item) => item.status === 'completed' && item.receiptNumber).length
            ? data.paymentHistory.filter((item) => item.status === 'completed' && item.receiptNumber).map((item) => <p key={item.id} className="mt-2 text-sm text-slate-600">{item.receiptNumber} · {item.amount}</p>)
            : <p className="mt-1 text-sm text-slate-500">No server-verified receipts are available.</p>}
        </div>
      </div>
      <FormDialog open={dialogOpen} title="Generate rent invoice" fields={fields} initialValues={{ leaseId: data.leases.find((item) => item.status === 'Active')?.id || '', periodStart: '', periodEnd: '', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', amount: '' }} onClose={() => setDialogOpen(false)} onSubmit={async (values) => {
        const duplicate = data.invoices.some((invoice) => invoice.leaseId === values.leaseId && invoice.periodStart === values.periodStart && invoice.status !== 'void');
        if (new Date(values.periodEnd) < new Date(values.periodStart)) {
          throw new Error('Billing period end must be on or after its start date.');
        }
        if (new Date(values.dueDate) < new Date(values.issueDate)) {
          throw new Error('Due date must be on or after the issue date.');
        }
        if (duplicate) {
          throw new Error('An invoice already exists for this lease and billing period.');
        }
        await api.post('/invoices', {
          lease_id: Number(values.leaseId),
          invoice_number: makeId('INV'),
          billing_period_start: values.periodStart,
          billing_period_end: values.periodEnd,
          issue_date: values.issueDate,
          due_date: values.dueDate,
          total_amount: Number(values.amount),
        });
        refresh();
        setDialogOpen(false);
      }} />
    </div>
  );
}

function ExpensesPage() {
  const { data, refresh } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const fields = [
    { name: 'propertyId', label: 'Property', type: 'select', options: data.properties.map((item) => ({ value: item.id, label: item.name })), required: true },
    { name: 'category', label: 'Category', type: 'select', options: ['maintenance', 'repairs', 'utilities', 'taxes', 'insurance', 'management', 'supplies', 'other'], required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'amount', label: 'Amount', type: 'number', min: 0.01, required: true },
    { name: 'date', label: 'Expense date', type: 'date', required: true },
  ];
  const visibleExpenses = data.expenses.filter((item) =>
    (category === 'all' || item.category.toLowerCase() === category)
    && (propertyFilter === 'all' || item.property === propertyFilter)
    && (!fromDate || item.date >= fromDate)
    && (!toDate || item.date <= toDate),
  );
  const total = visibleExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" subtitle="Track operating costs, categories, and property-level spending summaries." action={<button className="primary-btn" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Record expense</button>} />
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Filtered total" value={`$${total.toLocaleString()}`} delta={`${visibleExpenses.length} expense records`} tone="emerald" />
        <SummaryCard label="Categories" value={new Set(visibleExpenses.map((item) => item.category)).size} delta="In current filter" tone="sky" />
        <SummaryCard label="Records" value={visibleExpenses.length} delta="Use category filter below" tone="amber" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <select className="field" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}>
          <option value="all">All properties</option>
          {data.properties.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {['maintenance', 'repairs', 'utilities', 'taxes', 'insurance', 'management', 'supplies', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <div><label className="label">From</label><input className="field" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
        <div><label className="label">To</label><input className="field" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Expense ID</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.map((expense) => (
                <tr key={expense.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{expense.id}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.category}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.property}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">${expense.amount}</td>
                  <td className="px-4 py-3"><button className="text-sm font-medium text-rose-700" onClick={async () => {
                    if (!window.confirm(`Remove expense ${expense.id}?`)) return;
                    try {
                      await api.delete(`/expenses/${expense.id}`);
                      refresh();
                    } catch (error) {
                      window.alert(error.message);
                    }
                  }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <FormDialog open={dialogOpen} title="Record property expense" fields={fields} initialValues={{ propertyId: data.properties[0]?.id || '', category: 'maintenance', description: '', amount: '', date: new Date().toISOString().slice(0, 10) }} onClose={() => setDialogOpen(false)} onSubmit={async (values) => {
        await api.post('/expenses', {
          property_id: Number(values.propertyId),
          expense_category: values.category,
          description: values.description,
          amount: Number(values.amount),
          expense_date: values.date,
        });
        refresh();
        setDialogOpen(false);
      }} />
    </div>
  );
}

function MaintenancePage() {
  const { data, refresh } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const requests = data.maintenance.filter((item) =>
    (statusFilter === 'all' || item.requestStatus === statusFilter)
    && (priorityFilter === 'all' || item.priority === priorityFilter),
  );
  const nextStatus = { open: 'in_progress', in_progress: 'completed', completed: 'completed', cancelled: 'open' };
  const setMaintenanceStatus = async (request, requestStatus) => {
    try {
      await api.patch(`/maintenance/${request.id}/status`, { status: requestStatus });
      refresh();
    } catch (error) {
      window.alert(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" subtitle="Respond to priority requests, schedule work, and document completion." />
      <div className="grid gap-3 sm:grid-cols-2">
        <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="field" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="all">All priorities</option>
          {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{request.id}</p>
                      <p className="text-xs text-slate-500">{request.unit}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{request.name}</td>
                  <td className="px-4 py-3"><StatusBadge label={request.priority.charAt(0).toUpperCase() + request.priority.slice(1)} /></td>
                  <td className="px-4 py-3"><StatusBadge label={request.requestStatus === 'in_progress' ? 'In Progress' : request.requestStatus.charAt(0).toUpperCase() + request.requestStatus.slice(1)} /></td>
                  <td className="px-4 py-3">
                    {request.requestStatus !== 'completed' && request.requestStatus !== 'cancelled' && <button className="text-sm font-medium text-emerald-700" onClick={() => setMaintenanceStatus(request, nextStatus[request.requestStatus])}>{request.requestStatus === 'open' ? 'Start work' : 'Complete'}</button>}
                    {request.requestStatus === 'cancelled' && <button className="text-sm font-medium text-sky-700" onClick={() => setMaintenanceStatus(request, 'open')}>Reopen</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NotificationsPage() {
  const { data, refresh } = useWorkspace();
  const unreadCount = data.notifications.filter((item) => !item.read).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}; review lease reminders, payment alerts, and updates.`} />
      <div className="panel overflow-hidden">
        <div className="divide-y divide-slate-200">
          {data.notifications.map((item) => (
            <div key={item.id} className={`flex items-start justify-between gap-4 px-5 py-4 ${item.read ? 'bg-white' : 'bg-emerald-50/40'}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.read ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{item.time}</span>
                {!item.read && <button onClick={async () => {
                  try {
                    await api.patch(`/notifications/${item.id}/read`);
                    refresh();
                  } catch (error) {
                    window.alert(error.message);
                  }
                }} className="font-medium text-emerald-700">Mark read</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityLogPage() {
  const { data } = useWorkspace();
  const [entityFilter, setEntityFilter] = useState('all');
  const visibleEvents = data.auditLog.filter((event) => entityFilter === 'all' || event.entityName === entityFilter);
  const entities = [...new Set(data.auditLog.map((event) => event.entityName))];

  return (
    <div className="space-y-6">
      <PageHeader title="Activity log" subtitle="Review changes recorded by the backend." />
      <select className="field max-w-sm" value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
        <option value="all">All entities</option>
        {entities.map((entity) => <option key={entity} value={entity}>{entity.replaceAll(/([A-Z])/g, ' $1')}</option>)}
      </select>
      {visibleEvents.length ? (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Details</th></tr></thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id} className="border-t border-slate-200">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(event.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge label={event.action} /></td>
                    <td className="px-4 py-3 text-slate-700">{event.entityName}</td>
                    <td className="px-4 py-3 text-slate-600">{event.recordId || '—'}</td>
                    <td className="px-4 py-3">
                      <details><summary className="cursor-pointer font-medium text-emerald-700">View payload</summary><pre className="mt-2 max-w-md overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{JSON.stringify({ oldValues: event.oldValues, newValues: event.newValues }, null, 2)}</pre></details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <EmptyState title="No activity yet" description="No backend audit records are available." />}
    </div>
  );
}

function SettingsPage() {
  const { data, setData, refresh } = useWorkspace();
  const [profile, setProfile] = useState(data.landlordProfile);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  useEffect(() => setProfile(data.landlordProfile), [data.landlordProfile]);

  const saveProfile = async () => {
    setSaveError('');
    setSaved(false);
    try {
      const response = await api.patch('/profile', {
        name: profile.name,
        phone: profile.phone,
        business_name: profile.businessName,
      });
      const user = response.data.user;
      setData((current) => ({
        ...current,
        landlordProfile: {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          businessName: user.business_name || '',
        },
      }));
      refresh();
      setSaved(true);
    } catch (error) {
      setSaveError(error.message || 'Unable to save profile.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" subtitle="Update your profile, security details, and account status." />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Profile details</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div><label className="label">Full name</label><input className="field" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></div>
            <div><label className="label">Phone</label><input className="field" value={profile.phone || ''} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div className="md:col-span-2"><label className="label">Email</label><input type="email" className="field" value={profile.email} readOnly /></div>
            <div className="md:col-span-2"><label className="label">Business name</label><input className="field" value={profile.businessName} onChange={(event) => setProfile((current) => ({ ...current, businessName: event.target.value }))} /></div>
          </div>
          <button className="primary-btn mt-5" onClick={saveProfile}>Save changes</button>
          {saved && <p role="status" className="mt-3 text-sm text-emerald-700">Profile updated.</p>}
          {saveError && <p role="alert" className="mt-3 text-sm text-rose-700">{saveError}</p>}
        </div>

        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Security</h3>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-900">Password</p>
              <p className="mt-1">Change through the backend authentication flow.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-900">Account status</p>
              <p className="mt-1 text-emerald-700">Active</p>
            </div>
            <button className="secondary-btn w-full" onClick={() => setPasswordDialogOpen(true)}>Change password</button>
          </div>
        </div>
      </div>
      <FormDialog open={passwordDialogOpen} title="Change password" fields={[
        { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
        { name: 'newPassword', label: 'New password', type: 'password', minLength: 8, required: true },
      ]} initialValues={{ currentPassword: '', newPassword: '' }} onClose={() => setPasswordDialogOpen(false)} onSubmit={async (values) => {
        await changePassword(values);
        setPasswordDialogOpen(false);
      }} />
    </div>
  );
}

function TenantDashboardPage() {
  const { data } = useWorkspace();
  const { user } = useAuth();
  const accountName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || data.profile.name;
  const outstanding = data.tenantInvoices.filter((invoice) => ['unpaid', 'partially_paid', 'overdue'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${accountName.split(' ')[0]}`} subtitle="Here’s your current rental status, upcoming balance, and recent activity." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Current property" value={data.profile.property} delta={`Unit ${data.profile.unit}`} tone="emerald" />
        <SummaryCard label="Lease status" value={data.profile.leaseStatus} delta="Current lease" tone="sky" />
        <SummaryCard label="Monthly rent" value={data.profile.rent} delta={`Due ${data.profile.dueDate}`} tone="violet" />
        <SummaryCard label="Outstanding balance" value={`$${outstanding.toLocaleString()}`} delta={`${data.tenantInvoices.filter((invoice) => ['unpaid', 'partially_paid', 'overdue'].includes(invoice.status)).length} invoices outstanding`} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Recent payments</h3>
          <div className="mt-4 space-y-3">
            {data.paymentHistory.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="font-medium text-slate-900">{item.id}</p>
                  <p className="text-xs text-slate-500">{item.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{item.amount}</p>
                  <StatusBadge label={item.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Maintenance status</h3>
          <div className="mt-4 space-y-3">
            {data.tenantMaintenance.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <StatusBadge label={item.priority} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>{item.date}</span>
                  <span className="font-medium text-slate-800">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantRentalsPage() {
  const { data } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader title="Available rentals" subtitle="Browse vacant units, photos, and details from participating landlords." />
      {data.units.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.units.map((unit) => (
            <article key={unit.id} className="panel overflow-hidden">
              {unit.images?.length ? (
                <div className="grid grid-cols-2 gap-1">
                  {unit.images.map((image) => <img key={image.image_id} src={image.image_url} alt={`${unit.property} unit ${unit.unitNumber}`} className="h-40 w-full object-cover" />)}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-slate-100 text-sm text-slate-500">No photos available</div>
              )}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">{unit.property}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Unit {unit.unitNumber}</h2>
                {unit.address && <p className="mt-1 text-sm text-slate-500">{unit.address}</p>}
                <p className="mt-3 text-2xl font-bold text-slate-900">${unit.rent.toLocaleString()}<span className="text-sm font-normal text-slate-500"> / month</span></p>
                <div className="mt-3 flex gap-4 text-sm text-slate-600">
                  <span>{unit.bedrooms} bed</span><span>{unit.bathrooms} bath</span>
                  {unit.unitType && <span>{unit.unitType}</span>}
                </div>
                {unit.description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{unit.description}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No available rentals" description="There are no vacant units listed right now. Check back later." />}
    </div>
  );
}

function TenantApplicationsPage() {
  const { data, refresh } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const fields = [
    { name: 'landlordId', label: 'Landlord', type: 'select', options: data.landlords.map((item) => ({ value: item.id, label: item.label })), required: true },
    { name: 'desiredMoveInDate', label: 'Desired move-in date', type: 'date', required: true },
    { name: 'employmentStatus', label: 'Employment status', type: 'select', options: ['full_time', 'part_time', 'contract', 'self_employed', 'unemployed', 'other'], required: true },
    { name: 'monthlyIncome', label: 'Monthly income', type: 'number', min: 0 },
    { name: 'additionalNotes', label: 'Additional notes', type: 'textarea' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Rental application" subtitle="Submit a rental application to a landlord and track its status." action={<button className="primary-btn" disabled={!data.landlords.length} onClick={() => { setMessage(''); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New application</button>} />
      {!data.landlords.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No landlords are available to apply to yet.</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Application</th><th className="px-4 py-3">Move-in</th><th className="px-4 py-3">Employment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Screening</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>
              {data.applicationsForTenant.length ? data.applicationsForTenant.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.id}</td>
                  <td className="px-4 py-3 text-slate-600">{item.desiredMoveInDate}</td>
                  <td className="px-4 py-3 text-slate-600">{item.employmentStatus}</td>
                  <td className="px-4 py-3"><StatusBadge label={humanizeStatus(item.status)} /></td>
                  <td className="px-4 py-3 text-slate-600">{item.screeningStatus || 'Not started'}</td>
                  <td className="px-4 py-3">{item.status === 'submitted' && <button className="text-sm font-medium text-rose-700" onClick={async () => {
                    if (!window.confirm('Withdraw this application?')) return;
                    try {
                      await api.patch(`/applications/${item.id}/status`, { status: 'withdrawn' });
                      refresh();
                    } catch (error) {
                      window.alert(error.message);
                    }
                  }}>Withdraw</button>}</td>
                </tr>
              )) : <tr><td className="px-4 py-7 text-center text-slate-500" colSpan={6}>No applications yet. Submit a general application to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <FormDialog open={dialogOpen} title="Submit rental application" fields={fields} initialValues={{ landlordId: data.landlords[0]?.id || '', desiredMoveInDate: '', employmentStatus: 'full_time', monthlyIncome: '', additionalNotes: '' }} onClose={() => setDialogOpen(false)} onSubmit={async (values) => {
        await api.post('/applications', {
          landlord_id: Number(values.landlordId),
          desired_move_in_date: values.desiredMoveInDate,
          employment_status: values.employmentStatus,
          monthly_income: Number(values.monthlyIncome || 0),
          additional_notes: values.additionalNotes,
        });
        refresh();
        setDialogOpen(false);
        setMessage('Application submitted to the backend.');
      }} />
    </div>
  );
}

function TenantLeasePage() {
  const { data } = useWorkspace();
  const lease = data.leases.find((item) => item.tenant === data.profile.name && item.status === 'Active');
  const unit = data.units.find((item) => item.id === lease?.unitId);
  const propertyName = unit?.property || data.properties.find((item) => String(item.id) === String(unit?.propertyId))?.name || data.profile.property;

  return (
    <div className="space-y-6">
      <PageHeader title="My lease" subtitle="Review lease details, assigned unit, and authorized documents." />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Lease summary</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between py-2 border-b border-slate-200"><span>Property</span><span className="font-medium text-slate-900">{propertyName}</span></div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200"><span>Unit</span><span className="font-medium text-slate-900">{unit?.unitNumber || data.profile.unit}</span></div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200"><span>Lease dates</span><span className="font-medium text-slate-900">{lease ? `${lease.start} - ${lease.end}` : 'No active lease found'}</span></div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200"><span>Monthly rent</span><span className="font-medium text-slate-900">{lease ? `$${lease.rent}` : data.profile.rent}</span></div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200"><span>Security deposit</span><span className="font-medium text-slate-900">${lease?.securityDeposit ?? 0}</span></div>
            <div className="flex items-center justify-between py-2"><span>Payment due day</span><span className="font-medium text-slate-900">{lease?.paymentDueDay ?? '—'}</span></div>
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Co-tenants</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-900">{data.profile.name}</p>
              <p className="text-sm text-slate-500">Primary tenant</p>
            </div>
            {lease?.coTenants?.length ? lease.coTenants.map((coTenant) => <div key={coTenant.tenantId} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="font-medium text-slate-900">{coTenant.name}</p><p className="text-sm text-slate-500">Co-tenant</p></div>) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="font-medium text-slate-900">—</p><p className="text-sm text-slate-500">No co-tenants added</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantInvoicesPage() {
  const { data } = useWorkspace();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader title="Rent & invoices" subtitle="View due dates, outstanding balances, and payment statuses for your current lease." />
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Billing period</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.tenantInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{invoice.id}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.billingPeriod}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.dueDate}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">${invoice.amount}</td>
                  <td className="px-4 py-3"><StatusBadge label={invoice.status === 'partially_paid' ? 'Partial' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)} /></td>
                  <td className="px-4 py-3">{['unpaid', 'partially_paid', 'overdue'].includes(invoice.status) && <button className="text-sm font-medium text-emerald-700" onClick={() => navigate('/tenant/payments')}>Pay now</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TenantPaymentsPage() {
  const { data, refresh } = useWorkspace();
  const [selectedMethod, setSelectedMethod] = useState('bank_transfer');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const unpaidInvoice = data.tenantInvoices.find((invoice) => ['unpaid', 'partially_paid', 'overdue', 'Unpaid', 'Partial', 'Overdue'].includes(invoice.status));
  const paymentMethodsInUi = [
    { id: 'bank_transfer', label: 'Bank transfer', type: 'Not configured' },
    { id: 'card', label: 'Card', type: 'Not configured' },
  ];
  const startPayment = async () => {
    if (!unpaidInvoice || !selectedMethod) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post('/payments/initiate', {
        invoice_id: Number(unpaidInvoice.id),
        payment_method: selectedMethod,
        gateway_name: 'manual',
        gateway_reference: makeId('PAY'),
        amount: Number(unpaidInvoice.amount),
      });
      refresh();
      setMessage('Payment attempt recorded as pending. No money was charged; configure a payment gateway to process real payments.');
    } catch (error) {
      setMessage(error.message || 'Unable to record the payment attempt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Choose a saved method and initiate a payment attempt. Only the server can verify success." action={<button className="primary-btn" disabled={!unpaidInvoice || busy} onClick={startPayment}>{busy ? 'Starting…' : `Pay $${unpaidInvoice?.amount || 0}`}</button>} />
      {message && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Available payment methods</h3>
          <div className="mt-4 space-y-3">
            {paymentMethodsInUi.map((method) => (
              <button key={method.id} type="button" onClick={() => setSelectedMethod(method.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selectedMethod === method.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div>
                  <p className="font-medium text-slate-900">{method.label}</p>
                  <p className="text-xs text-slate-500">{method.type}</p>
                </div>
                <span className="text-sm font-medium text-emerald-700">{selectedMethod === method.id ? 'Selected' : 'Select'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Payment history</h3>
          <div className="mt-4 space-y-3">
            {[...data.paymentAttempts, ...data.paymentHistory].map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-900">{item.id}</p>
                  <p className="text-xs text-slate-500">{item.method || item.paymentMethod?.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{typeof item.amount === 'number' ? `$${item.amount.toLocaleString()}` : item.amount}</p>
                  <StatusBadge label={item.status === 'pending' ? 'Pending' : item.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantMaintenancePage() {
  const { data, refresh } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentLease = data.leases.find((lease) => lease.tenant === data.profile.name && lease.status === 'Active');
  const fields = [
    { name: 'title', label: 'Request title', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high', 'urgent'], required: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance requests" subtitle="Submit and track maintenance issues for your current lease." action={<button className="primary-btn" disabled={!currentLease} onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New request</button>} />
      {!currentLease && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">A maintenance request requires an active lease associated with this tenant.</div>}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.tenantMaintenance.map((request) => (
                <tr key={request.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{request.id}</td>
                  <td className="px-4 py-3 text-slate-600">{request.title}</td>
                  <td className="px-4 py-3"><StatusBadge label={request.priority.charAt(0).toUpperCase() + request.priority.slice(1)} /></td>
                  <td className="px-4 py-3"><StatusBadge label={request.requestStatus === 'open' ? 'Submitted' : request.requestStatus === 'in_progress' ? 'In Progress' : request.requestStatus.charAt(0).toUpperCase() + request.requestStatus.slice(1)} /></td>
                  <td className="px-4 py-3 text-slate-600">{request.date}</td>
                  <td className="px-4 py-3">{['open', 'in_progress'].includes(request.requestStatus) && <button className="text-sm font-medium text-rose-700" onClick={async () => {
                    try {
                      await api.patch(`/maintenance/${request.id}/status`, { status: 'cancelled' });
                      refresh();
                    } catch (error) {
                      window.alert(error.message);
                    }
                  }}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <FormDialog open={dialogOpen} title="Submit maintenance request" fields={fields} initialValues={{ title: '', description: '', priority: 'normal' }} onClose={() => setDialogOpen(false)} onSubmit={async (values) => {
        if (!currentLease) throw new Error('An active tenant lease is required to submit a maintenance request.');
        await api.post('/maintenance', {
          lease_id: Number(currentLease.id),
          title: values.title,
          description: values.description,
          priority: values.priority,
        });
        refresh();
        setDialogOpen(false);
      }} />
    </div>
  );
}

function TenantNotificationsPage() {
  const { data, refresh } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="See important personal updates and mark them as read when complete." />
      <div className="panel divide-y divide-slate-200 overflow-hidden">
        {data.notifications.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.message}</p>
            </div>
            {!item.read && <button onClick={async () => {
              try {
                await api.patch(`/notifications/${item.id}/read`);
                refresh();
              } catch (error) {
                window.alert(error.message);
              }
            }} className="text-sm font-medium text-emerald-700">Mark read</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TenantSettingsPage() {
  const { data, setData, refresh } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(data.profile);
  const [saveError, setSaveError] = useState('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  useEffect(() => setProfile(data.profile), [data.profile]);

  const saveProfile = async (includeEmergency = false) => {
    setSaveError('');
    setSaved(false);
    const body = {
      name: profile.name,
      phone: profile.phone,
      current_address: profile.currentAddress,
    };
    if (includeEmergency) {
      body.emergency_contact_name = profile.emergencyContactName;
      body.emergency_contact_phone = profile.emergencyContactPhone;
    }
    try {
      const response = await api.patch('/profile', body);
      setData((current) => ({ ...current, profile: { ...current.profile, ...response.data.user } }));
      refresh();
      setSaved(true);
    } catch (error) {
      setSaveError(error.message || 'Unable to save profile.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" subtitle="Manage profile details, contact info, and your emergency contacts." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Profile</h3>
          <div className="mt-5 space-y-4">
            <div><label className="label">Full name</label><input className="field" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></div>
            <div><label className="label">Email</label><input className="field" type="email" value={profile.email} readOnly /></div>
            <div><label className="label">Phone</label><input className="field" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div><label className="label">Current address</label><input className="field" value={profile.currentAddress || ''} onChange={(event) => setProfile((current) => ({ ...current, currentAddress: event.target.value }))} /></div>
          </div>
          <button className="primary-btn mt-5" onClick={() => saveProfile(false)}>Save profile</button>
          {saved && <p role="status" className="mt-3 text-sm text-emerald-700">Profile updated.</p>}
          {saveError && <p role="alert" className="mt-3 text-sm text-rose-700">{saveError}</p>}
        </div>

        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Emergency contact</h3>
          <div className="mt-5 space-y-4">
            <div><label className="label">Contact name</label><input className="field" value={profile.emergencyContactName || ''} onChange={(event) => setProfile((current) => ({ ...current, emergencyContactName: event.target.value }))} /></div>
            <div><label className="label">Contact phone</label><input className="field" value={profile.emergencyContactPhone || ''} onChange={(event) => setProfile((current) => ({ ...current, emergencyContactPhone: event.target.value }))} /></div>
          </div>
          <button className="primary-btn mt-5" onClick={() => saveProfile(true)}>Update contact</button>
        </div>
        <div className="panel p-5 xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900">Security</h3>
          <p className="mt-2 text-sm text-slate-600">Password changes are handled by the authenticated backend and are never saved in browser preview state.</p>
          <button className="secondary-btn mt-4" onClick={() => setPasswordDialogOpen(true)}>Change password</button>
        </div>
      </div>
      <FormDialog open={passwordDialogOpen} title="Change password" fields={[
        { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
        { name: 'newPassword', label: 'New password', type: 'password', minLength: 8, required: true },
      ]} initialValues={{ currentPassword: '', newPassword: '' }} onClose={() => setPasswordDialogOpen(false)} onSubmit={async (values) => {
        await changePassword(values);
        setPasswordDialogOpen(false);
      }} />
    </div>
  );
}

function PreviewNotice({ loading, error }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-sky-200 bg-sky-50 text-sky-900'}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{error
        ? <><strong>Backend data unavailable:</strong> {error}</>
        : loading
          ? 'Loading live account records from the backend…'
          : <><strong>Live data:</strong> records are loaded from the backend. Most page changes are still browser-only and are not saved to the database. Payment processing also requires a configured gateway.</>}</p>
    </div>
  );
}

function SearchFilterBar({ query, onQueryChange, placeholder = 'Search' }) {
  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={query} onChange={(event) => onQueryChange(event.target.value)} className="field pl-9" placeholder={placeholder} />
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><FolderKanban className="h-5 w-5" /></div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function FormDialog({ open, title, fields, initialValues, onClose, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setError('');
    }
  }, [open, initialValues]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(submitError.message || 'Unable to save these changes.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="form-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="form-dialog-title" className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-4 p-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className={field.type === 'textarea' || field.type === 'file' ? 'sm:col-span-2' : ''}>
                <label htmlFor={`field-${field.name}`} className="label">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea id={`field-${field.name}`} required={field.required} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field min-h-24" />
                ) : field.type === 'multiselect' ? (
                  <select id={`field-${field.name}`} multiple value={values[field.name] ?? []} onChange={(event) => setValues((current) => ({ ...current, [field.name]: Array.from(event.target.selectedOptions).map((option) => option.value) }))} className="field min-h-28">
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === 'select' ? (
                  <select id={`field-${field.name}`} required={field.required} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field">
                    <option value="">Select an option</option>
                    {field.options?.map((option) => {
                      const value = typeof option === 'string' ? option : option.value;
                      const label = typeof option === 'string' ? option.replaceAll('_', ' ') : option.label;
                      return <option key={value} value={value}>{label}</option>;
                    })}
                  </select>
                ) : field.type === 'file' ? (
                  <input id={`field-${field.name}`} type="file" accept={field.accept} multiple={field.multiple} className="field file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:font-semibold file:text-emerald-700" onChange={(event) => setValues((current) => ({ ...current, [field.name]: Array.from(event.target.files || []) }))} />
                ) : (
                  <input
                    id={`field-${field.name}`}
                    type={field.type || 'text'}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    minLength={field.minLength}
                    step={field.type === 'number' && field.min === 0.01 ? '0.01' : undefined}
                    value={values[field.name] ?? ''}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    className="field"
                  />
                )}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn">Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DetailsDialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="details-dialog-title" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="details-dialog-title" className="text-lg font-semibold text-slate-900">{title}</h2>
          <button aria-label="Close dialog" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
        <div className="mt-5 flex justify-end"><button className="secondary-btn" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }) {
  return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>;
}

function downloadCsv(filename, rows) {
  const contents = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function SummaryCard({ label, value, delta, tone = 'emerald' }) {
  const toneStyles = {
    emerald: 'border-emerald-100 bg-emerald-50',
    sky: 'border-sky-100 bg-sky-50',
    violet: 'border-violet-100 bg-violet-50',
    amber: 'border-amber-100 bg-amber-50',
    rose: 'border-rose-100 bg-rose-50',
  };

  return (
    <div className={`panel border p-4 ${toneStyles[tone] || toneStyles.emerald}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        <div className="rounded-xl bg-white p-2 text-emerald-600 shadow-sm"><ChevronRight className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 text-xs text-slate-600">{delta}</p>
    </div>
  );
}

function StatusBadge({ label }) {
  const style = statusClasses[label] || 'border-slate-200 bg-slate-100 text-slate-700';
  return <span className={`status-badge ${style}`}>{label}</span>;
}

function humanizeStatus(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortInitials(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default App;
