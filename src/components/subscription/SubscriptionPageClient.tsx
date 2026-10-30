'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/common/Navbar';
import { API_ENDPOINTS } from '@/lib/apiConfig';
import { getDepartmentIcon } from '@/lib/departmentIcons';
import { emitExternalApiError } from '@/lib/externalApiError';
import { apiFetch } from '@/lib/apiUtil';
import { createClient } from '@/lib/supabase/client';
import { departmentCache } from '@/lib/departmentCache';
import { getMetaBrowserIds, isInternal, trackEvent } from '@/lib/metaTracking';

// ── Types ──────────────────────────────────────────────────────────────────
interface Plan {
  _id: string;
  planId: string;
  name: string;
  departmentId: string;
  price: number;
  currency: string;
  durationMonths: number;
  description: string;
  isActive: boolean;
  features: {
    accessType: string;
    includesPapers: boolean;
    includesExams: boolean;
    includesMaterials: boolean;
  };
}

interface Department {
  id: string;
  name: string;
}

interface ApiResponse {
  success: boolean;
  statusCode: number;
  data: Plan[];
}

interface Subscription {
  _id: string;
  userId: string;
  departmentId?: string;
  planId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  accessType?: string;
}

interface SubscriptionsResponse {
  success: boolean;
  statusCode: number;
  data: Subscription[];
}

interface OrderResponse {
  success: boolean;
  statusCode: number;
  message: string;
  error?: string;
  timestamp?: string;
  path?: string;
  data?: {
    orderId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    metadata: {
      departmentId: string;
      durationMonths: number;
      planId: string;
      price: number;
      userId: string;
    };
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatAmount(value: number): string {
  return value.toLocaleString('en-IN');
}

function extractDepartments(plans: Plan[]): Department[] {
  const deptMap = new Map<string, string>();
  plans.forEach((plan) => {
    if (!deptMap.has(plan.departmentId)) {
      const deptName = plan.name.split(' - ')[0];
      deptMap.set(plan.departmentId, deptName);
    }
  });
  return Array.from(deptMap.entries()).map(([id, name]) => ({ id, name }));
}

function filterPlansByDepartment(plans: Plan[], departmentId: string): Plan[] {
  return plans
    .filter((plan) => plan.departmentId === departmentId && plan.isActive)
    .sort((a, b) => a.durationMonths - b.durationMonths);
}

function computeSavings(plans: Plan[], plan: Plan): number {
  // % savings vs the shortest-duration plan's per-month price
  const base = plans.find((p) => p.durationMonths === Math.min(...plans.map((x) => x.durationMonths)));
  if (!base || base.planId === plan.planId) return 0;
  const basePerMonth = base.price / base.durationMonths;
  const thisPerMonth = plan.price / plan.durationMonths;
  const pct = Math.round(((basePerMonth - thisPerMonth) / basePerMonth) * 100);
  return pct > 0 ? pct : 0;
}

// Tiny inline check icon
const Check = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ── Main Component ─────────────────────────────────────────────────────────
export default function SubscriptionPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedDept = searchParams.get('dept')?.trim() ?? '';
  const backHref = searchParams.get('from') ?? '/departments';

  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setOrderId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [deptQuery, setDeptQuery] = useState('');
  const [userSubscriptions, setUserSubscriptions] = useState<Subscription[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = createClient();

  // Fetch plans and user subscriptions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check authentication status
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);

        // Fetch plans
        const response = await fetch(API_ENDPOINTS.PAYMENT_PLANS);
        if (!response.ok) throw new Error(`Failed to fetch plans: ${response.statusText}`);
        const apiData: ApiResponse = await response.json();
        if (!apiData.success || !apiData.data || apiData.data.length === 0) {
          throw new Error('No plans available');
        }
        setAllPlans(apiData.data);
        const depts = extractDepartments(apiData.data);
        setDepartments(depts);
        console.log('Extracted departments:', depts.map(d => ({ id: d.id, name: d.name })));

        // Fetch user subscriptions if authenticated
        if (user) {
          try {
            const subsResponse: SubscriptionsResponse = await apiFetch(API_ENDPOINTS.USER_SUBSCRIPTIONS);
            console.log('Subscriptions API Response:', subsResponse);
            if (subsResponse.success && subsResponse.data) {
              // The API returns all active subscriptions, no need to filter
              console.log('All Subscriptions from API:', subsResponse.data);
              setUserSubscriptions(subsResponse.data);
            }
          } catch (subsError) {
            console.error('Error fetching subscriptions:', subsError);
            // Don't fail the whole page if subscriptions fetch fails
          }
        }

        if (preselectedDept) {
          const matched = depts.find((d) => d.id.toLowerCase() === preselectedDept.toLowerCase());
          setSelectedDepartmentId(matched?.id ?? depts[0]?.id ?? '');
        } else if (depts.length > 0) {
          setSelectedDepartmentId(depts[0].id);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Unable to load subscription plans. Please try again later.');
        emitExternalApiError();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [preselectedDept]);

  const availablePlans = useMemo(
    () => (selectedDepartmentId ? filterPlansByDepartment(allPlans, selectedDepartmentId) : []),
    [allPlans, selectedDepartmentId]
  );

  useEffect(() => {
    if (availablePlans.length > 0) {
      const exists = availablePlans.some((p) => p.planId === selectedPlanId);
      if (!exists) setSelectedPlanId(availablePlans[0].planId);
    }
  }, [availablePlans, selectedPlanId]);

  useEffect(() => {
    if (subscribeError) setSubscribeError(null);
  }, [selectedPlanId]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId) || null,
    [departments, selectedDepartmentId]
  );
  const selectedPlan = useMemo(
    () => availablePlans.find((p) => p.planId === selectedPlanId) || null,
    [availablePlans, selectedPlanId]
  );

