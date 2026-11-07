import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/apiClient';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

const emptyWorkspace = () => ({
  properties: [],
  rentalRegulations: [],
  landlords: [],
  units: [],
  applications: [],
  criteria: [],
  screenings: [],
  leases: [],
  invoices: [],
  expenses: [],
  maintenance: [],
  tenantMaintenance: [],
  notifications: [],
  tenantInvoices: [],
  paymentAttempts: [],
  paymentHistory: [],
  profile: { name: '', email: '', phone: '', property: '', unit: '', leaseStatus: '', rent: '', dueDate: '', balance: '' },
  landlordProfile: { name: '', email: '', phone: '', businessName: '' },
  applicationsForTenant: [],
  auditLog: [],
});

const titleCase = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateOnly = (value) => value ? String(value).slice(0, 10) : '';

function mapWorkspace(role, payload) {
  const profile = payload.profile || {};
  const properties = (payload.properties || []).map((item) => ({
    ...item,
    id: item.property_id,
    name: item.property_name,
    type: item.property_type,
    rentalClassification: item.rental_classification || 'unknown',
    constructionDate: dateOnly(item.construction_date),
    status: item.property_status,
  }));
  const units = (payload.units || []).map((item) => ({
    ...item,
    id: item.unit_id,
    propertyId: item.property_id,
    property: item.property_name,
    unitNumber: item.unit_number,
    unitType: item.unit_type,
    bedrooms: Number(item.bedroom_count || 0),
    bathrooms: Number(item.bathroom_count || 0),
    rent: Number(item.monthly_rent || 0),
    deposit: Number(item.security_deposit || 0),
    status: item.unit_status,
    description: item.description || '',
    address: item.address || '',
    images: item.images || [],
  }));
  const applications = (payload.applications || []).map((item) => ({
    ...item,
    id: item.application_id,
    name: item.tenant_name || profile.name || '',
    date: dateOnly(item.application_date),
    status: titleCase(item.application_status),
    desiredMoveInDate: dateOnly(item.desired_move_in_date),
    employmentStatus: item.employment_status || '',
    monthlyIncome: Number(item.monthly_income || 0),
    reviewedBy: '',
    score: '—',
    documents: [],
  }));
  const leases = (payload.leases || []).map((item) => ({
    ...item,
    id: item.lease_id,
    applicationId: item.application_id,
    unitId: item.unit_id,
    unit: item.unit_number,
    property: item.property_name,
    tenant: item.tenant_name || profile.name || '',
    start: dateOnly(item.lease_start_date),
    end: dateOnly(item.lease_end_date),
    rent: Number(item.monthly_rent || 0),
    securityDeposit: Number(item.security_deposit || 0),
    advancePayment: Number(item.advance_payment || 0),
    paymentDueDay: Number(item.payment_due_day || 1),
    status: titleCase(item.lease_status),
  }));
  const invoices = (payload.invoices || []).map((item) => ({
    ...item,
    id: item.invoice_id,
    number: item.invoice_number,
    leaseId: item.lease_id,
    tenant: item.tenant_name || '',
    periodStart: dateOnly(item.billing_period_start),
    periodEnd: dateOnly(item.billing_period_end),
    period: dateOnly(item.billing_period_start).slice(0, 7),
    billingPeriod: dateOnly(item.billing_period_start).slice(0, 7),
    issueDate: dateOnly(item.issue_date),
    dueDate: dateOnly(item.due_date),
    amount: Number(item.total_amount || 0),
    totalAmount: Number(item.total_amount || 0),
    status: item.invoice_status,
  }));
  const expenses = (payload.expenses || []).map((item) => ({
    ...item,
    id: item.expense_id,
    property: item.property_name || '',
    category: item.expense_category,
    date: dateOnly(item.expense_date),
    amount: Number(item.amount || 0),
  }));
  const maintenance = (payload.maintenance || []).map((item) => ({
    ...item,
    id: item.request_id,
    title: item.title,
    name: item.tenant_name || profile.name || '',
    unit: item.unit_number || '',
    date: dateOnly(item.submitted_at),
    requestStatus: item.request_status,
    status: titleCase(item.request_status),
  }));
  const notifications = (payload.notifications || []).map((item) => ({
    ...item,
    id: item.notification_id,
    time: item.created_at,
    read: Boolean(Number(item.is_read)),
  }));
  const paymentAttempts = (payload.payments || []).map((item) => ({
    ...item,
    id: item.attempt_id,
    invoiceId: item.invoice_id,
    amount: Number(item.amount || 0),
    paymentMethod: item.payment_method,
    status: item.attempt_status,
    initiatedAt: item.initiated_at,
  }));
  const paymentHistory = (payload.payments || [])
    .filter((item) => item.payment_id)
    .map((item) => ({
      ...item,
      id: item.payment_id,
      date: item.payment_date,
      amount: Number(item.amount_paid || 0),
      status: item.payment_status,
      receiptNumber: item.receipt_number,
      method: item.payment_method,
    }));
  const criteria = (payload.criteria || []).map((item) => ({
    ...item,
    id: item.criteria_id,
    name: item.criteria_name,
    active: Boolean(Number(item.is_active)),
    enabled: Boolean(Number(item.is_active)),
    score: 0,
  }));
  const screenings = (payload.screenings || []).map((item) => ({
    ...item,
    id: item.result_id,
    screeningId: item.screening_id,
    applicationId: item.application_id,
    applicantName: item.tenant_name,
    criterionName: item.criteria_name,
    result: item.result_status,
    screeningStatus: item.screening_status,
    date: item.screening_date,
  }));

  return {
    ...emptyWorkspace(),
    properties,
    rentalRegulations: payload.rentalRegulations || [],
    landlords: (payload.landlords || []).map((item) => ({
      ...item,
      id: item.landlord_id,
      name: `${item.first_name} ${item.last_name}`.trim(),
      label: item.business_name ? `${item.business_name} — ${item.first_name} ${item.last_name}` : `${item.first_name} ${item.last_name}`,
    })),
    units,
    applications,
    criteria,
    screenings,
    leases,
    invoices,
    expenses,
    maintenance,
    tenantMaintenance: maintenance,
    notifications,
    tenantInvoices: invoices,
    paymentAttempts,
    paymentHistory,
    profile: {
      ...emptyWorkspace().profile,
      ...profile,
      name: profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' '),
      email: profile.email || '',
      currentAddress: profile.current_address || '',
      emergencyContactName: profile.emergency_contact_name || '',
      emergencyContactPhone: profile.emergency_contact_phone || '',
      rent: leases[0] ? `$${leases[0].rent.toLocaleString()}` : '',
      property: leases[0]?.property || '',
      unit: leases[0]?.unit || '',
      leaseStatus: leases[0]?.status || '',
      dueDate: invoices[0]?.dueDate || '',
    },
    landlordProfile: {
      name: profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' '),
      email: profile.email || '',
      phone: profile.phone || '',
      businessName: profile.business_name || '',
    },
    applicationsForTenant: ['applicant', 'tenant'].includes(role) ? applications.map((item) => ({
      ...item,
      status: String(item.application_status || '').toLowerCase(),
    })) : [],
    auditLog: (payload.audit || []).map((item) => ({
      ...item,
      id: item.audit_id,
      entityName: item.entity_name,
      recordId: item.record_id,
      oldValues: item.old_values,
      newValues: item.new_values,
      createdAt: item.created_at,
    })),
  };
}

