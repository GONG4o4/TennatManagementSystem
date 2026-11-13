import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  X,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { getMissingTenantInfo, useWorkspace } from './context/WorkspaceContext';
import api from './services/apiClient';
import { usePagination } from './Pagination';

const imageUrl = (path) => {
  if (!path) return '';
  try {
    return new URL(path, api.defaults.baseURL || window.location.origin).toString();
  } catch {
    return path;
  }
};

function Rating({ value, count }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-700">
      <Star className="h-4 w-4 fill-current text-purple-500" />
      {count ? Number(value).toFixed(1) : 'New'}
      {count ? <span className="text-slate-500">({count})</span> : null}
    </span>
  );
}

export default function PublicLandingPage() {
  const { user } = useAuth();
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, review_text: '' });
  const [actionError, setActionError] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [missingModalListing, setMissingModalListing] = useState(null);
  const [missingModalItems, setMissingModalItems] = useState([]);

  const loadListings = async () => {
    try {
      const response = await api.get('/listings');
      setListings(response.data);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load available homes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    if (!selected) {
      setReviews([]);
      setActionError('');
      return;
    }

    let active = true;
    api.get(`/listings/${selected.property_id}/reviews`)
      .then((response) => {
        if (active) setReviews(response.data);
      })
      .catch((requestError) => {
        if (active) setActionError(requestError.message || 'Unable to load listing reviews.');
      });

    return () => { active = false; };
  }, [selected]);

  const visibleListings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return listings;
    return listings.filter((listing) =>
      `${listing.property_name} ${listing.address} ${listing.property_type} ${listing.unit_number}`
        .toLowerCase()
        .includes(term),
    );
  }, [listings, search]);
  const { pageItems: pageListings, pagination: listingsPagination } = usePagination(visibleListings, search);
  const { pageItems: pageReviews, pagination: reviewsPagination } = usePagination(reviews);

  const existingApplication = useMemo(() => {
    if (!selected || !user || !data.applications?.length) return null;
    return data.applications.find(
      (app) => String(app.unit_id) === String(selected.unit_id),
    ) || null;
  }, [selected, user, data.applications]);

  const applyForListing = async (listing) => {
    console.log('applyForListing called with listing:', listing);
    setActionError('');
    if (!user) {
      console.log('User not logged in, redirecting to register');
      navigate(`/register?unitId=${encodeURIComponent(listing.unit_id)}`);
      return;
    }
    if (!['applicant', 'tenant'].includes(user.role)) {
      console.log('User role not allowed:', user.role);
      setActionError('Sign in with a renter account to send an application.');
      return;
    }

    const missing = getMissingTenantInfo(data.profile);
    if (missing.length > 0) {
      console.log('Missing tenant info detected:', missing);
      setMissingModalListing(listing);
      setMissingModalItems(missing);
      return;
    }

    setSubmitting(true);
    try {
      console.log('Submitting application for unit_id:', listing.unit_id, 'moveInDate:', moveInDate);
      await api.post('/applications', {
        unit_id: Number(listing.unit_id),
        desired_move_in_date: moveInDate || null,
      });
      const dest = user.role === 'tenant' ? '/tenant/applications' : '/applicant/applications';
      console.log('Application successful, navigating to', dest);
      navigate(dest);
    } catch (requestError) {
      console.error('Application error:', requestError);
      setActionError(requestError.message || 'Unable to send your application.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setActionError('');
    setSubmitting(true);
    try {
      await api.post(`/listings/${selected.property_id}/reviews`, reviewDraft);
      setReviewDraft({ rating: 5, review_text: '' });
      await loadListings();
      const response = await api.get(`/listings/${selected.property_id}/reviews`);
      setReviews(response.data);
      setSelected((current) => current ? {
        ...current,
        average_rating: response.data.reduce((sum, review) => sum + Number(review.rating), 0) / response.data.length,
        review_count: response.data.length,
      } : current);
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to publish your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-20 border-b border-purple-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <button className="flex items-center gap-2 text-purple-700" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Building2 className="h-7 w-7" />
            <span className="text-xl font-bold tracking-tight">TenantFlow</span>
          </button>
          <div className="hidden items-center rounded-full border border-purple-200 px-2 py-1 shadow-sm sm:flex">
            <label htmlFor="listing-search" className="sr-only">Search location or property</label>
            <input
              id="listing-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-56 border-0 bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Where do you want to live?"
            />
            <button onClick={() => document.getElementById('available-homes')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full bg-purple-600 p-2 text-white hover:bg-purple-700 transition" aria-label="Search listings">
              <Search className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {user
              ? <button className="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition" onClick={() => navigate(user.role === 'landlord' ? '/landlord' : user.role === 'applicant' ? '/applicant' : '/tenant')}>My account</button>
              : <>
                <button className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition" onClick={() => navigate('/login')}>Log in</button>
                <button className="rounded-full border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 shadow-sm transition" onClick={() => navigate('/register')}>Sign up</button>
              </>}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-12 pt-10 md:pb-16 md:pt-14">
        <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-purple-100/60 p-7 md:grid-cols-[1.05fr_0.95fr] md:p-12 shadow-sm">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-purple-600">Find your next place</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">A home that feels like yours.</h1>
            <p className="mt-5 max-w-lg text-lg leading-7 text-slate-600">Explore available rentals, compare real tenant reviews, and send an application directly to the property owner.</p>
            <button onClick={() => document.getElementById('available-homes')?.scrollIntoView({ behavior: 'smooth' })} className="mt-7 inline-flex items-center gap-2 rounded-full bg-purple-700 px-6 py-3 font-semibold text-white shadow-md hover:bg-purple-800 transition">
              Explore homes <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="relative min-h-64 overflow-hidden rounded-3xl bg-gradient-to-br from-purple-200 via-purple-100 to-white md:min-h-80 border border-purple-200/50">
            {listings[0]?.images?.[0]?.image_url
              ? <img src={imageUrl(listings[0].images[0].image_url)} alt="A rental home listed on TenantFlow" className="absolute inset-0 h-full w-full object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center"><Building2 className="h-32 w-32 text-purple-300" strokeWidth={1} /></div>}
            <div className="absolute bottom-4 left-4 rounded-2xl bg-white/95 px-4 py-3 shadow-lg border border-purple-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Your next chapter</p>
              <p className="mt-1 font-semibold text-slate-900">Discover a place to call home</p>
            </div>
          </div>
        </div>
      </section>

      <section id="available-homes" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-20">
        <div className="flex flex-col justify-between gap-4 border-b border-purple-100 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-purple-600">Handpicked for you</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Available homes</h2>
          </div>
          <div className="relative sm:hidden">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-full border border-purple-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-purple-500" placeholder="Search location or property" />
          </div>
          <p className="text-sm text-slate-500">{visibleListings.length} {visibleListings.length === 1 ? 'home' : 'homes'} available</p>
        </div>

        {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {loading ? <p className="py-16 text-center text-slate-500">Finding available homes…</p>
          : visibleListings.length ? (
            <>
              <div className="mt-7 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pageListings.map((listing) => (
                  <button key={listing.unit_id} onClick={() => { setSelected(listing); setMoveInDate(''); }} className="group text-left">
                    <div className="relative aspect-[1.13/1] overflow-hidden rounded-2xl bg-purple-50">
                      {listing.images?.length
                        ? <img src={imageUrl(listing.images[0].image_url)} alt={listing.property_name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        : <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100"><Building2 className="h-20 w-20 text-purple-300" strokeWidth={1} /></div>}
                      <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-sm border border-purple-100">Available</span>
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 group-hover:text-purple-700 transition">{listing.property_name}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{listing.address}</p>
                      </div>
                      <Rating value={listing.average_rating} count={listing.review_count} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{listing.bedroom_count} beds · {listing.bathroom_count} baths · Unit {listing.unit_number}</p>
                    <p className="mt-2 text-sm"><span className="font-semibold text-slate-900">${Number(listing.monthly_rent).toLocaleString()}</span> / month</p>
                  </button>
                ))}
              </div>
              {listingsPagination}
            </>
          ) : !error ? (
            <div className="my-12 rounded-3xl border border-dashed border-purple-200 bg-purple-50/30 px-6 py-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-purple-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No homes available just yet</h3>
              <p className="mt-2 text-sm text-slate-500">{search ? 'Try another location or property name.' : 'Check back soon for new rental listings.'}</p>
            </div>
          ) : null}
      </section>

      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TenantFlow</p>
          <p>Find a place. Send an application. Make it home.</p>
        </div>
      </footer>

      {selected && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}>
          <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="listing-title">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <p className="text-sm font-medium text-slate-600">Rental listing</p>
              <button onClick={() => setSelected(null)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close listing"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                {(selected.images?.length ? selected.images.slice(0, 4) : [null]).map((image, index) => (
                  <div key={image?.image_id || index} className="h-52 overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 sm:h-60 border border-purple-100">
                    {image?.image_url ? <img src={imageUrl(image.image_url)} alt={`${selected.property_name} rental`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Building2 className="h-20 w-20 text-purple-300" strokeWidth={1} /></div>}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 id="listing-title" className="text-2xl font-semibold text-slate-900">{selected.property_name}</h2>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="h-4 w-4 text-purple-600" />{selected.address}</p>
                  <p className="mt-2 text-sm text-slate-600">{selected.business_name || `${selected.landlord_first_name} ${selected.landlord_last_name}`}</p>
                </div>
                <Rating value={selected.average_rating} count={selected.review_count} />
              </div>
              <div className="mt-5 flex flex-wrap gap-4 border-y border-slate-100 py-4 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2"><BedDouble className="h-4 w-4 text-purple-600" />{selected.bedroom_count} bedrooms</span>
                <span className="inline-flex items-center gap-2"><Bath className="h-4 w-4 text-purple-600" />{selected.bathroom_count} bathrooms</span>
                <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-purple-600" />Unit {selected.unit_number}</span>
              </div>
              <div className="mt-5">
                <h3 className="font-semibold text-slate-900">About this home</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{selected.unit_description || selected.description || 'Contact the property owner for more details about this rental.'}</p>
              </div>
              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-purple-50/60 border border-purple-100 p-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-2xl font-semibold text-slate-900">${Number(selected.monthly_rent).toLocaleString()} <span className="text-sm font-normal text-slate-500">/ month</span></p>
                  <p className="mt-1 text-sm text-slate-500">Security deposit: ${Number(selected.security_deposit || 0).toLocaleString()}</p>
                </div>
                {!existingApplication && (
                  <div className="flex flex-col gap-2 sm:items-end">
                    <label className="text-xs font-medium text-slate-600" htmlFor="move-in-date">Desired move-in date (optional)</label>
                    <input id="move-in-date" type="date" value={moveInDate} onChange={(event) => setMoveInDate(event.target.value)} className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500" />
                  </div>
                )}
              </div>
              {actionError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}

              {existingApplication ? (
                <div className="mt-5 rounded-2xl border border-purple-200 bg-purple-50/60 p-5">
                  <div className="flex items-center gap-3">
                    {existingApplication.status === 'Approved' ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    ) : existingApplication.status === 'Rejected' ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                        <XCircle className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <Clock className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">Application already submitted</p>
                      <p className="text-sm text-slate-600">You applied for this listing on {existingApplication.date || 'a previous date'}.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                      existingApplication.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : existingApplication.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {existingApplication.status === 'Approved' && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {existingApplication.status === 'Rejected' && <XCircle className="h-3.5 w-3.5" />}
                      {existingApplication.status !== 'Approved' && existingApplication.status !== 'Rejected' && <Clock className="h-3.5 w-3.5" />}
                      Status: {existingApplication.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(user.role === 'tenant' ? '/tenant/applications' : '/applicant/applications')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition"
                    >
                      View my applications <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button disabled={submitting} onClick={() => applyForListing(selected)} className="mt-5 w-full rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white shadow-md hover:bg-purple-700 transition disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? 'Sending…' : 'Send application'}
                </button>
              )}

              <div className="mt-8 border-t border-slate-100 pt-6">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-current text-purple-500" />
                  <h3 className="text-lg font-semibold">{selected.review_count ? `${Number(selected.average_rating).toFixed(1)} · ${selected.review_count} tenant ${selected.review_count === 1 ? 'review' : 'reviews'}` : 'Reviews'}</h3>
                  <ShieldCheck className="h-4 w-4 text-purple-600" aria-label="Reviews are limited to verified tenants" />
                </div>
                {user?.role === 'tenant' && (
                  <form onSubmit={submitReview} className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/20 p-4">
                    <p className="text-sm font-semibold text-slate-900">Share your experience</p>
                    <label className="mt-3 block text-sm text-slate-600" htmlFor="review-rating">Your rating</label>
                    <select id="review-rating" value={reviewDraft.rating} onChange={(event) => setReviewDraft((current) => ({ ...current, rating: Number(event.target.value) }))} className="mt-1 rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500">
                      {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} {rating === 1 ? 'star' : 'stars'}</option>)}
                    </select>
                    <label className="mt-3 block text-sm text-slate-600" htmlFor="review-text">Review</label>
                    <textarea id="review-text" required maxLength={3000} rows={3} value={reviewDraft.review_text} onChange={(event) => setReviewDraft((current) => ({ ...current, review_text: event.target.value }))} className="mt-1 w-full rounded-xl border border-purple-200 p-3 text-sm outline-none focus:border-purple-500 bg-white" placeholder="What should future renters know?" />
                    <button disabled={submitting} className="mt-3 rounded-full bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60 transition">Post review</button>
                  </form>
                )}
                <div className="mt-4 space-y-4">
                  {reviews.length ? pageReviews.map((review) => (
                    <article key={review.review_id} className="border-b border-slate-100 pb-4 last:border-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{review.reviewer_name}</p>
                        <span className="text-sm text-slate-600"><Star className="mr-1 inline h-3.5 w-3.5 fill-current text-purple-500" />{review.rating}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{review.review_text}</p>
                    </article>
                  )) : <p className="mt-3 text-sm text-slate-500">No reviews yet. Verified current or former tenants can share the first one.</p>}
                </div>
                {reviewsPagination}
              </div>
            </div>
          </section>
        </div>
      )}
      {missingModalListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMissingModalListing(null);
        }}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="missing-info-title">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="missing-info-title" className="text-lg font-bold text-slate-900">Missing information required</h3>
                <p className="text-xs text-slate-500">{missingModalListing.property_name} · Unit {missingModalListing.unit_number}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Before submitting an application for this home, please fill out your missing tenant information and upload required supporting documents.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Please provide the following:</p>
              <ul className="mt-2.5 space-y-2">
                {missingModalItems.map((item) => (
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
                onClick={() => setMissingModalListing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUnit = missingModalListing.unit_id;
                  setMissingModalListing(null);
                  setSelected(null);
                  const dest = user?.role === 'tenant' ? '/tenant/profile' : '/applicant/profile';
                  navigate(`${dest}?unitId=${encodeURIComponent(targetUnit)}`);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
              >
                Fill out <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
