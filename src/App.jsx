import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  FolderKanban,
  HandCoins,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  User,
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
import { getMissingTenantInfo, makeId, useWorkspace } from './context/WorkspaceContext';
import api from './services/apiClient';
import { changePassword } from './services/authService';
import PublicLandingPage from './PublicLandingPage';
import { usePagination } from './Pagination';
import { PHILIPPINES_LOCATIONS, DEFAULT_COUNTRY } from './data/philippineLocations';
import PhilippineAddressFields from './components/PhilippineAddressFields';

export function parseAddress(addressString = '') {
  if (!addressString || typeof addressString !== 'string') {
    return { street: '', barangay: '', city: '', zipCode: '', country: DEFAULT_COUNTRY };
  }
  // Try JSON first
  const trimmed = addressString.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        street: parsed.street || '',
        barangay: parsed.barangay || '',
        city: parsed.city || '',
        zipCode: parsed.zipCode || parsed.zip_code || '',
        country: parsed.country || DEFAULT_COUNTRY,
      };
    } catch {
      // fallback to comma separated
    }
  }
  // Comma separated fallback
  const parts = trimmed.split(',').map((p) => p.trim());
  if (parts.length >= 4) {
    const rawBrgy = parts[parts.length - 4] || '';
    const cleanBrgy = rawBrgy.replace(/^brgy\.?\s*/i, '');
    return {
      street: parts.slice(0, parts.length - 4).join(', ') || parts[0],
      barangay: cleanBrgy,
      city: parts[parts.length - 3] || '',
      zipCode: parts[parts.length - 2] || '',
      country: parts[parts.length - 1] || DEFAULT_COUNTRY,
    };
  }
  return { street: trimmed, barangay: '', city: '', zipCode: '', country: DEFAULT_COUNTRY };
}

export function formatAddress({ street, barangay, city, zipCode, country }) {
  const parts = [
    street?.trim(),
    barangay?.trim() ? `Brgy. ${barangay.trim().replace(/^brgy\.?\s*/i, '')}` : '',
    city?.trim(),
    zipCode?.trim(),
    country?.trim() || DEFAULT_COUNTRY,
  ].filter(Boolean);
  return parts.join(', ');
}

const statusClasses = {
  'Approved': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Under Review': 'border-amber-200 bg-amber-50 text-amber-700',
  'Rejected': 'border-rose-200 bg-rose-50 text-rose-700',
  'Successful': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Pending': 'border-amber-200 bg-amber-50 text-amber-700',
  'Failed': 'border-rose-200 bg-rose-50 text-rose-700',
  'Active': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Pending Lease': 'border-amber-200 bg-amber-50 text-amber-700',
  'Ended': 'border-slate-200 bg-slate-100 text-slate-700',
  'Available': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Occupied': 'border-purple-200 bg-purple-50 text-purple-700',
  'Maintenance': 'border-amber-200 bg-amber-50 text-amber-700',
  'Awaiting Review': 'border-amber-200 bg-amber-50 text-amber-700',
  'In Progress': 'border-purple-200 bg-purple-50 text-purple-700',
  'Scheduled': 'border-violet-200 bg-violet-50 text-violet-700',
  'High': 'border-rose-200 bg-rose-50 text-rose-700',
  'Medium': 'border-amber-200 bg-amber-50 text-amber-700',
  'Low': 'border-slate-200 bg-slate-100 text-slate-700',
  'Unpaid': 'border-amber-200 bg-amber-50 text-amber-700',
  'Paid': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Partial': 'border-violet-200 bg-violet-50 text-violet-700',
  'Submitted': 'border-purple-200 bg-purple-50 text-purple-700',
  'Acknowledge': 'border-violet-200 bg-violet-50 text-violet-700',
  'Completed': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Cancelled': 'border-rose-200 bg-rose-50 text-rose-700',
  'Archived': 'border-slate-200 bg-slate-100 text-slate-700',
  'Inactive': 'border-slate-200 bg-slate-100 text-slate-700',
  'Overdue': 'border-rose-200 bg-rose-50 text-rose-700',
  'Void': 'border-slate-200 bg-slate-100 text-slate-600',
  'Not applicable': 'border-slate-200 bg-slate-100 text-slate-700',
  'Not Applicable': 'border-slate-200 bg-slate-100 text-slate-700',
  'In progress': 'border-purple-200 bg-purple-50 text-purple-700',
};