  const filteredDepartments = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
  }, [departments, deptQuery]);

  // Check if a department has an active subscription
  const hasActiveSubscription = (departmentId: string): boolean => {
    if (!isAuthenticated) {
      console.log(`Not authenticated, returning false for ${departmentId}`);
      return false;
    }

    console.log(`Checking subscription for department: "${departmentId}"`);
    console.log('Available subscriptions:', userSubscriptions);

    // Check if any subscription matches this department
    const hasSubscription = userSubscriptions.some(sub => {
      console.log(`Comparing sub.departmentId: "${sub.departmentId}" with "${departmentId}"`);
      return sub.departmentId === departmentId;
    });

    console.log(`Result for ${departmentId}: ${hasSubscription}`);
    return hasSubscription;
  };

  // ── Subscribe handler (unchanged business logic) ──────────────────────────
  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/auth/signin?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    setSubscribing(true);
    setSubscribeError(null);

    try {
      const response: OrderResponse = await apiFetch(API_ENDPOINTS.PAYMENT_ORDER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // fbp/fbc/internal let the API send a matched server-side InitiateCheckout and Purchase
        body: JSON.stringify({
          planId: selectedPlan.planId,
          metadata: { ...getMetaBrowserIds(), ...(isInternal() ? { internal: true } : {}) },
        }),
      });

      if (!response.success) {
        setSubscribeError(response.message || 'Something went wrong. Please try again.');
        setSubscribing(false);
        return;
      }
      if (!response.data?.orderId) throw new Error('Invalid response from server');

      const { orderId: razorpayOrderId, amount, currency } = response.data;
      setOrderId(razorpayOrderId);
      // Browser copy; the API sends the server copy with the same event id (the order id).
      trackEvent(
        'InitiateCheckout',
        {
          value: amount,
          currency,
          content_ids: [selectedPlan.planId],
          content_type: 'product',
          ...(selectedDepartment?.id ? { content_category: selectedDepartment.id } : {}),
          num_items: 1,
        },
        razorpayOrderId,
      );

      if (!window.Razorpay) throw new Error('Razorpay SDK not loaded');
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) throw new Error('Razorpay key not configured');

      const options = {
        key: razorpayKey,
        amount,
        currency,
        name: 'RailJEE',
        description: `${selectedDepartment?.name} - ${selectedPlan.durationMonths} Month${selectedPlan.durationMonths > 1 ? 's' : ''} Subscription`,
        order_id: razorpayOrderId,
        prefill: {
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          email: user.email || '',
          contact: user.user_metadata?.phone || '',
        },
        theme: { color: '#F97316' },
        handler: async function () {
          setPaymentSuccess(true);
          setSubscribing(false);
          
          // Store purchased department ID for optimistic update
          const purchasedDeptId = selectedDepartment?.id;
          if (purchasedDeptId) {
            sessionStorage.setItem('pending_subscription', purchasedDeptId);
          }
          
          setTimeout(() => {
            // Clear cache right before redirect to ensure fresh data fetch
            departmentCache.clear();
            router.push(`/departments?payment=success&dept=${purchasedDeptId || ''}`);
          }, 3000);
        },
        modal: {
          ondismiss: function () { setSubscribing(false); },
          escape: true,
          backdropclose: false,
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function () {
        setSubscribeError('Payment failed. Please try again.');
        setSubscribing(false);
      });
      razorpay.open();
    } catch (err: any) {
      console.error('Subscribe error:', err);
      setSubscribeError(err.message || 'Something went wrong. Please try again.');
      setSubscribing(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar variant="departments" title="Subscription Plans" subtitle="Loading plans..." backHref={backHref} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 rounded-3xl bg-white border border-stone-200" />
              <div className="h-72 rounded-3xl bg-white border border-stone-200" />
            </div>
            <div className="h-96 rounded-3xl bg-stone-900/90" />
          </div>
        </main>
      </div>
    );
  }

  // ── Success modal ─────────────────────────────────────────────────────────
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-md p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center animate-scale-up">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-100 flex items-center justify-center ring-8 ring-emerald-50">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Payment Successful</h2>
          <p className="text-stone-600 mb-1">
            Your payment for{" "}
            <span className="font-semibold text-stone-900">
              {selectedDepartment?.name} Department
            </span>{" "}
            has been received.
          </p>
          <p className="text-sm text-stone-500 mb-5">Your subscription will activate within a few moments.</p>
          <div className="inline-flex items-center gap-2 text-sm text-orange-600 font-medium">
            <Spinner /> Redirecting…
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || departments.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar variant="departments" title="Subscription Plans" subtitle="Error loading plans" backHref={backHref} />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-3xl border border-red-200 shadow-sm p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-red-600">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-stone-900 mb-2">Unable to load plans</h2>
            <p className="text-stone-600 mb-6">{error || 'Subscription plans are temporarily unavailable.'}</p>
            <Link href={backHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white font-semibold hover:bg-stone-800 transition-colors">
              Go back
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      <Navbar variant="departments" title="Subscription Plans" subtitle="Choose your department and plan" backHref={backHref} />

      {/* Mobile sticky CTA */}
      {selectedDepartment && selectedPlan && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-stone-200 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="min-w-0">
            <p className="text-[11px] text-stone-500 truncate">
              {selectedDepartment.name} · {selectedPlan.durationMonths}mo
            </p>
            <p className="text-lg font-bold text-stone-900 leading-tight">₹{formatAmount(selectedPlan.price)}</p>
          </div>
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={subscribing}
            className="flex-shrink-0 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {subscribing ? (<><Spinner /> Processing</>) : 'Subscribe Now →'}
          </button>
        </div>
      )}

      <main
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
        style={{ paddingBottom: selectedDepartment && selectedPlan ? '6rem' : undefined }}
      >
        {/* Hero */}
        <section className="mb-10 sm:mb-14 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/70 text-orange-700 text-xs font-semibold tracking-wide uppercase ring-1 ring-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Premium Access
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 tracking-tight text-balance">
            Unlock authentic papers,<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">smart practice</span>, real results.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-stone-600 leading-relaxed">
            Pick your department and plan. Cancel anytime. Bilingual content built for Indian Railway departmental exams.
          </p>

          {subscribeError && (
            <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200 lg:hidden">
              <p className="text-sm text-red-700">{subscribeError}</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* LEFT: Selection */}
          <section className="lg:col-span-3 space-y-6">
            {/* Department Selection */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <h2 className="text-lg sm:text-xl font-semibold text-stone-900">Select your department</h2>
                  </div>
                  <p className="mt-1 ml-9 text-xs sm:text-sm text-stone-500">
                    {departments.length} {departments.length === 1 ? 'department' : 'departments'} available
                  </p>
                </div>
                <div className="relative w-full sm:w-56">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={deptQuery}
                    onChange={(e) => setDeptQuery(e.target.value)}
                    placeholder="Search department"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="px-5 sm:px-6 pb-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-h-[420px] overflow-y-auto">
                {filteredDepartments.map((dept) => {
                  const isActive = selectedDepartmentId === dept.id;
                  const planCount = filterPlansByDepartment(allPlans, dept.id).length;
                  const isSubscribed = hasActiveSubscription(dept.id);
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDepartmentId(dept.id)}
                      className={`group relative rounded-2xl border p-3 sm:p-4 text-left transition-all duration-200 ${isActive
                          ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50/40 shadow-[0_8px_24px_-8px_rgba(249,115,22,0.4)]'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:-translate-y-0.5 hover:shadow-md'
                        }`}
                    >
                      {isActive && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-2.5 transition-colors ${isActive ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-700 group-hover:bg-stone-200'
                        }`}>
                        <div className="scale-90">{getDepartmentIcon(dept.id)}</div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">{dept.name}</p>
                        {isSubscribed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                            <Check className="w-2.5 h-2.5" />
                            Subscribed
                          </span>
                        ) : (
                          <p className="text-[11px] text-stone-500">{planCount} {planCount === 1 ? 'plan' : 'plans'}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filteredDepartments.length === 0 && (
                  <div className="col-span-full text-center py-8 text-sm text-stone-500">No departments match “{deptQuery}”.</div>
                )}
              </div>
            </div>

            {/* Plan Selection */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-lg sm:text-xl font-semibold text-stone-900">Choose your plan</h2>
              </div>

              {availablePlans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
                  <p className="text-sm text-stone-600">No plans available for this department yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {availablePlans.map((plan, index) => {
                    const isActive = selectedPlanId === plan.planId;
                    const isPopular = index === 1 && availablePlans.length >= 3;
                    const savings = computeSavings(availablePlans, plan);
                    return (
                      <button
                        key={plan.planId}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.planId)}
                        className={`group relative rounded-2xl border-2 p-5 pt-7 text-left transition-all duration-200 ${isActive
                            ? 'border-orange-500 bg-gradient-to-br from-orange-50/80 to-white shadow-[0_12px_32px_-12px_rgba(249,115,22,0.5)] -translate-y-0.5'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
                          }`}
                      >
                        {isPopular && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                            Most Popular
                          </span>
                        )}
                        {savings > 0 && !isPopular && (
                          <span className="absolute -top-2.5 right-3 whitespace-nowrap rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                            Save {savings}%
                          </span>
                        )}
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                          {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'}
                        </p>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-stone-900">₹{formatAmount(plan.price)}</span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1">
                          ₹{formatAmount(Math.round(plan.price / plan.durationMonths))}/month
                        </p>

                        <div className="mt-4 pt-4 border-t border-stone-100 space-y-2">
                          {plan.features.includesPapers && (
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" /> Bilingual papers
                            </div>
                          )}
                          {plan.features.includesExams && (
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" /> Practice exams
                            </div>
                          )}
                          {plan.features.includesMaterials && (
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" /> Study materials
                            </div>
                          )}
                        </div>

                        {isActive && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedPlan && selectedDepartment && (
                <div className="mt-5 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Your subscription includes {selectedPlan.durationMonths} {selectedPlan.durationMonths === 1 ? 'month' : 'months'} of full access to {selectedDepartment.name} study materials, previous year question papers, and practice examinations.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Order Summary */}
          <aside className="lg:col-span-2">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 text-white shadow-2xl">
                {/* Decorative blob */}
                <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

                <div className="relative p-6 sm:p-7">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold tracking-tight">Order Summary</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300/90 bg-orange-400/10 px-2 py-1 rounded-full ring-1 ring-orange-400/20">
                      Secure
                    </span>
                  </div>

                  {selectedDepartment && selectedPlan ? (
                    <>
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 mb-5">
                        <div className="w-11 h-11 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center">
                          <div className="scale-90">{getDepartmentIcon(selectedDepartment.id)}</div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{selectedDepartment.name}</p>
                          <p className="text-xs text-stone-400">
                            {selectedPlan.durationMonths} {selectedPlan.durationMonths === 1 ? 'month' : 'months'} access
                          </p>
                        </div>
                      </div>

                      <dl className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-stone-400">Subscription duration</dt>
                          <dd className="font-medium text-right">{selectedPlan.durationMonths} {selectedPlan.durationMonths === 1 ? 'Month' : 'Months'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-stone-400">Effective monthly cost</dt>
                          <dd className="font-medium text-right">₹{formatAmount(Math.round(selectedPlan.price / selectedPlan.durationMonths))}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-stone-400">Billing currency</dt>
                          <dd className="font-medium text-right">{selectedPlan.currency}</dd>
                        </div>
                      </dl>

                      <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                      <div className="flex items-end justify-between gap-3">
                        <span className="text-stone-400 text-sm">Total amount due</span>
                        <span className="text-3xl font-bold tracking-tight">₹{formatAmount(selectedPlan.price)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleSubscribe}
                        disabled={subscribing}
                        className="hidden lg:flex items-center justify-center gap-2 mt-6 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3.5 text-base font-semibold text-white hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {subscribing ? (<><Spinner className="h-5 w-5" /> Processing…</>) : (<>Subscribe Now <span aria-hidden>→</span></>)}
                      </button>

                      <p className="hidden lg:flex items-center justify-center gap-1.5 mt-3 text-[11px] text-stone-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        Secured by Razorpay · UPI, Cards & Netbanking supported
                      </p>

                      {subscribeError && (
                        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-400/30">
                          <p className="text-xs text-red-200">{subscribeError}</p>
                        </div>
                      )}

                      <div className="mt-6 pt-5 border-t border-white/10">
                        <p className="text-[10px] font-bold tracking-wider text-stone-400 uppercase mb-3">What&apos;s included</p>
                        <ul className="space-y-2.5">
                          {selectedPlan.features.includesPapers && (
                            <li className="flex items-start gap-2.5 text-sm text-stone-200">
                              <Check className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                              <span>Access to previous year question papers</span>
                            </li>
                          )}
                          {selectedPlan.features.includesExams && (
                            <li className="flex items-start gap-2.5 text-sm text-stone-200">
                              <Check className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                              <span>Unlimited practice examinations</span>
                            </li>
                          )}
                          {selectedPlan.features.includesMaterials && (
                            <li className="flex items-start gap-2.5 text-sm text-stone-200">
                              <Check className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                              <span>Bilingual study materials in Hindi and English</span>
                            </li>
                          )}
                          <li className="flex items-start gap-2.5 text-sm text-stone-200">
                            <Check className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                            <span>Filter by post such as JE, Senior Clerk, Technician & more</span>
                          </li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center ring-1 ring-white/10">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-stone-500">
                          <path d="M2.25 2.25a.75.75 0 000 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 00-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 000-1.5H5.378A2.25 2.25 0 017.5 15h11.218a.75.75 0 00.674-.421 60.358 60.358 0 002.96-7.228.75.75 0 00-.525-.965A60.864 60.864 0 005.68 4.509l-.232-.867A1.875 1.875 0 003.636 2.25H2.25z" />
                        </svg>
                      </div>
                      <p className="text-sm text-stone-400">Select a department and plan to view your order summary.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Instant', sub: 'Activation' },
                  { label: 'Secure', sub: 'Payments' },
                  { label: 'Bilingual', sub: 'Content' },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl bg-white border border-stone-200 px-3 py-3 text-center">
                    <p className="text-xs font-bold text-stone-900">{t.label}</p>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider">{t.sub}</p>
                  </div>
                ))}
              </div>

            </div>
          </aside>
        </div>

        {/* Help / Contact */}
        <section className="mt-14 sm:mt-20">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Have questions before subscribing?</h2>
              <p className="mt-2 text-sm sm:text-base text-stone-600">
                We typically reply within a few hours. Reach us on email or WhatsApp.
              </p>
            </div>
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
              <a
                href="mailto:railjee.official@gmail.com"
                className="group flex items-center gap-3 p-4 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-orange-300 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-stone-500">Email us</p>
                  <p className="text-sm font-semibold text-stone-900 truncate">railjee.official@gmail.com</p>
                </div>
              </a>
              <a
                href="https://wa.me/918402898092"
                target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-3 p-4 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 2C6.477 2 2 6.477 2 12c0 1.892.525 3.66 1.438 5.168L2 22l4.992-1.412A9.94 9.94 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-stone-500">WhatsApp</p>
                  <p className="text-sm font-semibold text-stone-900 truncate">+91 84028 98092</p>
                </div>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