export function WorkspaceProvider({ children }) {
  const { user, syncUser } = useAuth();
  const [data, setData] = useState(emptyWorkspace);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    localStorage.removeItem('tenant_workspace_v1');
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setData(emptyWorkspace());
      setError('');
      setLoading(false);
      return () => { active = false; };
    }

    const loadWorkspace = async () => {
      setLoading(true);
      setError('');
      try {
        const role = user.role;
        const profileResponse = await api.get('/profile');
        const profile = profileResponse.data?.user || {};
        if (profile.role && profile.role !== role) {
          syncUser({ ...user, ...profile });
          return;
        }
        const requests = role === 'applicant' ? {
          profile: Promise.resolve(profileResponse),
          applications: api.get('/applications'),
          landlords: api.get('/landlords'),
          units: api.get('/units'),
        } : {
          profile: Promise.resolve(profileResponse),
          applications: api.get('/applications'),
          leases: api.get('/leases'),
          invoices: api.get('/invoices'),
          payments: api.get('/payments'),
          maintenance: api.get('/maintenance'),
          notifications: api.get('/notifications'),
        };
        if (role === 'landlord') {
          Object.assign(requests, {
            properties: api.get('/properties'),
            rentalRegulations: api.get('/rental-regulations'),
            units: api.get('/units'),
            criteria: api.get('/screening-criteria'),
            screenings: api.get('/screenings'),
            expenses: api.get('/expenses'),
            audit: api.get('/audit-log'),
          });
        } else if (role === 'tenant') {
          requests.landlords = api.get('/landlords');
          requests.units = api.get('/units');
        }

        const entries = await Promise.all(Object.entries(requests).map(async ([key, request]) => [key, (await request).data]));
        if (!active) return;
        const payload = Object.fromEntries(entries);
        payload.profile = payload.profile?.user || {};
        setData(mapWorkspace(role, payload));
      } catch (loadError) {
        if (active) {
          setData(emptyWorkspace());
          setError(loadError.message || 'Unable to load records from the backend.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWorkspace();
    return () => { active = false; };
  }, [user, reloadVersion, syncUser]);

  const updateList = (key, updater) => {
    setData((current) => {
      const previous = current[key] || [];
      const next = typeof updater === 'function' ? updater(previous) : updater;
      return { ...current, [key]: next };
    });
  };

  const refresh = useCallback(() => setReloadVersion((version) => version + 1), []);
  const value = useMemo(() => ({ data, updateList, setData, loading, error, refresh }), [data, loading, error, refresh]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