function monthlyDueDate(periodDate, dueDay) {
  if (!periodDate || !dueDay) return '';
  const [year, month] = periodDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(Number(dueDay), lastDay)).padStart(2, '0')}`;
}

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<RootRedirect user={user} />} />
      <Route path="/explore" element={<PublicLandingPage />} />
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
        <Route path="profile" element={<TenantProfilePage />} />
        <Route path="settings" element={<TenantProfilePage />} />
      </Route>

      <Route
        path="/applicant"
        element={
          <ProtectedRoute role="applicant">
            <ApplicantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TenantApplicationsPage />} />
        <Route path="applications" element={<TenantApplicationsPage />} />
        <Route path="rentals" element={<TenantRentalsPage />} />
        <Route path="profile" element={<TenantProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRedirect({ user }) {
  if (!user) {
    return <PublicLandingPage />;
  }

  const destination = user.role === 'landlord' ? '/landlord'
    : user.role === 'applicant' ? '/applicant'
      : '/tenant';
  return <Navigate to={destination} replace />;
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
    return <Navigate to="/" replace />;
  }

  return children;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-white px-5 py-3 text-slate-700 shadow-soft">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        Loading dashboard...
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const unitId = searchParams.get('unitId');
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
      if (unitId && ['applicant', 'tenant'].includes(user.role)) {
        await api.post('/applications', { unit_id: Number(unitId) });
        navigate(user.role === 'tenant' ? '/tenant/applications' : '/applicant/applications');
        return;
      }
      navigate(user?.role === 'landlord' ? '/landlord' : user?.role === 'applicant' ? '/applicant' : '/tenant');
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft lg:grid-cols-2">
        <div className="bg-gradient-to-br from-purple-800 via-purple-700 to-purple-600 p-8 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2.5"><Building2 className="h-6 w-6" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-purple-200">Portfolio</p>
              <h1 className="text-2xl font-bold">TenantFlow</h1>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-purple-200">Property operations</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">Smarter rent, lease, and maintenance workflows.</h2>
            </div>

            <div className="space-y-4">
              {[
                'Role-based landlord and tenant access',
                'Payment verification through backend workflow',
                'Maintenance and leasing lifecycle tracking',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-purple-200" />
                  <span className="text-sm text-purple-50">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-purple-600">Welcome back</p>
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
              <button type="button" onClick={() => navigate(`/register${unitId ? `?unitId=${encodeURIComponent(unitId)}` : ''}`)} className="font-semibold text-purple-700 underline-offset-2 hover:underline">
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
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const unitId = searchParams.get('unitId');
  const [state, setState] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    birthdate: '',
    phone: '',
    country: 'Philippines',
    city: '',
    barangay: '',
    zip_code: '',
    street: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    employment_status: 'full_time',
    monthly_income: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const combinedAddress = formatAddress({
        street: state.street,
        barangay: state.barangay,
        city: state.city,
        zipCode: state.zip_code,
        country: state.country,
      });
      formData.set('current_address', combinedAddress);
      await register(formData);
      if (unitId) {
        navigate(`/applicant/profile?unitId=${encodeURIComponent(unitId)}&justRegistered=1`);
      } else {
        navigate('/applicant/profile');
      }
    } catch (registerError) {
      setError(registerError.message || 'Account registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setState((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <button type="button" onClick={() => navigate('/explore')} className="mb-7 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-rose-600">
          <Building2 className="h-5 w-5" /> TenantFlow
        </button>
        <div className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">Renter account</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">Create your account</h3>
          <p className="mt-2 text-sm text-slate-600">Create your renter account to explore properties and send applications.</p>
          {unitId && (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900">
              <Building2 className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Applying for a home: Once registered, you will be redirected to your profile to upload documents and complete your tenant info before sending your application.</span>
            </div>
          )}
        </div>

        <form className="space-y-7" onSubmit={handleSubmit}>
          <section>
            <h4 className="mb-4 text-lg font-semibold">Account access</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="register-email" className="label">Email <span className="text-rose-600">*</span></label><input id="register-email" name="email" type="email" required maxLength={255} value={state.email} onChange={updateField} className="field" autoComplete="email" /></div>
              <div><label htmlFor="register-password" className="label">Password <span className="text-rose-600">*</span></label><input id="register-password" name="password" type="password" minLength={8} maxLength={4096} required value={state.password} onChange={updateField} className="field" autoComplete="new-password" /></div>
            </div>
          </section>

          <section>
            <h4 className="mb-4 text-lg font-semibold">Personal information</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label htmlFor="register-first-name" className="label">First name <span className="text-rose-600">*</span></label><input id="register-first-name" name="first_name" required maxLength={100} value={state.first_name} onChange={updateField} className="field" autoComplete="given-name" /></div>
              <div><label htmlFor="register-middle-name" className="label">Middle name <span className="font-normal text-slate-400">(optional)</span></label><input id="register-middle-name" name="middle_name" maxLength={100} value={state.middle_name} onChange={updateField} className="field" autoComplete="additional-name" /></div>
              <div><label htmlFor="register-last-name" className="label">Last name <span className="text-rose-600">*</span></label><input id="register-last-name" name="last_name" required maxLength={100} value={state.last_name} onChange={updateField} className="field" autoComplete="family-name" /></div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="register-birthdate" className="label">Birthdate <span className="font-normal text-slate-400">(optional)</span></label><input id="register-birthdate" name="birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={state.birthdate} onChange={updateField} className="field" /></div>
              <div><label htmlFor="register-phone" className="label">Phone number <span className="font-normal text-slate-400">(optional)</span></label><input id="register-phone" name="phone" type="tel" maxLength={30} value={state.phone} onChange={updateField} className="field" autoComplete="tel" /></div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700">Current address <span className="font-normal text-slate-400">(optional)</span></p>
                <PhilippineAddressFields
                  idPrefix="register-addr"
                  required={false}
                  values={{
                    street: state.street,
                    barangay: state.barangay,
                    city: state.city,
                    zip_code: state.zip_code,
                    zipCode: state.zip_code,
                    country: state.country,
                  }}
                  onChange={(updated) => {
                    setState((prev) => ({
                      ...prev,
                      street: updated.street ?? prev.street,
                      barangay: updated.barangay ?? prev.barangay,
                      city: updated.city ?? prev.city,
                      zip_code: updated.zipCode || updated.zip_code || prev.zip_code,
                      country: updated.country ?? prev.country,
                    }));
                  }}
                />
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-4 text-lg font-semibold">Emergency contact <span className="text-xs font-normal text-slate-400">(optional)</span></h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="register-emergency-name" className="label">Contact name</label><input id="register-emergency-name" name="emergency_contact_name" maxLength={150} value={state.emergency_contact_name} onChange={updateField} className="field" /></div>
              <div><label htmlFor="register-emergency-phone" className="label">Contact phone</label><input id="register-emergency-phone" name="emergency_contact_phone" type="tel" maxLength={30} value={state.emergency_contact_phone} onChange={updateField} className="field" /></div>
            </div>
          </section>

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          <button type="submit" disabled={submitting} className="primary-btn w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>

          <div className="text-center text-sm text-slate-600">
            Already registered?{' '}
            <button type="button" onClick={() => navigate(`/login${unitId ? `?unitId=${encodeURIComponent(unitId)}` : ''}`)} className="font-semibold text-purple-700 underline-offset-2 hover:underline">
              Sign in
            </button>
          </div>
          <p className="text-center text-xs text-slate-500">Already have an account? <button type="button" onClick={() => navigate('/explore')} className="font-semibold text-rose-600 hover:underline">Browse available homes</button></p>
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
    <div className="flex min-h-screen bg-purple-50/30">
      <aside className={`${isCollapsed ? 'w-24' : 'w-72'} hidden border-r border-purple-100 bg-white lg:flex lg:flex-col`}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 text-sm font-bold text-white">TF</div>
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
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 text-sm font-bold text-white">TF</div>
            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Portfolio</p><p className="text-lg font-bold text-slate-900">TenantFlow</p></div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>
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
              <input value={headerSearch} onChange={(event) => setHeaderSearch(event.target.value)} onKeyDown={submitSearch} className="w-64 rounded-xl border border-purple-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-purple-500" placeholder="Search and press Enter" />
            </div>
            <button onClick={() => navigate('/landlord/notifications')} aria-label={`${data.notifications.filter((item) => !item.read).length} unread notifications`} className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Bell className="h-4 w-4" />{data.notifications.some((item) => !item.read) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />}</button>
            <button onClick={() => navigate('/landlord/settings')} className="flex items-center gap-3 rounded-xl border border-slate-200 px-2.5 py-1.5 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">{shortInitials(accountName)}</div>
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

function ApplicantLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useWorkspace();
  const accountName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Applicant';
  const navItems = [
    { label: 'Applications', to: '/applicant/applications', icon: FolderKanban },
    { label: 'Available rentals', to: '/applicant/rentals', icon: Building2 },
    { label: 'Explore listings', to: '/explore', icon: Search },
    { label: 'Profile', to: '/applicant/profile', icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-purple-50/30">
      <aside className="hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rental portal</p>
          <p className="text-lg font-bold text-slate-900">Applicant</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Applicant portal</p>
            <h1 className="text-xl font-bold text-slate-900">Rental applications</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{accountName}</p>
            <p className="text-xs text-slate-500">Applicant</p>
          </div>
        </header>
        <nav className="flex gap-2 border-b border-slate-200 bg-white p-3 lg:hidden">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
          <button onClick={handleLogout} className="ml-auto rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Logout</button>
        </nav>
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
    { label: 'Explore listings', to: '/explore', icon: Search },
    { label: 'Applications', to: '/tenant/applications', icon: FolderKanban },
    { label: 'My Lease', to: '/tenant/lease', icon: Home },
    { label: 'Invoices', to: '/tenant/invoices', icon: ReceiptText },
    { label: 'Payments', to: '/tenant/payments', icon: CreditCard },
    { label: 'Maintenance', to: '/tenant/maintenance', icon: Wrench },
    { label: 'Notifications', to: '/tenant/notifications', icon: Bell },
    { label: 'Profile', to: '/tenant/profile', icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-purple-50/30">
      <aside className="w-72 border-r border-purple-100 bg-white lg:flex lg:flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 text-sm font-bold text-white">TF</div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant portal</p>
              <p className="text-lg font-bold text-slate-900">Resident</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 text-sm font-bold text-white">TF</div>
            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tenant portal</p><p className="text-lg font-bold text-slate-900">Resident</p></div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">{shortInitials(accountName)}</div>
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
    { label: 'Total Properties', value: data.properties.length, delta: 'In this portfolio', tone: 'emerald', to: '/landlord/properties' },
    { label: 'Total Rental Units', value: data.units.length, delta: `${occupiedCount} currently occupied`, tone: 'sky', to: '/landlord/units' },
    { label: 'Occupied Units', value: occupiedCount, delta: data.units.length ? `${Math.round((occupiedCount / data.units.length) * 100)}% occupancy` : 'No units yet', tone: 'violet', to: '/landlord/units' },
    { label: 'Available Units', value: data.units.filter((item) => ['vacant', 'Available'].includes(item.status)).length, delta: 'Ready to lease', tone: 'amber', to: '/landlord/units' },
    { label: 'Active Leases', value: activeLeaseCount, delta: 'Current agreements', tone: 'emerald', to: '/landlord/leases' },
    { label: 'Pending Applications', value: data.applications.filter((item) => ['Submitted', 'Under Review'].includes(item.status)).length, delta: 'Awaiting review', tone: 'rose', to: '/landlord/applications' },
    { label: 'Unpaid Invoices', value: `$${unpaidTotal.toLocaleString()}`, delta: 'Outstanding total', tone: 'amber', to: '/landlord/invoices' },
    { label: 'Monthly Income', value: `$${data.leases.filter((item) => item.status === 'Active').reduce((sum, item) => sum + Number(item.rent || 0), 0).toLocaleString()}`, delta: 'Based on active leases', tone: 'sky', to: '/landlord/invoices' },
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
          <button
            key={item.label}
            type="button"
            className="rounded-2xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
            aria-label={`View ${item.label}`}
            onClick={() => navigate(item.to)}
          >
            <SummaryCard {...item} />
          </button>
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
                <div className="w-full rounded-t-2xl bg-gradient-to-t from-purple-700 to-purple-400" style={{ height: `${Math.min(100, (Number(item.amount || 0) / Math.max(1, ...data.paymentHistory.map((payment) => Number(payment.amount || 0)))) * 100)}%` }} />
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
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${item.value}%` }} />
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
            <button className="text-sm font-medium text-purple-700" onClick={() => navigate('/landlord/applications')}>View all</button>
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
            <button className="text-sm font-medium text-purple-700" onClick={() => navigate('/landlord/invoices')}>Review</button>
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
          <button className="text-sm font-medium text-purple-700" onClick={() => navigate('/landlord/maintenance')}>Manage</button>
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
  const { pageItems: pageProperties, pagination: propertiesPagination } = usePagination(visibleProperties, query);
  const fields = [
    { name: 'name', label: 'Property name', required: true },
    { name: 'type', label: 'Property type', type: 'select', options: ['apartment', 'house', 'condo', 'townhouse', 'boarding_house', 'commercial', 'other'], required: true },
    { name: 'rentalClassification', label: 'Rental classification', type: 'select', options: [{ value: 'unknown', label: 'Not confirmed — requires manual verification' }, { value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }], required: true },
    { name: 'constructionDate', label: 'Property construction date', type: 'date' },
    { name: 'address', label: 'Address', type: 'textarea', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Properties" subtitle="Manage portfolios, units, and property health across your asset base." action={<button className="primary-btn" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add property</button>} />
      <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search properties" />
      <div className="grid gap-4 xl:grid-cols-3">
        {pageProperties.map((property) => (
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
      {propertiesPagination}
      {visibleProperties.length === 0 && <EmptyState title="No properties found" description="Try another search or add your first property." />}
      <FormDialog
        open={dialogOpen}
        title={editing ? 'Edit property' : 'Add property'}
        fields={fields}
        initialValues={editing || { name: '', type: 'apartment', rentalClassification: 'unknown', constructionDate: '', address: '', description: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (values) => {
          const payload = {
            property_name: values.name,
            property_type: values.type,
            rental_classification: values.rentalClassification,
            construction_date: values.constructionDate || null,
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
  const { pageItems: pageUnits, pagination: unitsPagination } = usePagination(visibleUnits, query);
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
      <PageHeader title="Rental units" subtitle="Track occupancy, upcoming leases, and unit details by property." action={<button className="primary-btn" disabled={!data.properties.length} title={!data.properties.length ? 'Add a property before creating a rental unit.' : undefined} onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add unit</button>} />
      {!data.properties.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Create a property before adding a rental unit. <NavLink className="font-semibold underline" to="/landlord/properties">Add a property</NavLink>.</div>}
      <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search units and properties" />
      <div className="grid gap-4 xl:grid-cols-3">
        {pageUnits.map((unit) => (
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
      {unitsPagination}
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
  const { pageItems: pageApplications, pagination: applicationsPagination } = usePagination(applications, `${query}:${statusFilter}`);
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
      <PageHeader title="Applications" subtitle="Review renter details, supporting documents, and requested listings." />
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
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageApplications.map((app) => (
                <tr key={app.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{app.name}</p>
                      <p className="text-xs text-slate-500">{app.id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{app.propertyName ? `${app.propertyName} · Unit ${app.unitNumber || '—'}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{app.date}</td>
                  <td className="px-4 py-3"><StatusBadge label={app.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{app.reviewedBy ? <><span>{app.reviewedBy}</span><span className="block text-xs text-slate-400">{app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : ''}</span></> : 'Not reviewed'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-sm font-medium text-purple-700" onClick={async () => {
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
                      {['Submitted', 'Under Review'].includes(app.status) && <button className="text-sm font-medium text-purple-700" onClick={() => changeStatus(app, 'Under Review')}>Start review</button>}
                      {app.status === 'Under Review' && <button className="text-sm font-medium text-purple-700" onClick={() => changeStatus(app, 'Approved')}>Approve</button>}
                      {!['Approved', 'Rejected', 'Withdrawn'].includes(app.status) && <button className="text-sm font-medium text-rose-700" onClick={() => changeStatus(app, 'Rejected')}>Reject</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {applicationsPagination}
      </div>
      {applications.length === 0 && <EmptyState title="No applications match" description="Try another name or status filter." />}
      {selected && <DetailsDialog title={`Application ${selected.id}`} onClose={() => setSelected(null)}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailItem label="Applicant" value={selected.name} />
          <DetailItem label="Status" value={selected.status} />
          <DetailItem label="Birthdate" value={selected.birthdate || 'Not provided'} />
          <DetailItem label="Phone" value={selected.phone || 'Not provided'} />
          <DetailItem label="Current address" value={selected.current_address || 'Not provided'} />
          <DetailItem label="Emergency contact" value={selected.emergency_contact_name ? `${selected.emergency_contact_name} · ${selected.emergency_contact_phone || ''}` : 'Not provided'} />
          <DetailItem label="Desired move-in" value={selected.desiredMoveInDate || 'Not provided'} />
          <DetailItem label="Employment status" value={selected.employmentStatus || 'Not provided'} />
          <DetailItem label="Monthly income" value={selected.monthlyIncome ? `$${selected.monthlyIncome}` : 'Not provided'} />
          <DetailItem label="Listing" value={selected.propertyName ? `${selected.propertyName} · Unit ${selected.unitNumber || '—'}` : 'Legacy application'} />
          <DetailItem label="Reviewed at" value={selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString() : 'Not reviewed'} />
          <div className="sm:col-span-2"><DetailItem label="Notes" value={selected.additionalNotes || 'No notes provided'} /></div>
          <div className="sm:col-span-2">
            <p className="mb-2 font-semibold text-slate-800">Documents</p>
            {selected.documents?.length ? selected.documents.map((document) => (
              <div key={document.name || document.path} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2">
                <span className="text-slate-600">{document.name || document.path} · {document.type || 'other'}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge label={document.status === 'verified' ? 'Successful' : document.status === 'rejected' ? 'Rejected' : 'Pending'} />
                  {document.document_source === 'tenant' && <button className="text-xs font-medium text-purple-700" onClick={async () => {
                    try {
                      const response = await api.get(`/tenant-documents/${document.id}/download`, { responseType: 'blob' });
                      const url = URL.createObjectURL(response.data);
                      const link = window.document.createElement('a');
                      link.href = url;
                      link.download = document.name;
                      link.click();
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      window.alert(error.message);
                    }
                  }}>Download</button>}
                  {document.status !== 'verified' && <button className="text-xs font-medium text-purple-700" onClick={async () => {
                    try {
                  await api.patch(document.document_source === 'tenant' ? `/tenant-documents/${document.id}/verification` : `/documents/${document.id}/verification`, { verification_status: 'verified' });
                  const documents = selected.documents.map((item) => item.id === document.id ? { ...item, status: 'verified' } : item);
                  setSelected({ ...selected, documents });
                    } catch (error) {
                  window.alert(error.message);
                    }
                  }}>Verify</button>}
                  {document.status !== 'rejected' && <button className="text-xs font-medium text-rose-700" onClick={async () => {
                    try {
                  await api.patch(document.document_source === 'tenant' ? `/tenant-documents/${document.id}/verification` : `/documents/${document.id}/verification`, { verification_status: 'rejected' });
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
  const [criterionDialogOpen, setCriterionDialogOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [evaluationApplication, setEvaluationApplication] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluationDrafts, setEvaluationDrafts] = useState({});
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState('');
  const [savingCriterion, setSavingCriterion] = useState(null);
  const [query, setQuery] = useState('');
  const [screeningFilter, setScreeningFilter] = useState('needs_screening');
  const criterionFields = [
    { name: 'name', label: 'Criterion name', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
  const activeCriteriaCount = data.criteria.filter((criterion) => criterion.active).length;
  const { pageItems: pageCriteria, pagination: criteriaPagination } = usePagination(data.criteria);
  const applications = data.applications.filter((application) => application.status !== 'Withdrawn');
  const evaluationSummary = (applicationId) => {
    const results = data.screenings.filter((screening) => Number(screening.applicationId) === Number(applicationId));
    const inactiveHistoryCount = results.filter((result) => !result.criterionActive).length;
    const total = activeCriteriaCount + inactiveHistoryCount;
    const summary = { total, passed: 0, failed: 0, pending: 0, not_applicable: 0 };
    results.forEach((result) => {
      if (Object.hasOwn(summary, result.result)) summary[result.result] += 1;
    });
    const activeResultCount = results.filter((result) => result.criterionActive).length;
    summary.pending += Math.max(0, activeCriteriaCount - activeResultCount);
    const evaluated = summary.passed + summary.failed + summary.not_applicable;
    summary.completionPercent = total ? Math.round((evaluated / total) * 100) : 0;
    summary.status = results[0]?.screeningStatus || (results.length ? 'in_progress' : 'not_started');
    return summary;
  };
  const visibleApplications = applications.filter((application) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery
      || application.name.toLowerCase().includes(normalizedQuery)
      || String(application.id).toLowerCase().includes(normalizedQuery);
    const summary = evaluationSummary(application.id);
    const matchesFilter = screeningFilter === 'all'
      || (screeningFilter === 'needs_screening' && ['Submitted', 'Under Review'].includes(application.status))
      || summary.status === screeningFilter;
    return matchesQuery && matchesFilter;
  });
  const { pageItems: pageApplications, pagination: applicationsPagination } = usePagination(visibleApplications, `${query}:${screeningFilter}`);
  const openEvaluation = async (application) => {
    setEvaluationApplication(application);
    setEvaluation(null);
    setEvaluationDrafts({});
    setEvaluationError('');
    setEvaluationLoading(true);
    try {
      const response = await api.post(`/applications/${application.id}/screening-evaluation`, {});
      setEvaluation(response.data);
      setEvaluationDrafts(Object.fromEntries(response.data.criteria.map((criterion) => [criterion.criteria_id, {
        status: criterion.result_status || 'pending',
        remarks: criterion.remarks || '',
      }])));
      refresh();
    } catch (error) {
      setEvaluationError(error.message || 'Unable to open this applicant evaluation.');
    } finally {
      setEvaluationLoading(false);
    }
  };
  const saveEvaluation = async (criterion) => {
    const draft = evaluationDrafts[criterion.criteria_id] || {};
    setSavingCriterion(criterion.criteria_id);
    setEvaluationError('');
    try {
      const response = await api.post(`/screenings/${evaluation.screening.screening_id}/results`, {
        criteria_id: criterion.criteria_id,
        result_status: draft.status || 'pending',
        remarks: draft.remarks || '',
      });
      setEvaluation((current) => ({
        ...current,
        criteria: current.criteria.map((item) => item.criteria_id === criterion.criteria_id
          ? { ...item, ...response.data }
          : item),
      }));
      setEvaluationDrafts((current) => ({
        ...current,
        [criterion.criteria_id]: {
          status: response.data.result_status,
          remarks: response.data.remarks || '',
        },
      }));
      refresh();
    } catch (error) {
      setEvaluationError(error.message || 'Unable to save this evaluation.');
    } finally {
      setSavingCriterion(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tenant screening" subtitle="Manage screening standards and record a landlord-led evaluation for each rental application." action={<button className="primary-btn" onClick={() => { setEditingCriterion(null); setCriterionDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add criterion</button>} />

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">Screening criteria</h2>
          <p className="text-sm text-slate-500">Inactive criteria stay attached to existing evaluations. Criteria with evaluation history cannot be deleted.</p>
        </div>
        {data.criteria.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageCriteria.map((criterion) => (
            <article key={criterion.id} className="panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{criterion.name}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{criterion.description || 'No description provided.'}</p>
                </div>
                <StatusBadge label={criterion.active ? 'Active' : 'Inactive'} />
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <button className="secondary-btn !px-3 !py-2" onClick={() => { setEditingCriterion(criterion); setCriterionDialogOpen(true); }}><Pencil className="mr-1.5 h-4 w-4" /> Edit</button>
                <button className="secondary-btn !px-3 !py-2" onClick={async () => {
                  try {
                    await api.put(`/screening-criteria/${criterion.id}`, { is_active: !criterion.active });
                    refresh();
                  } catch (error) {
                    window.alert(error.message);
                  }
                }}>{criterion.active ? 'Deactivate' : 'Activate'}</button>
                <button className="secondary-btn !px-3 !py-2 text-rose-700" aria-label={`Delete ${criterion.name}`} onClick={async () => {
                  if (!window.confirm(`Delete “${criterion.name}”? Criteria with evaluation history cannot be deleted.`)) return;
                  try {
                    await api.delete(`/screening-criteria/${criterion.id}`);
                    refresh();
                  } catch (error) {
                    window.alert(error.message);
                  }
                }}><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div> : <EmptyState title="No screening criteria" description="Default criteria will be created when your landlord workspace is initialized." />}
        {criteriaPagination}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Applicant evaluations</h2>
          <p className="text-sm text-slate-500">Statuses record the landlord’s assessment; submitted documents do not automatically pass a criterion.</p>
        </div>
        <div className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="field !rounded-lg pl-9" placeholder="Search applicant or application reference" />
            </div>
            <select className="field sm:max-w-56" value={screeningFilter} onChange={(event) => setScreeningFilter(event.target.value)} aria-label="Filter applicants by screening status">
              <option value="needs_screening">Needs screening</option>
              <option value="all">All applications</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="passed">Screening passed</option>
              <option value="failed">Screening has failed criteria</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="px-4 py-3">Applicant / reference</th>
                <th className="px-4 py-3">Application status</th>
                <th className="px-4 py-3">Screening progress</th>
                <th className="px-4 py-3">Evaluation</th>
              </tr></thead>
              <tbody>
                {pageApplications.map((application) => {
                  const summary = evaluationSummary(application.id);
                  return <tr key={application.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{application.name || 'Applicant'}</p>
                      <p className="text-xs text-slate-500">Application #{application.id} · submitted {application.date || 'date unavailable'}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge label={application.status} /></td>
                    <td className="min-w-52 px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                        <span>{summary.completionPercent}% complete</span>
                        <span>{summary.passed} passed · {summary.failed} failed · {summary.pending} pending · {summary.not_applicable} N/A</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.completionPercent}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StatusBadge label={humanizeStatus(summary.status)} />
                        <button className="text-sm font-semibold text-purple-700 hover:text-purple-800" onClick={() => openEvaluation(application)}>View evaluation</button>
                      </div>
                    </td>
                  </tr>;
                })}
                {!visibleApplications.length && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>No applications match this search and screening filter.</td></tr>}
              </tbody>
            </table>
          </div>
          {applicationsPagination}
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Property and unit are not linked to applications in the current application form, so they cannot be shown here.</p>
        </div>
      </section>

      <FormDialog
        open={criterionDialogOpen}
        title={editingCriterion ? 'Edit screening criterion' : 'Add screening criterion'}
        fields={criterionFields}
        initialValues={{ name: editingCriterion?.name || '', description: editingCriterion?.description || '' }}
        onClose={() => { setCriterionDialogOpen(false); setEditingCriterion(null); }}
        onSubmit={async (values) => {
          const payload = { criteria_name: values.name, description: values.description };
          if (editingCriterion) {
            await api.put(`/screening-criteria/${editingCriterion.id}`, payload);
          } else {
            await api.post('/screening-criteria', { ...payload, is_active: true });
          }
          refresh();
          setCriterionDialogOpen(false);
          setEditingCriterion(null);
        }}
      />
      {evaluationApplication && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 sm:p-5" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setEvaluationApplication(null);
      }}>
        <section role="dialog" aria-modal="true" aria-labelledby="evaluation-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="evaluation-title" className="text-lg font-semibold text-slate-900">Applicant screening evaluation</h2>
              <p className="mt-1 text-sm text-slate-500">{evaluationApplication.name} · Application #{evaluationApplication.id}</p>
            </div>
            <button aria-label="Close evaluation" onClick={() => setEvaluationApplication(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-5 overflow-y-auto p-5">
            {evaluationLoading && <p role="status" className="text-sm text-slate-600">Loading applicant evaluation…</p>}
            {evaluationError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{evaluationError}</p>}
            {evaluation && <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Application status" value={humanizeStatus(evaluation.application.application_status)} />
                <DetailItem label="Employment status" value={humanizeStatus(evaluation.application.employment_status) || 'Not provided'} />
                <DetailItem label="Monthly income reported" value={evaluation.application.monthly_income ? `PHP ${Number(evaluation.application.monthly_income).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'Not provided'} />
                <DetailItem label="Screening completion" value={`${evaluation.summary.completion_percent}%`} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ['Total criteria', evaluation.summary.total],
                  ['Passed', evaluation.summary.passed],
                  ['Failed', evaluation.summary.failed],
                  ['Pending', evaluation.summary.pending],
                  ['Not applicable', evaluation.summary.not_applicable],
                ].map(([label, count]) => <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-900">{count}</p>
                </div>)}
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">Submitted supporting documents</h3>
                <p className="mt-1 text-xs text-slate-500">Only document type and review metadata are shown here; file paths and document contents are not exposed.</p>
                {evaluation.documents.length
                  ? <ul className="mt-3 divide-y divide-slate-100">{evaluation.documents.map((document, index) => <li key={`${document.document_type}-${document.uploaded_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium text-slate-800">{humanizeStatus(document.document_type)}</span>
                    <span className="text-slate-500">{humanizeStatus(document.verification_status)} · {new Date(document.uploaded_at).toLocaleDateString()}</span>
                  </li>)}</ul>
                  : <p className="mt-3 text-sm text-slate-500">No supporting documents have been recorded.</p>}
              </div>
              {!['submitted', 'under_review'].includes(evaluation.application.application_status) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This application has a final decision. Existing evaluation history is view-only.</p>}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Criteria evaluation</h3>
                {evaluation.criteria.map((criterion) => {
                  const draft = evaluationDrafts[criterion.criteria_id] || { status: criterion.result_status || 'pending', remarks: criterion.remarks || '' };
                  const editable = ['submitted', 'under_review'].includes(evaluation.application.application_status);
                  return <article key={criterion.criteria_id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{criterion.criteria_name}</h4>
                          {!Number(criterion.is_active) && <StatusBadge label="Inactive" />}
                        </div>
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{criterion.description || 'No description provided.'}</p>
                        {criterion.verified_at && <p className="mt-2 text-xs text-slate-500">Evaluated {new Date(criterion.verified_at).toLocaleString()}{criterion.evaluated_by_name ? ` by ${criterion.evaluated_by_name}` : ''}</p>}
                      </div>
                      <label className="w-full text-sm md:w-52">
                        <span className="label">Evaluation status</span>
                        <select className="field" disabled={!editable} value={draft.status} onChange={(event) => setEvaluationDrafts((current) => ({
                          ...current,
                          [criterion.criteria_id]: { ...draft, status: event.target.value },
                        }))}>
                          <option value="pending">Pending</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="not_applicable">Not applicable</option>
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 block text-sm">
                      <span className="label">Landlord remarks</span>
                      <textarea className="field min-h-20" maxLength={5000} disabled={!editable} value={draft.remarks} onChange={(event) => setEvaluationDrafts((current) => ({
                        ...current,
                        [criterion.criteria_id]: { ...draft, remarks: event.target.value },
                      }))} placeholder="Record the evidence reviewed and the reason for this status." />
                    </label>
                    {editable && <div className="mt-3 flex justify-end">
                      <button className="primary-btn" disabled={savingCriterion === criterion.criteria_id} onClick={() => saveEvaluation(criterion)}>
                        {savingCriterion === criterion.criteria_id ? 'Saving…' : 'Save evaluation'}
                      </button>
                    </div>}
                  </article>;
                })}
              </div>
              <p className="text-xs text-slate-500">Screening results do not approve or reject an application. Make the final decision separately in Applications.</p>
            </>}
          </div>
          <div className="flex justify-end border-t border-slate-200 px-5 py-3"><button className="secondary-btn" onClick={() => setEvaluationApplication(null)}>Close</button></div>
        </section>
      </div>}
    </div>
  );
}

function printLeaseAgreement(lease, popup = window.open('', '_blank')) {
  if (!popup) {
    window.alert('Allow pop-ups to print the lease agreement.');
    return;
  }
  popup.opener = null;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const landlord = `${lease.landlord_first_name || ''} ${lease.landlord_last_name || ''}`.trim();
  const tenant = `${lease.tenant_first_name || ''} ${lease.tenant_last_name || ''}`.trim();
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lease agreement ${escapeHtml(lease.lease_id)}</title>
    <style>body{font:15px Arial,sans-serif;line-height:1.55;color:#172033;max-width:800px;margin:36px auto;padding:0 24px}h1,h2{color:#12382d}h1{text-align:center}section{margin:24px 0;border-bottom:1px solid #d5dce3;padding-bottom:16px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:64px}.signature{border-top:1px solid #333;padding-top:8px}.notice{background:#fff8df;border:1px solid #e8d18a;padding:12px}@media print{body{margin:18mm auto;padding:0}.notice{background:white}}</style></head><body>
    <h1>Residential Lease Agreement</h1>
    <p class="notice"><strong>Draft for review.</strong> This generated document is a convenience and is not represented as legally sufficient. Obtain review by a qualified Philippine legal professional before signing.</p>
    <section><h2>Parties and premises</h2><p><strong>Landlord:</strong> ${escapeHtml(landlord)}${lease.business_name ? ` (${escapeHtml(lease.business_name)})` : ''}</p><p><strong>Landlord contact:</strong> ${escapeHtml(lease.landlord_email)} · ${escapeHtml(lease.landlord_phone)}</p><p><strong>Tenant:</strong> ${escapeHtml(tenant)}</p><p><strong>Tenant contact:</strong> ${escapeHtml(lease.tenant_email)} · ${escapeHtml(lease.tenant_phone)}</p><p><strong>Property:</strong> ${escapeHtml(lease.property_name)} — ${escapeHtml(lease.address)}</p><p><strong>Unit:</strong> ${escapeHtml(lease.unit_number)}</p></section>
    <section><h2>Term and payment</h2><p><strong>Lease term:</strong> ${escapeHtml(lease.lease_start_date)} to ${escapeHtml(lease.lease_end_date)}</p><p><strong>Monthly rent:</strong> PHP ${Number(lease.monthly_rent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><p><strong>Advance rent:</strong> PHP ${Number(lease.advance_payment || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><p><strong>Security deposit:</strong> PHP ${Number(lease.security_deposit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><p><strong>Rent due:</strong> Day ${escapeHtml(lease.payment_due_day)} of each month; when that day does not exist in a month, payment is due on that month's last day.</p></section>
    <section><h2>Responsibilities</h2><p>The landlord will provide the premises in the condition agreed by the parties and handle landlord responsibilities required by the lease and applicable law.</p><p>The tenant will pay agreed rent, take reasonable care of the premises, report needed repairs, and meet the tenant responsibilities in the signed agreement.</p></section>
    <section><h2>Subleasing</h2><p>Assignment or subleasing requires the landlord's written consent where required by applicable law and this agreement. Any consent should be retained with the lease records.</p></section>
    <section><h2>Termination</h2><p>Termination must follow the lease and applicable law. This document does not authorize lockouts, self-help eviction, or automatic termination because an invoice is overdue.</p></section>
    <div class="signatures"><div class="signature">Landlord signature / printed name / date</div><div class="signature">Tenant signature / printed name / date</div></div>
    <script>window.addEventListener('load',()=>window.print())</script></body></html>`);
  popup.document.close();
}

function printPaymentReceipt(receipt, popup) {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const refunds = Array.isArray(receipt.refunds) ? receipt.refunds : [];
  const refundHistory = refunds.length
    ? `<h2>Refund history</h2><ul>${refunds.map((refund) => `<li>${escapeHtml(refund.refunded_at)} · PHP ${Number(refund.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} · ${escapeHtml(refund.reason)}</li>`).join('')}</ul>`
    : '';
  popup.opener = null;
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(receipt.receipt_number)}</title>
    <style>body{font:15px Arial,sans-serif;max-width:680px;margin:48px auto;padding:24px;color:#172033}h1{color:#12382d}dl{display:grid;grid-template-columns:180px 1fr;gap:12px;border-top:1px solid #d5dce3;padding-top:20px}dt{color:#667085}dd{margin:0;font-weight:600}</style></head>
    <body><h1>Payment receipt</h1><p>Receipt number: <strong>${escapeHtml(receipt.receipt_number)}</strong></p><dl>
    <dt>Payment date</dt><dd>${escapeHtml(receipt.payment_date)}</dd><dt>Amount received</dt><dd>PHP ${Number(receipt.amount_paid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</dd>
    <dt>Amount refunded</dt><dd>PHP ${Number(receipt.refunded_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</dd>
    <dt>Payment method</dt><dd>${escapeHtml(humanizeStatus(receipt.payment_method))}</dd><dt>Transaction reference</dt><dd>${escapeHtml(receipt.transaction_reference)}</dd>
    <dt>Invoice</dt><dd>${escapeHtml(receipt.invoice_number)} (#${escapeHtml(receipt.invoice_id)})</dd><dt>Lease</dt><dd>#${escapeHtml(receipt.lease_id)}</dd>
    </dl>${refundHistory}<p>This receipt records a confirmed payment in TenantFlow.</p><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
  popup.document.close();
}

function LeasesPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const eligibleApplications = data.applications.filter((item) => item.status === 'Approved' && !data.leases.some((lease) => lease.applicationId === item.id));
  const isUnitAvailableForPeriod = (unit, values) => {
    if (!['vacant', 'reserved', 'occupied', 'Available'].includes(unit.status)) return false;
    if (!values.start || !values.end || values.end <= values.start) return ['vacant', 'Available'].includes(unit.status);
    return !data.leases.some((lease) => String(lease.unitId) === String(unit.id)
      && ['Active', 'Pending'].includes(lease.status)
      && values.start <= lease.end && values.end >= lease.start);
  };
  const selectedApplicant = (values) => eligibleApplications.find((item) => String(item.id) === String(values.applicationId));
  const selectedUnit = (values) => data.units.find((item) => String(item.id) === String(values.unitId));
  const selectedProperty = (values) => {
    const unit = selectedUnit(values);
    return data.properties.find((item) => String(item.id) === String(unit?.propertyId));
  };
  const sections = [
    {
      title: 'Tenant and property',
      description: 'Choose an approved application and the vacant unit for this lease.',
      fields: [
        { name: 'applicationId', label: 'Approved application', type: 'select', options: eligibleApplications.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` })), required: true },
        { name: 'unitId', label: 'Available rental unit', type: 'select', options: (values) => data.units.filter((unit) => isUnitAvailableForPeriod(unit, values)).map((item) => ({ value: item.id, label: `${item.unitNumber || item.id} — ${item.property || item.propertyId}` })), onChangeValues: (nextValues, unitId) => {
          const unit = data.units.find((item) => String(item.id) === String(unitId));
          return { ...nextValues, rent: unit?.rent || '', securityDeposit: unit?.deposit || 0 };
        }, required: true },
      ],
      renderSummary: (values) => {
        const applicant = selectedApplicant(values);
        const unit = selectedUnit(values);
        const property = selectedProperty(values);
        if (!applicant && !unit) return null;
        return (
          <div className="sm:col-span-2 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
            {applicant && <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tenant</p><p className="mt-1 font-medium text-slate-900">{applicant.name}</p><p className="text-slate-600">Application {applicant.id}</p></div>}
            {unit && <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rental unit</p><p className="mt-1 font-medium text-slate-900">{unit.unitNumber} · {property?.name || unit.property || 'Property unavailable'}</p><p className="text-slate-600">{property?.address || unit.address || ''}</p></div>}
          </div>
        );
      },
    },
    {
      title: 'Lease duration',
      description: 'Set the start and end dates for the rental agreement.',
      fields: [
        { name: 'start', label: 'Lease start date', type: 'date', required: true },
        { name: 'end', label: 'Lease end date', type: 'date', min: (values) => values.start || undefined, required: true },
      ],
    },
    {
      title: 'Rental financial terms',
      description: 'Enter the monthly rent and any upfront payments.',
      fields: [
        { name: 'rent', label: 'Monthly rent', type: 'number', min: 1, required: true },
        { name: 'securityDeposit', label: 'Security deposit', type: 'number', min: 0, required: true },
        { name: 'advancePayment', label: 'Advance rent', type: 'number', min: 0 },
      ],
      renderSummary: (values) => {
        const initialCollection = Number(values.securityDeposit || 0) + Number(values.advancePayment || 0);
        return (
          <div className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">Initial rent collection</p>
            <p className="mt-1 text-xl font-semibold text-emerald-800">PHP {initialCollection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-emerald-700">Advance rent plus security deposit. The deposit is tracked separately and is not rent income.</p>
          </div>
        );
      },
    },
    {
      title: 'Payment schedule',
      description: 'Choose the day of the month when rent is due.',
      fields: [
        { name: 'paymentDueDay', label: 'Monthly payment due day (1–31)', type: 'number', min: 1, max: 31, required: true },
      ],
      renderSummary: () => <p className="sm:col-span-2 text-xs text-slate-500">Section 7 of RA 9653 generally provides for payment within the first five days of the month, unless the lease agrees on a later payment date. For months with fewer days, payment is due on that month’s last day.</p>,
    },
    {
      title: 'Legal and rental compliance',
      description: 'Coverage is assessed from the property classification, construction date, rent, continuing-lessee history, and rule effective dates.',
      fields: [],
      renderSummary: (values) => {
        const property = selectedProperty(values);
        const rule = data.rentalRegulations?.find((item) => item.regulation_code === 'NHSB-2024-01'
          && (!item.effective_from || !values.start || item.effective_from <= values.start)
          && (!item.effective_to || !values.start || item.effective_to >= values.start));
        const classification = property?.rentalClassification || 'unknown';
        const missingInfo = !property || classification === 'unknown' || !property.constructionDate;
        const expired = values.start && !rule;
        const verificationRequired = rule?.verification_status !== 'verified' || !rule?.new_construction_cutoff;
        const outOfScope = classification === 'commercial'
          || (rule && Number(values.rent || 0) > Number(rule.monthly_rent_ceiling || 0))
          || (rule?.new_construction_cutoff && property?.constructionDate > rule.new_construction_cutoff);
        const assessment = outOfScope ? 'Not covered by the configured residential rule'
          : missingInfo || expired || verificationRequired ? 'Requires manual verification'
            : 'Coverage candidate — verify continuing-lessee status';
        return (
          <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">Assessment: {assessment}</p>
            <div className="mt-2 grid gap-2 text-amber-800 sm:grid-cols-2">
              <p>Classification: {classification}</p>
              <p>Construction date: {property?.constructionDate || 'Not recorded'}</p>
              <p>Configured rule: {rule?.title || 'No verified successor rule configured'}</p>
              <p>Effective period: {rule?.effective_from || 'Unconfirmed'} to {rule?.effective_to || 'No configured end date'}</p>
            </div>
            <p className="mt-3 text-xs text-amber-800">Regulatory coverage and the resolution’s new-construction cutoff require confirmation against authoritative guidance. This assessment is not a legal guarantee.</p>
          </div>
        );
      },
    },
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
  const { pageItems: pageLeases, pagination: leasesPagination } = usePagination(visibleLeases, `${query}:${statusFilter}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Leases" subtitle="Create, review, and manage active, pending, and ended rental agreements." action={<button className="primary-btn" disabled={!eligibleApplications.length || !data.units.some((unit) => ['vacant', 'Available'].includes(unit.status))} title={!eligibleApplications.length ? 'An approved application is required to create a lease.' : undefined} onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New lease</button>} />
      {!eligibleApplications.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Approve an application that is not already linked to a lease before creating a lease.</div>}
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search leases, tenants, or units" />
        <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All lease statuses</option>{['pending', 'active', 'ended', 'terminated', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {pageLeases.map((lease) => (
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
              <p><span className="text-slate-400">Rent</span> <span className="font-medium text-slate-900">PHP {Number(lease.rent).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></p>
              <p><span className="text-slate-400">Deposit</span> <span className="font-medium text-slate-900">PHP {Number(lease.securityDeposit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></p>
              <p><span className="text-slate-400">Compliance</span> <span className="font-medium text-slate-900">{humanizeStatus(lease.compliance_status || 'requires_manual_verification')}</span></p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="secondary-btn" onClick={async () => {
                const popup = window.open('', '_blank');
                if (!popup) {
                  window.alert('Allow pop-ups to print the lease agreement.');
                  return;
                }
                popup.opener = null;
                try {
                  const response = await api.get(`/leases/${lease.id}/agreement`);
                  printLeaseAgreement(response.data.lease, popup);
                } catch (error) {
                  popup.close();
                  window.alert(error.message);
                }
              }}>Print agreement</button>
              <button className="secondary-btn" onClick={() => setSelectedLease(lease)}>Lease records</button>
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
      {leasesPagination}
      <FormDialog open={dialogOpen} title="Create lease" submitLabel="Create lease" sections={sections} initialValues={{ applicationId: eligibleApplications[0]?.id || '', coTenantIds: [], unitId: '', start: '', end: '', rent: '', securityDeposit: 0, advancePayment: 0, paymentDueDay: 5 }} onClose={() => setDialogOpen(false)} onSubmit={createLease} />
      <LeaseRecordsDialog lease={selectedLease} onClose={() => setSelectedLease(null)} />
    </div>
  );
}

function LeaseRecordsDialog({ lease, onClose }) {
  const [tab, setTab] = useState('deposit');
  const [deposit, setDeposit] = useState(null);
  const [increaseHistory, setIncreaseHistory] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [depositFormOpen, setDepositFormOpen] = useState(false);
  const [deductionFormOpen, setDeductionFormOpen] = useState(false);
  const [increaseFormOpen, setIncreaseFormOpen] = useState(false);
  const [noticeFormOpen, setNoticeFormOpen] = useState(false);

  const reload = async () => {
    if (!lease) return;
    setLoadError('');
    try {
      const [depositResponse, increaseResponse, noticeResponse] = await Promise.all([
        api.get(`/leases/${lease.id}/deposit`),
        api.get(`/leases/${lease.id}/rent-increases`),
        api.get(`/leases/${lease.id}/notices`),
      ]);
      setDeposit(depositResponse.data.deposit);
      setIncreaseHistory(increaseResponse.data);
      setNotices(noticeResponse.data);
    } catch (error) {
      setLoadError(error.message || 'Unable to load lease records.');
    }
  };

  useEffect(() => {
    setTab('deposit');
    reload();
  }, [lease?.id]);

  if (!lease) return null;

  const depositFields = [
    { name: 'received_date', label: 'Date received', type: 'date' },
    { name: 'bank_deposit_date', label: 'Bank deposit date', type: 'date' },
    { name: 'bank_account_reference', label: 'Bank account reference' },
    { name: 'accrued_interest', label: 'Accrued interest (PHP)', type: 'number', min: 0 },
    { name: 'refund_amount', label: 'Refund amount (PHP)', type: 'number', min: 0 },
    { name: 'refund_date', label: 'Refund date', type: 'date' },
    { name: 'settlement_status', label: 'Settlement status', type: 'select', options: ['pending', 'held', 'partially_refunded', 'refunded', 'settled'], required: true },
  ];
  const deductionFields = [
    { name: 'amount', label: 'Deduction amount (PHP)', type: 'number', min: 0.01, required: true },
    { name: 'basis', label: 'Deduction basis', type: 'select', options: [{ value: 'unpaid_obligation', label: 'Unpaid obligation' }, { value: 'damage', label: 'Damage to the premises' }], required: true },
    { name: 'reason', label: 'Reason (unpaid obligation or damage)', type: 'textarea', required: true },
    { name: 'supporting_document_ref', label: 'Supporting document reference', required: true },
  ];
  const increaseFields = [
    { name: 'proposed_monthly_rent', label: 'Proposed monthly rent (PHP)', type: 'number', min: 1, required: true },
    { name: 'effective_date', label: 'Effective date', type: 'date', required: true },
    { name: 'reason', label: 'Reason for increase', type: 'textarea', required: true },
  ];
  const noticeFields = [
    { name: 'notice_type', label: 'Notice type', type: 'select', options: ['tenant_notice', 'payment_demand', 'lease_expiration', 'lease_termination', 'sublease_consent', 'other'], required: true },
    { name: 'notice_date', label: 'Notice date', type: 'date', required: true },
    { name: 'recipient', label: 'Recipient', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'legal_ground', label: 'Termination / legal ground', type: 'select', options: ['', 'unauthorized_sublease', 'rent_arrears', 'owner_or_family_use', 'necessary_repairs', 'lease_expiration', 'other'] },
    { name: 'written_sublease_consent', label: 'Written sublease consent recorded?', type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
    { name: 'supporting_document_ref', label: 'Supporting document reference' },
  ];

  return (
    <>
      <DetailsDialog title={`Lease records · ${lease.id}`} onClose={onClose}>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[['deposit', 'Security deposit'], ['increases', 'Rent increases'], ['notices', 'Notices']].map(([value, label]) => (
            <button key={value} className={tab === value ? 'status-badge border-purple-200 bg-purple-50 text-purple-700' : 'status-badge border-purple-100 bg-white text-slate-600'} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>
        {loadError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p>}
        {tab === 'deposit' && (
          <div className="mt-4 space-y-4">
            {deposit ? (
              <>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Original deposit</dt><dd className="font-semibold text-slate-900">PHP {Number(deposit.original_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</dd></div>
                  <div><dt className="text-slate-500">Received</dt><dd className="font-medium text-slate-900">{deposit.received_date || 'Not recorded'}</dd></div>
                  <div><dt className="text-slate-500">Bank deposit</dt><dd className="font-medium text-slate-900">{deposit.bank_deposit_date || 'Not recorded'}</dd></div>
                  <div><dt className="text-slate-500">Bank reference</dt><dd className="font-medium text-slate-900">{deposit.bank_account_reference || 'Not recorded'}</dd></div>
                  <div><dt className="text-slate-500">Accrued interest</dt><dd className="font-medium text-slate-900">PHP {Number(deposit.accrued_interest).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</dd></div>
                  <div><dt className="text-slate-500">Refund amount / status</dt><dd className="font-medium text-slate-900">PHP {Number(deposit.refund_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} · {humanizeStatus(deposit.settlement_status)}</dd></div>
                </dl>
                {deposit.deductions?.length > 0 && <div><h4 className="font-medium text-slate-900">Authorized deductions</h4>{deposit.deductions.map((item) => <p key={item.deduction_id} className="mt-2 text-sm text-slate-600">PHP {Number(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} · {item.reason} · Evidence: {item.supporting_document_ref}</p>)}</div>}
                <div className="flex gap-2">
                  <button className="secondary-btn" onClick={() => setDepositFormOpen(true)}>Update deposit record</button>
                  <button className="secondary-btn" onClick={() => setDeductionFormOpen(true)}>Record deduction</button>
                </div>
                <p className="text-xs text-slate-500">A deposit is not automatically forfeited. Deductions require a recorded reason and evidence reference.</p>
              </>
            ) : <p className="text-sm text-slate-500">No deposit record is available for this lease.</p>}
          </div>
        )}
        {tab === 'increases' && (
          <div className="mt-4 space-y-4">
            <button className="primary-btn" onClick={() => setIncreaseFormOpen(true)}>Propose rent increase</button>
            {increaseHistory.length ? increaseHistory.map((item) => <div key={item.rent_increase_id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">PHP {Number(item.previous_monthly_rent).toLocaleString('en-PH')} → PHP {Number(item.proposed_monthly_rent).toLocaleString('en-PH')} ({Number(item.increase_percent).toFixed(2)}%)</p>
              <p className="mt-1 text-slate-600">Effective {item.effective_date} · {humanizeStatus(item.assessment_status)}{item.regulation_title ? ` · ${item.regulation_title}` : ''}</p>
              <p className="mt-1 text-slate-500">{item.reason}</p>
            </div>) : <p className="text-sm text-slate-500">No rent changes recorded.</p>}
          </div>
        )}
        {tab === 'notices' && (
          <div className="mt-4 space-y-4">
            <button className="primary-btn" onClick={() => setNoticeFormOpen(true)}>Record notice or consent</button>
            {notices.length ? notices.map((item) => <div key={item.notice_id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">{humanizeStatus(item.notice_type)} · {item.notice_date} · {item.recipient}</p>
              <p className="mt-1 text-slate-600">{item.description}</p>
              {item.legal_ground && <p className="mt-1 text-slate-500">Ground: {humanizeStatus(item.legal_ground)}</p>}
              {item.supporting_document_ref && <p className="mt-1 text-slate-500">Document reference: {item.supporting_document_ref}</p>}
            </div>) : <p className="text-sm text-slate-500">No notices recorded.</p>}
            <p className="text-xs text-slate-500">These records do not terminate a lease or initiate eviction. Seek legal review for termination-related action.</p>
          </div>
        )}
      </DetailsDialog>
      <FormDialog open={depositFormOpen} title="Update security deposit" fields={depositFields} initialValues={{
        received_date: deposit?.received_date || '',
        bank_deposit_date: deposit?.bank_deposit_date || '',
        bank_account_reference: deposit?.bank_account_reference || '',
        accrued_interest: deposit?.accrued_interest || 0,
        refund_amount: deposit?.refund_amount || 0,
        refund_date: deposit?.refund_date || '',
        settlement_status: deposit?.settlement_status || 'pending',
      }} onClose={() => setDepositFormOpen(false)} onSubmit={async (values) => {
        const response = await api.patch(`/leases/${lease.id}/deposit`, values);
        setDeposit(response.data.deposit);
        setDepositFormOpen(false);
      }} />
      <FormDialog open={deductionFormOpen} title="Record deposit deduction" fields={deductionFields} initialValues={{ amount: '', basis: 'unpaid_obligation', reason: '', supporting_document_ref: '' }} onClose={() => setDeductionFormOpen(false)} onSubmit={async (values) => {
        const response = await api.post(`/leases/${lease.id}/deposit/deductions`, values);
        setDeposit(response.data.deposit);
        setDeductionFormOpen(false);
      }} />
      <FormDialog open={increaseFormOpen} title="Propose rent increase" fields={increaseFields} initialValues={{ proposed_monthly_rent: lease.rent, effective_date: '', reason: '' }} onClose={() => setIncreaseFormOpen(false)} onSubmit={async (values) => {
        const response = await api.post(`/leases/${lease.id}/rent-increases`, values);
        if (response.data?.message) {
          await reload();
          throw new Error(response.data.message);
        }
        await reload();
        setIncreaseFormOpen(false);
      }} />
      <FormDialog open={noticeFormOpen} title="Record notice or consent" fields={noticeFields} initialValues={{ notice_type: 'tenant_notice', notice_date: new Date().toISOString().slice(0, 10), recipient: lease.tenant, description: '', legal_ground: '', written_sublease_consent: 'false', supporting_document_ref: '' }} onClose={() => setNoticeFormOpen(false)} onSubmit={async (values) => {
        await api.post(`/leases/${lease.id}/notices`, values);
        await reload();
        setNoticeFormOpen(false);
      }} />
    </>
  );
}

function InvoicesPage() {
  const { data, refresh } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const activeLeases = data.leases.filter((item) => item.status === 'Active');
  const fields = [
    { name: 'leaseId', label: 'Lease', type: 'select', options: activeLeases.map((item) => ({ value: item.id, label: `${item.id} — ${item.tenant}` })), onChangeValues: (nextValues, leaseId) => {
      const lease = activeLeases.find((item) => String(item.id) === String(leaseId));
      return { ...nextValues, dueDate: monthlyDueDate(nextValues.periodStart, lease?.paymentDueDay) };
    }, required: true },
    { name: 'periodStart', label: 'Billing period start', type: 'date', onChangeValues: (nextValues) => {
      const lease = activeLeases.find((item) => String(item.id) === String(nextValues.leaseId));
      return { ...nextValues, dueDate: monthlyDueDate(nextValues.periodStart, lease?.paymentDueDay) };
    }, required: true },
    { name: 'periodEnd', label: 'Billing period end', type: 'date', required: true },
    { name: 'issueDate', label: 'Issue date', type: 'date', required: true },
    { name: 'dueDate', label: 'Due date (defaults to the lease payment day)', type: 'date', required: true },
    { name: 'amount', label: 'Total amount', type: 'number', min: 0, required: true },
  ];
  const visibleInvoices = data.invoices.filter((invoice) =>
    (statusFilter === 'all' || invoice.status === statusFilter)
    && `${invoice.id || invoice.number} ${invoice.tenant} ${invoice.period}`.toLowerCase().includes(query.toLowerCase()),
  );
  const { pageItems: pageInvoices, pagination: invoicesPagination } = usePagination(visibleInvoices, `${query}:${statusFilter}`);
  const { pageItems: pageAttempts, pagination: attemptsPagination } = usePagination(data.paymentAttempts);
  const receipts = data.paymentHistory.filter((item) => item.receiptNumber);
  const { pageItems: pageReceipts, pagination: receiptsPagination } = usePagination(receipts);

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices & payments" subtitle="Review invoice status, outstanding balances, and successful payment verification." action={<button className="primary-btn" disabled={!activeLeases.length} title={!activeLeases.length ? 'An active lease is required to generate an invoice.' : undefined} onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Generate invoice</button>} />
      {!activeLeases.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">An active lease is required before generating a rent invoice.</div>}
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
              {pageInvoices.map((invoice) => (
                <tr key={invoice.id || invoice.number} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{invoice.id || invoice.number}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.tenant}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.period}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.dueDate}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">PHP {Number(invoice.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
        {invoicesPagination}
      </div>
      <div className="panel p-5">
        <h3 className="text-lg font-semibold text-slate-900">Payment attempts and verified receipts</h3>
        <p className="mt-1 text-sm text-slate-600">An attempt is not a payment. Cash and bank-transfer attempts require landlord confirmation; card and e-wallet verification require a configured gateway.</p>
        {data.paymentAttempts.length ? (
          <div className="mt-4 divide-y divide-slate-200">
            {pageAttempts.map((attempt) => (
              <div key={attempt.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                <div><p className="font-medium text-slate-900">{attempt.id} · Invoice {attempt.invoiceId}</p><p className="text-sm text-slate-500">{attempt.paymentMethod?.replace('_', ' ') || 'Payment method'} · {new Date(attempt.initiatedAt).toLocaleString()}</p></div>
                <div className="flex items-center gap-3"><span className="font-semibold text-slate-900">PHP {Number(attempt.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span><StatusBadge label={humanizeStatus(attempt.status)} />
                  {attempt.status === 'pending' && ['cash', 'bank_transfer', 'other'].includes(attempt.paymentMethod) && <button className="secondary-btn" onClick={async () => {
                    if (!window.confirm(`Confirm receipt of PHP ${Number(attempt.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for invoice ${attempt.invoiceId}?`)) return;
                    try {
                      await api.post(`/payments/${attempt.id}/confirm`, {});
                      refresh();
                    } catch (error) {
                      window.alert(error.message);
                    }
                  }}>Confirm received</button>}
                  {attempt.payment_status && ['completed', 'refunded'].includes(attempt.payment_status) && Number(attempt.amount) > Number(attempt.refunded_amount || 0) && <button className="secondary-btn" onClick={async () => {
                    const reason = window.prompt('Reason for the refund:');
                    if (!reason?.trim()) return;
                    const amount = Number(attempt.amount) - Number(attempt.refunded_amount || 0);
                    if (!window.confirm(`Record a refund of PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}?`)) return;
                    try {
                      await api.post(`/payments/${attempt.id}/refund`, { amount, reason });
                      refresh();
                    } catch (error) {
                      window.alert(error.message);
                    }
                  }}>Record refund</button>}
                  {attempt.receipt_number && <button className="secondary-btn" onClick={async () => {
                    const popup = window.open('', '_blank');
                    if (!popup) {
                      window.alert('Allow pop-ups to print the receipt.');
                      return;
                    }
                    try {
                      const response = await api.get(`/payments/${attempt.id}/receipt`);
                      printPaymentReceipt(response.data.receipt, popup);
                    } catch (error) {
                      popup.close();
                      window.alert(error.message);
                    }
                  }}>Print receipt</button>}
                </div>
              </div>
            ))}
            {attemptsPagination}
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">No payment attempts recorded.</p>}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h4 className="font-medium text-slate-900">Receipts</h4>
          {receipts.length
            ? pageReceipts.map((item) => <p key={item.id} className="mt-2 text-sm text-slate-600">{item.receiptNumber} · PHP {Number(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} · Invoice {item.invoice_number} · Lease {item.lease_id} · {humanizeStatus(item.status)}</p>)
            : <p className="mt-1 text-sm text-slate-500">No confirmed payments have generated receipts.</p>}
          {receiptsPagination}
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
  const { pageItems: pageExpenses, pagination: expensesPagination } = usePagination(visibleExpenses, `${category}:${propertyFilter}:${fromDate}:${toDate}`);
  const total = visibleExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" subtitle="Track operating costs, categories, and property-level spending summaries." action={<button className="primary-btn" disabled={!data.properties.length} title={!data.properties.length ? 'Add a property before recording an expense.' : undefined} onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Record expense</button>} />
      {!data.properties.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Create a property before recording a property expense.</div>}
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
              {pageExpenses.map((expense) => (
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
        {expensesPagination}
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
  const { pageItems: pageRequests, pagination: requestsPagination } = usePagination(requests, `${statusFilter}:${priorityFilter}`);
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
              {pageRequests.map((request) => (
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
                    {request.requestStatus !== 'completed' && request.requestStatus !== 'cancelled' && <button className="text-sm font-medium text-purple-700" onClick={() => setMaintenanceStatus(request, nextStatus[request.requestStatus])}>{request.requestStatus === 'open' ? 'Start work' : 'Complete'}</button>}
                    {request.requestStatus === 'cancelled' && <button className="text-sm font-medium text-purple-700" onClick={() => setMaintenanceStatus(request, 'open')}>Reopen</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {requestsPagination}
      </div>
    </div>
  );
}

function NotificationsPage() {
  const { data, refresh } = useWorkspace();
  const unreadCount = data.notifications.filter((item) => !item.read).length;
  const { pageItems: pageNotifications, pagination: notificationsPagination } = usePagination(data.notifications);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}; review lease reminders, payment alerts, and updates.`} />
      <div className="panel overflow-hidden">
        <div className="divide-y divide-slate-200">
          {pageNotifications.map((item) => (
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
                }} className="font-medium text-purple-700">Mark read</button>}
              </div>
            </div>
          ))}
        </div>
        {notificationsPagination}
      </div>
    </div>
  );
}

function ActivityLogPage() {
  const { data } = useWorkspace();
  const [entityFilter, setEntityFilter] = useState('all');
  const visibleEvents = data.auditLog.filter((event) => entityFilter === 'all' || event.entityName === entityFilter);
  const { pageItems: pageEvents, pagination: eventsPagination } = usePagination(visibleEvents, entityFilter);
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
                {pageEvents.map((event) => (
                  <tr key={event.id} className="border-t border-slate-200">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(event.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge label={event.action} /></td>
                    <td className="px-4 py-3 text-slate-700">{event.entityName}</td>
                    <td className="px-4 py-3 text-slate-600">{event.recordId || '—'}</td>
                    <td className="px-4 py-3">
                      <details><summary className="cursor-pointer font-medium text-purple-700">View payload</summary><pre className="mt-2 max-w-md overflow-auto rounded-lg bg-purple-50 p-2 text-xs text-slate-700">{JSON.stringify({ oldValues: event.oldValues, newValues: event.newValues }, null, 2)}</pre></details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {eventsPagination}
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
  const { pageItems: pagePayments, pagination: paymentsPagination } = usePagination(data.paymentHistory);
  const { pageItems: pageMaintenance, pagination: maintenancePagination } = usePagination(data.tenantMaintenance);

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
            {pagePayments.map((item) => (
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
          {paymentsPagination}
        </div>

        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Maintenance status</h3>
          <div className="mt-4 space-y-3">
            {pageMaintenance.map((item) => (
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
          {maintenancePagination}
        </div>
      </div>
    </div>
  );
}

function TenantRentalsPage() {
  const { data, refresh } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [missingModalUnit, setMissingModalUnit] = useState(null);
  const [missingItems, setMissingItems] = useState([]);
  const [applyModalUnit, setApplyModalUnit] = useState(null);
  const [moveInDate, setMoveInDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { pageItems: pageUnits, pagination: unitsPagination } = usePagination(data.units);

  const handleApplyClick = (unit) => {
    const missing = getMissingTenantInfo(data.profile);
    if (missing.length > 0) {
      setMissingModalUnit(unit);
      setMissingItems(missing);
      return;
    }
    setApplyModalUnit(unit);
    setMoveInDate('');
    setSubmitError('');
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    if (!applyModalUnit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.post('/applications', {
        unit_id: Number(applyModalUnit.id),
        desired_move_in_date: moveInDate || null,
      });
      refresh();
      setApplyModalUnit(null);
      navigate(user?.role === 'tenant' ? '/tenant/applications' : '/applicant/applications');
    } catch (err) {
      setSubmitError(err.message || 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Available rentals" subtitle="Browse vacant units, photos, and details from participating landlords." />
      {data.units.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pageUnits.map((unit) => (
              <article key={unit.id} className="panel flex flex-col overflow-hidden">
                {unit.images?.length ? (
                  <div className="grid grid-cols-2 gap-1">
                    {unit.images.map((image) => <img key={image.image_id} src={image.image_url} alt={`${unit.property} unit ${unit.unitNumber}`} className="h-40 w-full object-cover" />)}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center bg-purple-50 text-sm text-slate-500">No photos available</div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-purple-700">{unit.property}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">Unit {unit.unitNumber}</h2>
                  {unit.address && <p className="mt-1 text-sm text-slate-500">{unit.address}</p>}
                  <p className="mt-3 text-2xl font-bold text-slate-900">${unit.rent.toLocaleString()}<span className="text-sm font-normal text-slate-500"> / month</span></p>
                  <div className="mt-3 flex gap-4 text-sm text-slate-600">
                    <span>{unit.bedrooms} bed</span><span>{unit.bathrooms} bath</span>
                    {unit.unitType && <span>{unit.unitType}</span>}
                  </div>
                  {unit.description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{unit.description}</p>}
                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => handleApplyClick(unit)}
                      className="primary-btn w-full"
                    >
                      Apply for this home
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {unitsPagination}
        </>
      ) : <EmptyState title="No available rentals" description="There are no vacant units listed right now. Check back later." />}

      {missingModalUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setMissingModalUnit(null);
        }}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="missing-info-rentals">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="missing-info-rentals" className="text-lg font-bold text-slate-900">Missing information required</h3>
                <p className="text-xs text-slate-500">{missingModalUnit.property} · Unit {missingModalUnit.unitNumber}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Before submitting an application for this home, please fill out your missing tenant information and upload required supporting documents.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Please provide the following:</p>
              <ul className="mt-2.5 space-y-2">
                {missingItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm text-amber-950">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-xs font-bold text-amber-800">!</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMissingModalUnit(null)}
                className="secondary-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = missingModalUnit.id;
                  setMissingModalUnit(null);
                  const dest = user?.role === 'tenant' ? '/tenant/profile' : '/applicant/profile';
                  navigate(`${dest}?unitId=${encodeURIComponent(targetId)}`);
                }}
                className="primary-btn inline-flex items-center gap-2"
              >
                Fill out <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {applyModalUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setApplyModalUnit(null);
        }}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="apply-unit-title">
            <h3 id="apply-unit-title" className="text-xl font-bold text-slate-900">Send rental application</h3>
            <p className="mt-1 text-sm text-slate-600">{applyModalUnit.property} · Unit {applyModalUnit.unitNumber} (${applyModalUnit.rent.toLocaleString()} / month)</p>
            <form onSubmit={submitApplication} className="mt-5 space-y-4">
              <div>
                <label htmlFor="modal-move-in" className="label">Desired move-in date <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  id="modal-move-in"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="field"
                />
              </div>
              {submitError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setApplyModalUnit(null)} className="secondary-btn">Cancel</button>
                <button type="submit" disabled={submitting} className="primary-btn">
                  {submitting ? 'Sending…' : 'Send application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TenantApplicationsPage() {
  const { data, refresh } = useWorkspace();
  const { pageItems: pageApplications, pagination: applicationsPagination } = usePagination(data.applicationsForTenant);

  return (
    <div className="space-y-6">
      <PageHeader title="My applications" subtitle="Track applications sent for specific rental listings." action={<NavLink className="primary-btn" to="/explore"><Search className="mr-2 h-4 w-4" /> Browse homes</NavLink>} />
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
        <p className="font-semibold">Privacy notice</p>
        <p className="mt-1">Your profile and uploaded documents are shared with a landlord when you apply to that landlord’s listing. Contact the property owner with questions about how application information is stored or retained.</p>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Listing</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Desired move-in</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>
              {data.applicationsForTenant.length ? pageApplications.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{item.propertyName || 'Rental listing'}</p><p className="text-xs text-slate-500">Unit {item.unitNumber || '—'} · Application {item.id}</p></td>
                  <td className="px-4 py-3 text-slate-600">{item.date}</td>
                  <td className="px-4 py-3 text-slate-600">{item.desiredMoveInDate}</td>
                  <td className="px-4 py-3"><StatusBadge label={humanizeStatus(item.status)} /></td>
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
              )) : <tr><td className="px-4 py-7 text-center text-slate-500" colSpan={5}>No applications yet. Browse available homes to get started.</td></tr>}
            </tbody>
          </table>
        </div>
        {applicationsPagination}
      </div>
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
  const { pageItems: pageInvoices, pagination: invoicesPagination } = usePagination(data.tenantInvoices);

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
              {pageInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{invoice.id}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.billingPeriod}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.dueDate}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">${invoice.amount}</td>
                  <td className="px-4 py-3"><StatusBadge label={invoice.status === 'partially_paid' ? 'Partial' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)} /></td>
                  <td className="px-4 py-3">{['unpaid', 'partially_paid', 'overdue'].includes(invoice.status) && <button className="text-sm font-medium text-purple-700" onClick={() => navigate('/tenant/payments')}>Pay now</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoicesPagination}
      </div>
    </div>
  );
}

function TenantPaymentsPage() {
  const { data, refresh } = useWorkspace();
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { pageItems: pageAttempts, pagination: attemptsPagination } = usePagination(data.paymentAttempts);

  // If redirected back from HitPay with status
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      // Trigger status check on pending payment attempts
      const pending = data.paymentAttempts.filter((a) => a.status === 'pending');
      if (pending.length > 0) {
        Promise.all(pending.map((p) => api.get(`/payments/${p.id}/status`)))
          .then(() => refresh())
          .catch(() => {});
      } else {
        refresh();
      }
      setMessage(statusParam === 'verify' ? 'Payment checkout completed! Verifying your payment status with HitPay…' : 'Returned from payment gateway.');
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, data.paymentAttempts, refresh]);

  const invoiceBalance = (invoice) => {
    const paid = data.paymentHistory
      .filter((payment) => String(payment.invoice_id) === String(invoice.id) && ['completed', 'refunded'].includes(payment.status))
      .reduce((total, payment) => total + Number(payment.amount) - Number(payment.refunded_amount || 0), 0);
    return Math.max(0, Number(invoice.amount) - paid);
  };
  const unpaidInvoice = data.tenantInvoices.find((invoice) => invoiceBalance(invoice) > 0);
  const pendingAttempt = unpaidInvoice && data.paymentAttempts.some((attempt) => String(attempt.invoiceId) === String(unpaidInvoice.id) && attempt.status === 'pending');
  const paymentMethodsInUi = [
    { id: 'card', label: 'HitPay Checkout (Card, GCash, QRPH, Maya)', type: 'HitPay Sandbox Live' },
    { id: 'bank_transfer', label: 'Direct Bank Transfer', type: 'Manual Reference' },
  ];
  const startPayment = async () => {
    if (!unpaidInvoice || pendingAttempt || !selectedMethod) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await api.post('/payments/initiate', {
        invoice_id: Number(unpaidInvoice.id),
        payment_method: selectedMethod,
        amount: invoiceBalance(unpaidInvoice),
      });
      refresh();
      const checkoutUrl = response.data?.checkout_url;
      if (checkoutUrl) {
        setMessage('Redirecting to HitPay secure checkout…');
        window.location.href = checkoutUrl;
      } else {
        setMessage('Payment attempt recorded. Check the payment history below.');
      }
    } catch (error) {
      setMessage(error.message || 'Unable to start payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Pay active invoices online via HitPay (Card, GCash, QRPH) or record a manual transfer."
        action={
          <button
            className="primary-btn"
            disabled={!unpaidInvoice || pendingAttempt || busy}
            title={!unpaidInvoice ? 'There are no unpaid invoices to pay.' : pendingAttempt ? 'A payment attempt is already pending for this invoice.' : undefined}
            onClick={startPayment}
          >
            {busy ? 'Connecting to HitPay…' : pendingAttempt ? 'Payment pending' : unpaidInvoice ? `Pay Invoice — PHP ${invoiceBalance(unpaidInvoice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'No balance due'}
          </button>
        }
      />
      {message && <div role="status" className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900 font-medium">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Payment method</h3>
          <p className="mt-1 text-sm text-slate-600">Choose how you want to settle your balance.</p>
          <div className="mt-4 space-y-3">
            {paymentMethodsInUi.map((method) => (
              <button key={method.id} type="button" onClick={() => setSelectedMethod(method.id)} className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${selectedMethod === method.id ? 'border-purple-600 bg-purple-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-purple-200'}`}>
                <div>
                  <p className="font-semibold text-slate-900">{method.label}</p>
                  <p className="text-xs text-purple-700 font-medium">{method.type}</p>
                </div>
                <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${selectedMethod === method.id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{selectedMethod === method.id ? 'Selected' : 'Select'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Payment history</h3>
            <button type="button" onClick={() => refresh()} className="text-xs font-semibold text-purple-700 hover:underline">Refresh status</button>
          </div>
          <div className="mt-4 space-y-3">
            {pageAttempts.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5">
                <div>
                  <p className="font-semibold text-slate-900">Attempt {item.id} · Invoice {item.invoice_number || item.invoiceId}</p>
                  <p className="text-xs text-slate-500 capitalize">{item.gateway_name ? `${item.gateway_name} (${item.method || item.paymentMethod?.replace('_', ' ')})` : (item.method || item.paymentMethod?.replace('_', ' '))}</p>
                  {item.gateway_reference && <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs">{item.gateway_reference}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">PHP {Number(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                  <StatusBadge label={item.status === 'pending' ? 'Pending' : item.status} />
                  {item.payment_status && <p className="mt-1 text-xs text-emerald-700 font-medium">Payment: {humanizeStatus(item.payment_status)}</p>}
                  {item.status === 'pending' && (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        className="text-xs font-semibold text-purple-700 hover:underline"
                        onClick={async () => {
                          try {
                            await api.get(`/payments/${item.id}/status`);
                            refresh();
                          } catch (err) {
                            window.alert(err.message);
                          }
                        }}
                      >
                        Check HitPay
                      </button>
                      <span className="text-slate-300">·</span>
                      <button className="text-xs font-medium text-rose-600 hover:underline" onClick={async () => {
                        if (!window.confirm(`Cancel pending payment attempt ${item.id}?`)) return;
                        try {
                          await api.post(`/payments/${item.id}/cancel`, {});
                          refresh();
                        } catch (error) {
                          window.alert(error.message);
                        }
                      }}>Cancel</button>
                    </div>
                  )}
                  {item.receipt_number && <button className="mt-2 block text-xs font-semibold text-purple-700 hover:underline" onClick={async () => {
                    const popup = window.open('', '_blank');
                    if (!popup) {
                      window.alert('Allow pop-ups to print the receipt.');
                      return;
                    }
                    try {
                      const response = await api.get(`/payments/${item.id}/receipt`);
                      printPaymentReceipt(response.data.receipt, popup);
                    } catch (error) {
                      popup.close();
                      window.alert(error.message);
                    }
                  }}>Print receipt · {item.receipt_number}</button>}
                </div>
              </div>
            ))}
            {!data.paymentAttempts.length && <p className="text-sm text-slate-500">No payment attempts recorded.</p>}
          </div>
          {attemptsPagination}
        </div>
      </div>
    </div>
  );
}

function TenantMaintenancePage() {
  const { data, refresh } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentLease = data.leases.find((lease) => lease.tenant === data.profile.name && lease.status === 'Active');
  const { pageItems: pageRequests, pagination: requestsPagination } = usePagination(data.tenantMaintenance);
  const fields = [
    { name: 'title', label: 'Request title', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high', 'urgent'], required: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance requests" subtitle="Submit and track maintenance issues for your current lease." action={<button className="primary-btn" disabled={!currentLease} title={!currentLease ? 'An active lease is required to submit a maintenance request.' : undefined} onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New request</button>} />
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
              {pageRequests.map((request) => (
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
        {requestsPagination}
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
  const { pageItems: pageNotifications, pagination: notificationsPagination } = usePagination(data.notifications);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="See important personal updates and mark them as read when complete." />
      <div className="panel divide-y divide-slate-200 overflow-hidden">
        {pageNotifications.map((item) => (
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
            }} className="text-sm font-medium text-purple-700">Mark read</button>}
          </div>
        ))}
      </div>
      {notificationsPagination}
    </div>
  );
}

function TenantProfilePage() {
  const { data, setData, refresh } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get('unitId');
  const justRegistered = searchParams.get('justRegistered');

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploadingType, setUploadingType] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const [desiredMoveInDate, setDesiredMoveInDate] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appError, setAppError] = useState('');

  const [profile, setProfile] = useState(() => {
    const parsedAddr = parseAddress(data.profile.currentAddress || '');
    return {
      firstName: data.profile.firstName || '',
      middleName: data.profile.middleName || '',
      lastName: data.profile.lastName || '',
      birthdate: data.profile.birthdate || '',
      email: data.profile.email || '',
      phone: data.profile.phone || '',
      country: parsedAddr.country || 'Philippines',
      city: parsedAddr.city || '',
      barangay: parsedAddr.barangay || '',
      zipCode: parsedAddr.zipCode || '',
      street: parsedAddr.street || '',
      emergencyContactName: data.profile.emergencyContactName || '',
      emergencyContactPhone: data.profile.emergencyContactPhone || '',
      employmentStatus: data.profile.employmentStatus || 'full_time',
      monthlyIncome: data.profile.monthlyIncome ?? '',
    };
  });

  useEffect(() => {
    const parsedAddr = parseAddress(data.profile.currentAddress || '');
    setProfile({
      firstName: data.profile.firstName || '',
      middleName: data.profile.middleName || '',
      lastName: data.profile.lastName || '',
      birthdate: data.profile.birthdate || '',
      email: data.profile.email || '',
      phone: data.profile.phone || '',
      country: parsedAddr.country || 'Philippines',
      city: parsedAddr.city || '',
      barangay: parsedAddr.barangay || '',
      zipCode: parsedAddr.zipCode || '',
      street: parsedAddr.street || '',
      emergencyContactName: data.profile.emergencyContactName || '',
      emergencyContactPhone: data.profile.emergencyContactPhone || '',
      employmentStatus: data.profile.employmentStatus || 'full_time',
      monthlyIncome: data.profile.monthlyIncome ?? '',
    });
  }, [data.profile]);

  const currentAddressFormatted = useMemo(() => {
    return formatAddress({
      street: profile.street,
      barangay: profile.barangay,
      city: profile.city,
      zipCode: profile.zipCode,
      country: profile.country,
    });
  }, [profile.street, profile.barangay, profile.city, profile.zipCode, profile.country]);

  const missingItems = useMemo(() => {
    return getMissingTenantInfo({
      ...data.profile,
      ...profile,
      currentAddress: currentAddressFormatted,
      documents: data.profile.documents || [],
    });
  }, [data.profile, profile, currentAddressFormatted]);

  const targetUnit = useMemo(() => {
    if (!unitId) return null;
    return data.units.find((u) => String(u.id) === String(unitId)) || null;
  }, [unitId, data.units]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const saveProfile = async (event) => {
    if (event) event.preventDefault();
    setSaveError('');
    setSaved(false);
    setSaving(true);
    try {
      const response = await api.patch('/profile', {
        first_name: profile.firstName,
        middle_name: profile.middleName,
        last_name: profile.lastName,
        birthdate: profile.birthdate,
        phone: profile.phone,
        current_address: currentAddressFormatted,
        emergency_contact_name: profile.emergencyContactName,
        emergency_contact_phone: profile.emergencyContactPhone,
        employment_status: profile.employmentStatus,
        monthly_income: profile.monthlyIncome,
      });
      const updatedUser = response.data?.user || {};
      const parsedUpdatedAddr = parseAddress(updatedUser.current_address || currentAddressFormatted);
      setData((current) => ({
        ...current,
        profile: {
          ...current.profile,
          ...updatedUser,
          firstName: updatedUser.first_name || profile.firstName,
          middleName: updatedUser.middle_name || profile.middleName,
          lastName: updatedUser.last_name || profile.lastName,
          name: updatedUser.name || [profile.firstName, profile.lastName].filter(Boolean).join(' '),
          birthdate: updatedUser.birthdate || profile.birthdate,
          phone: updatedUser.phone || profile.phone,
          currentAddress: updatedUser.current_address || currentAddressFormatted,
          emergencyContactName: updatedUser.emergency_contact_name || profile.emergencyContactName,
          emergencyContactPhone: updatedUser.emergency_contact_phone || profile.emergencyContactPhone,
          employmentStatus: updatedUser.employment_status || profile.employmentStatus,
          monthlyIncome: updatedUser.monthly_income ?? profile.monthlyIncome,
        },
      }));
      setProfile((current) => ({
        ...current,
        country: parsedUpdatedAddr.country || 'Philippines',
        city: parsedUpdatedAddr.city || '',
        barangay: parsedUpdatedAddr.barangay || '',
        zipCode: parsedUpdatedAddr.zipCode || '',
        street: parsedUpdatedAddr.street || '',
      }));
      refresh();
      setSaved(true);
    } catch (error) {
      setSaveError(error.message || 'Unable to save profile details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async (docType, file) => {
    if (!file) return;
    setUploadingType(docType);
    setUploadError('');
    setUploadSuccess('');
    const formData = new FormData();
    formData.append('document_type', docType);
    formData.append('file', file);
    try {
      const response = await api.post('/tenant-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data?.documents) {
        setData((current) => ({
          ...current,
          profile: {
            ...current.profile,
            documents: response.data.documents,
          },
        }));
      }
      refresh();
      setUploadSuccess(`Document uploaded successfully.`);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploadingType(null);
    }
  };

  const handleDocDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    setUploadError('');
    setUploadSuccess('');
    try {
      const response = await api.delete(`/tenant-documents/${documentId}`);
      if (response.data?.documents) {
        setData((current) => ({
          ...current,
          profile: {
            ...current.profile,
            documents: response.data.documents,
          },
        }));
      }
      refresh();
      setUploadSuccess('Document removed.');
    } catch (err) {
      setUploadError(err.message || 'Failed to remove document.');
    }
  };

  const handleDocDownload = async (documentId, filename) => {
    try {
      const response = await api.get(`/tenant-documents/${documentId}/download`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.alert(err.message || 'Unable to download document.');
    }
  };

  const submitApplicationForUnit = async () => {
    if (!unitId) return;
    setAppError('');
    setSubmittingApp(true);
    try {
      await api.post('/applications', {
        unit_id: Number(unitId),
        desired_move_in_date: desiredMoveInDate || null,
      });
      refresh();
      navigate(user?.role === 'tenant' ? '/tenant/applications' : '/applicant/applications');
    } catch (err) {
      setAppError(err.message || 'Unable to send application.');
    } finally {
      setSubmittingApp(false);
    }
  };

  const documentSlots = [
    {
      type: 'government_id',
      title: 'Government-issued photo ID',
      required: true,
      description: 'Driver’s license, passport, or national identity card (PDF, JPG, PNG up to 10 MB).',
    },
    {
      type: 'proof_of_income',
      title: 'Proof of income',
      required: true,
      description: 'Recent pay stub, W-2 statement, bank statement, or employment letter (PDF, JPG, PNG up to 10 MB).',
    },
    {
      type: 'reference_letter',
      title: 'Rental history or reference letter',
      required: false,
      description: 'Reference letter from a previous landlord or rental history documentation (optional).',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile & Documents"
        subtitle="Manage your personal details, income info, and supporting documents for rental applications."
      />

      {unitId && (
        <section aria-labelledby="unit-application-banner" className={`rounded-3xl border p-5 sm:p-6 shadow-sm ${missingItems.length ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${missingItems.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {missingItems.length ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {missingItems.length ? 'Action required to apply' : 'Ready to apply'}
                </span>
                <span className="text-xs text-slate-500">Unit ID: {unitId}</span>
              </div>
              <h3 id="unit-application-banner" className="text-xl font-bold text-slate-900">
                {targetUnit ? `${targetUnit.property} · Unit ${targetUnit.unitNumber}` : 'Rental home application'}
              </h3>
              <p className="text-sm text-slate-600">
                {missingItems.length
                  ? 'Please complete the missing profile details and documents below to finish submitting your application.'
                  : 'All requirements completed! Select your move-in date and send your application.'}
              </p>
            </div>
            {targetUnit && (
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">${targetUnit.rent.toLocaleString()}<span className="text-sm font-normal text-slate-500"> / mo</span></p>
                <p className="text-xs text-slate-500">{targetUnit.bedrooms} bed · {targetUnit.bathrooms} bath</p>
              </div>
            )}
          </div>

          {missingItems.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Remaining items required to apply:</p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 text-sm text-amber-950">
                {missingItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">!</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <label htmlFor="target-move-in-date" className="text-xs font-semibold text-slate-700">Desired move-in date <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  id="target-move-in-date"
                  type="date"
                  value={desiredMoveInDate}
                  onChange={(e) => setDesiredMoveInDate(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={submitApplicationForUnit}
                disabled={submittingApp}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60"
              >
                {submittingApp ? 'Submitting application…' : 'Send application now'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {appError && <p role="alert" className="mt-3 text-sm text-rose-700 font-medium">{appError}</p>}
        </section>
      )}

      {justRegistered && !unitId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Welcome to TenantFlow!</p>
          <p className="mt-1 text-xs sm:text-sm">Your account has been created. Complete your tenant details and upload your supporting documents below so you can apply to rental listings in one click.</p>
        </div>
      )}

      {!unitId && (
        <div className={`panel p-5 ${missingItems.length ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white' : 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${missingItems.length ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {missingItems.length ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {missingItems.length ? `Application readiness: ${missingItems.length} ${missingItems.length === 1 ? 'item' : 'items'} missing` : 'Application readiness: Profile complete!'}
                </h3>
                <p className="text-xs text-slate-500">
                  {missingItems.length
                    ? 'Fill out the missing details below to be eligible to apply for rental homes.'
                    : 'You are eligible to send rental applications to any available home.'}
                </p>
              </div>
            </div>
            {!missingItems.length ? (
              <NavLink to="/explore" className="primary-btn inline-flex items-center gap-2 text-xs">
                Browse available homes <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            ) : null}
          </div>
          {missingItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingItems.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="panel p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900">Supporting documents</h3>
          <p className="mt-1 text-sm text-slate-600">
            Property owners review these documents when you submit an application. PDF, JPG, or PNG · up to 10 MB each.
          </p>
        </div>

        {uploadError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{uploadError}</div>}
        {uploadSuccess && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{uploadSuccess}</div>}

        <div className="mt-5 space-y-4">
          {documentSlots.map((slot) => {
            const existingDoc = (data.profile.documents || []).find((d) => d.document_type === slot.type);
            const isUploading = uploadingType === slot.type;

            return (
              <div key={slot.type} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300 md:flex-row md:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-900">{slot.title}</span>
                    {slot.required ? (
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">Required</span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Optional</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{slot.description}</p>
                  {existingDoc && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{existingDoc.original_name}</span>
                      <span>•</span>
                      <span>{(existingDoc.file_size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>Uploaded {existingDoc.uploaded_at ? existingDoc.uploaded_at.slice(0, 10) : 'recently'}</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${existingDoc.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-800' : existingDoc.verification_status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                        {existingDoc.verification_status === 'verified' ? 'Verified' : existingDoc.verification_status === 'rejected' ? 'Rejected' : 'Pending review'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {existingDoc ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDocDownload(existingDoc.document_id, existingDoc.original_name)}
                        className="secondary-btn inline-flex items-center gap-1.5 text-xs"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                      <label className="secondary-btn inline-flex cursor-pointer items-center gap-1.5 text-xs">
                        <Upload className="h-3.5 w-3.5" /> Replace
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          disabled={isUploading}
                          onChange={(e) => handleDocUpload(slot.type, e.target.files?.[0])}
                          className="sr-only"
                        />
                      </label>
                      {!slot.required && (
                        <button
                          type="button"
                          onClick={() => handleDocDelete(existingDoc.document_id)}
                          className="rounded-xl border border-slate-200 p-2 text-rose-600 hover:bg-rose-50"
                          title="Remove document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <label className="primary-btn inline-flex cursor-pointer items-center gap-2 text-xs">
                      {isUploading ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" /> Upload document
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        disabled={isUploading}
                        onChange={(e) => handleDocUpload(slot.type, e.target.files?.[0])}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={saveProfile} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="panel p-5 sm:p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Personal information</h3>
              <p className="text-xs text-slate-500">Your legal identity and contact details.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="profile-first-name">First name <span className="text-rose-600">*</span></label>
                <input id="profile-first-name" name="firstName" required className="field" value={profile.firstName} onChange={updateField} />
              </div>
              <div>
                <label className="label" htmlFor="profile-middle-name">Middle name <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="profile-middle-name" name="middleName" className="field" value={profile.middleName} onChange={updateField} />
              </div>
              <div>
                <label className="label" htmlFor="profile-last-name">Last name <span className="text-rose-600">*</span></label>
                <input id="profile-last-name" name="lastName" required className="field" value={profile.lastName} onChange={updateField} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="profile-email">Email <span className="font-normal text-slate-400">(account login)</span></label>
                <input id="profile-email" type="email" className="field bg-slate-50" value={profile.email} readOnly />
              </div>
              <div>
                <label className="label" htmlFor="profile-birthdate">Birthdate <span className="text-rose-600">*</span></label>
                <input id="profile-birthdate" name="birthdate" type="date" required max={new Date().toISOString().slice(0, 10)} className="field" value={profile.birthdate} onChange={updateField} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="profile-phone">Phone number <span className="text-rose-600">*</span></label>
                <input id="profile-phone" name="phone" type="tel" required className="field" value={profile.phone} onChange={updateField} />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700">Current address <span className="text-rose-600">*</span></p>
                <PhilippineAddressFields
                  idPrefix="profile-addr"
                  required={true}
                  values={{
                    street: profile.street,
                    barangay: profile.barangay,
                    city: profile.city,
                    zipCode: profile.zipCode,
                    zip_code: profile.zipCode,
                    country: profile.country,
                  }}
                  onChange={(updated) => {
                    setProfile((prev) => ({
                      ...prev,
                      street: updated.street ?? prev.street,
                      barangay: updated.barangay ?? prev.barangay,
                      city: updated.city ?? prev.city,
                      zipCode: updated.zipCode || updated.zip_code || prev.zipCode,
                      country: updated.country ?? prev.country,
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel p-5 sm:p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">Emergency contact</h3>
                <p className="text-xs text-slate-500">Contact person in case of urgent rental matters.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="profile-em-name">Contact name <span className="text-rose-600">*</span></label>
                  <input id="profile-em-name" name="emergencyContactName" required className="field" value={profile.emergencyContactName} onChange={updateField} />
                </div>
                <div>
                  <label className="label" htmlFor="profile-em-phone">Contact phone <span className="text-rose-600">*</span></label>
                  <input id="profile-em-phone" name="emergencyContactPhone" type="tel" required className="field" value={profile.emergencyContactPhone} onChange={updateField} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {saveError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{saveError}</div>}
        {saved && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 font-medium">Profile details saved successfully.</div>}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="primary-btn inline-flex items-center gap-2"
          >
            {saving ? 'Saving changes…' : 'Save profile details'}
          </button>

          <button
            type="button"
            className="secondary-btn text-xs"
            onClick={() => setPasswordDialogOpen(true)}
          >
            Change account password
          </button>
        </div>
      </form>

      <FormDialog
        open={passwordDialogOpen}
        title="Change password"
        fields={[
          { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
          { name: 'newPassword', label: 'New password', type: 'password', minLength: 8, required: true },
        ]}
        initialValues={{ currentPassword: '', newPassword: '' }}
        onClose={() => setPasswordDialogOpen(false)}
        onSubmit={async (values) => {
          await changePassword(values);
          setPasswordDialogOpen(false);
        }}
      />
    </div>
  );
}

function TenantSettingsPage() {
  return <TenantProfilePage />;
}

function PreviewNotice({ loading, error }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-purple-200 bg-purple-50 text-purple-900'}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{error
        ? <><strong>Backend data unavailable:</strong> {error}</>
        : loading
          ? 'Loading live account records from the backend…'
          : <><strong>Live data:</strong> records and supported changes are saved through the backend. Payment attempts are recorded as pending; real charges require a configured payment gateway.</>}</p>
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

function FormDialog({ open, title, submitLabel = 'Save', fields, sections, initialValues, onClose, onSubmit }) {
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
        <form className="space-y-5 p-5" onSubmit={submit}>
          {(sections || [{ title: null, fields }]).map((section, sectionIndex) => (
            <div key={section.title || sectionIndex} className={section.title ? 'rounded-xl border border-slate-200 p-4' : ''}>
              {section.title && (
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Section {sectionIndex + 1}</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{section.title}</h3>
                  {section.description && <p className="mt-1 text-sm text-slate-500">{section.description}</p>}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => {
                  const options = typeof field.options === 'function' ? field.options(values) : field.options;
                  const minValue = typeof field.min === 'function' ? field.min(values) : field.min;
                  return (
                  <div key={field.name} className={field.type === 'textarea' || field.type === 'file' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`field-${field.name}`} className="label">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea id={`field-${field.name}`} required={field.required} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="field min-h-24" />
                    ) : field.type === 'multiselect' ? (
                      <select id={`field-${field.name}`} multiple value={values[field.name] ?? []} onChange={(event) => setValues((current) => ({ ...current, [field.name]: Array.from(event.target.selectedOptions).map((option) => option.value) }))} className="field min-h-28">
                        {options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : field.type === 'select' ? (
                      <select id={`field-${field.name}`} required={field.required} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => {
                        const nextValues = { ...current, [field.name]: event.target.value };
                        return field.onChangeValues ? field.onChangeValues(nextValues, event.target.value) : nextValues;
                      })} className="field">
                        <option value="">Select an option</option>
                        {options?.map((option) => {
                          const value = typeof option === 'string' ? option : option.value;
                          const label = typeof option === 'string' ? option.replaceAll('_', ' ') : option.label;
                          return <option key={value} value={value}>{label}</option>;
                        })}
                      </select>
                    ) : field.type === 'file' ? (
                      <input id={`field-${field.name}`} type="file" accept={field.accept} multiple={field.multiple} className="field file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-1.5 file:font-semibold file:text-purple-700" onChange={(event) => setValues((current) => ({ ...current, [field.name]: Array.from(event.target.files || []) }))} />
                    ) : (
                      <input
                        id={`field-${field.name}`}
                        type={field.type || 'text'}
                        required={field.required}
                        min={minValue}
                        max={field.max}
                        minLength={field.minLength}
                        step={field.type === 'number' && field.min === 0.01 ? '0.01' : undefined}
                        value={values[field.name] ?? ''}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                        className="field"
                      />
                    )}
                  </div>
                  );
                })}
                {section.renderSummary?.(values)}
              </div>
            </div>
          ))}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn">{submitLabel}</button>
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
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function SummaryCard({ label, value, delta }) {
  return (
    <div className="panel border-purple-100 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        <div className="rounded-xl bg-purple-50 p-2 text-purple-700 shadow-sm"><ChevronRight className="h-4 w-4" /></div>
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
