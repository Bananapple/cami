// ============================================================================
// Database Handshake — Multi-Tenant Schema (v2)
//
// This file is the TypeScript contract between the new multi-tenant schema
// defined in supabase/migrations-v2/ and the React application.
//
// It is hand-authored (as a "handshake") rather than generated, so it serves
// as the design specification during the migration. Once the migration is
// applied, generate the canonical types into src/integrations/supabase/types.ts
// via `supabase gen types typescript --project-id <ref>`, and use this file as
// the source of truth for semantic wrappers and domain types.
// ============================================================================

// ------------------------------
// Shared primitive aliases
// ------------------------------
export type UUID = string;
export type ISODateTime = string;   // ISO 8601, e.g. "2026-04-23T09:00:00Z"
export type ISODate = string;       // "2026-04-23"
export type TimeString = string;    // "HH:MM" studio-local
export type NOK = number;           // ore/kroner, numeric, 2dp

// ------------------------------
// Enums (match Postgres enums 1:1)
// ------------------------------
export type StudioRole = 'owner' | 'manager' | 'instructor' | 'member';

export type ClassInstanceStatus = 'scheduled' | 'cancelled' | 'completed';

export type ExceptionKind = 'cancel' | 'reschedule' | 'sub_instructor' | 'relocate';

export type BookingStatus =
  | 'pending'           // Payment initiated, awaiting provider webhook confirmation
  | 'confirmed'         // Webhook promoted — money captured
  | 'cancelled'         // User or staff cancelled
  | 'completed'         // Class finished, attended
  | 'no_show'           // Class finished, not attended
  | 'payment_failed';   // Provider reported failure

export type WaitlistStatus =
  | 'waiting'           // In queue
  | 'offered'           // Spot offered; within offer window
  | 'accepted'          // User accepted; booking created
  | 'expired'           // Offer window passed
  | 'cancelled';        // User left voluntarily

export type MembershipStatus = 'active' | 'cancelled' | 'expired';

// Payment provider identity — add new providers here + in the Postgres enum
export type PaymentProvider = 'stripe' | 'frisbii' | 'vipps';

// Canonical payment lifecycle (provider-neutral). Adapters map provider-specific
// statuses (e.g. Stripe's payment_intent.status, Frisbii's session state) into this.
export type PaymentStatus =
  | 'requires_action'    // Hosted checkout URL active; user redirected out
  | 'processing'         // User returned from provider; webhook pending
  | 'succeeded'          // Payment captured
  | 'failed'             // Declined or error
  | 'cancelled'          // User abandoned or explicitly cancelled
  | 'refunded'           // Fully refunded
  | 'partially_refunded';

// ------------------------------
// Core tenancy
// ------------------------------
// Per-studio audience segmentation thresholds. Lifecycle + frequency cutoffs
// are tunable via SegmentConfigDrawer on the Clients page; time-of-day buckets
// remain hardcoded.
export interface SegmentConfig {
  lifecycle: {
    newDays: number;
    regularDays: number;
    lapsingFromDays: number;
    lapsingToDays: number;
    lapsingMinSessions: number;
    inactiveDays: number;
    inactiveMinSessions: number;
    oneTimerCooldownDays: number;
  };
  frequency: {
    casualMin: number;   // bookings/30d ≥ casualMin → at least 'casual'
    regularMin: number;  // bookings/30d ≥ regularMin → at least 'regular'
    devoteeMin: number;  // bookings/30d ≥ devoteeMin → 'devotee'
  };
}

export interface Studio {
  id: UUID;
  slug: string;                               // subdomain routing key (e.g. "yogabrie")
  name: string;
  primary_color: string;
  logo_url: string | null;
  contact_email: string | null;
  address: string | null;                     // primary physical address (from studio_config.location)
  timezone: string;                           // IANA, e.g. "Europe/Oslo"
  currency: string;                           // ISO 4217, e.g. "NOK"
  cancellation_window_hours: number;
  waitlist_offer_window_minutes: number;
  referral_enabled: boolean;
  referral_discount_percent: number;
  segment_config: SegmentConfig;
  // Payment provider linkage lives on StudioPaymentProvider rows, not here
  is_active: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// Per-studio provider enrolment. A studio can have multiple providers configured;
// exactly one is `is_primary` at any time.
export interface StudioPaymentProvider {
  id: UUID;
  studio_id: UUID;
  provider: PaymentProvider;
  provider_account_id: string;               // Stripe acct_xxx / Frisbii merchant id / Vipps MSN
  is_primary: boolean;
  onboarded_at: ISODateTime | null;
  is_active: boolean;
  config: Record<string, unknown>;           // provider-specific JSON
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface StudioMember {
  id: UUID;
  studio_id: UUID;
  user_id: UUID;
  role: StudioRole;
  is_active: boolean;
  total_sessions: number;
  level: string;
  referral_code: string | null;
  referred_by_user_id: UUID | null;
  billing_address: Record<string, unknown> | null;
  joined_at: ISODateTime;
  deactivated_at: ISODateTime | null;
}

export interface Profile {
  id: UUID;                                   // = auth.users.id
  email: string;
  full_name: string | null;
  avatar_initials: string | null;
  phone_number: string | null;
  marketing_email_opt_in: boolean;
  marketing_sms_opt_in: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ------------------------------
// Locations & instructors
// ------------------------------
export interface Location {
  id: UUID;
  studio_id: UUID;
  name: string;
  address: string | null;
  timezone: string | null;                    // overrides studio default when set
  default_capacity: number;
  is_active: boolean;
  created_at: ISODateTime;
}

export interface Instructor {
  id: UUID;
  studio_id: UUID;
  user_id: UUID | null;                       // optional link to an auth.users row
  display_name: string;
  initials: string;
  bio: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: ISODateTime;
}

// ------------------------------
// Recurrence engine
// ------------------------------
export interface ClassTemplate {
  id: UUID;
  studio_id: UUID;
  name: string;
  description: string | null;
  level: string;
  default_duration_minutes: number;
  default_price: NOK;
  default_max_capacity: number;
  image_url: string | null;
  is_active: boolean;
  created_at: ISODateTime;
}

export interface ScheduleRule {
  id: UUID;
  studio_id: UUID;
  template_id: UUID;
  location_id: UUID;
  instructor_id: UUID;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;     // JS Date.getDay()
  start_time: TimeString;                     // studio-local HH:MM
  duration_minutes: number;
  price: NOK;
  max_capacity: number;
  effective_from: ISODate;
  effective_until: ISODate | null;
  is_active: boolean;
  created_at: ISODateTime;
}

export interface ScheduleException {
  id: UUID;
  studio_id: UUID;
  rule_id: UUID;
  exception_date: ISODate;
  kind: ExceptionKind;
  new_start_time: TimeString | null;
  new_duration_minutes: number | null;
  new_instructor_id: UUID | null;
  new_location_id: UUID | null;
  reason: string | null;
  created_by: UUID | null;
  created_at: ISODateTime;
}

export interface ClassInstance {
  id: UUID;
  studio_id: UUID;
  template_id: UUID;
  rule_id: UUID | null;                       // null for one-off (non-recurring) classes
  location_id: UUID;
  instructor_id: UUID;
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  price: NOK;
  max_capacity: number;
  status: ClassInstanceStatus;
  booked_count: number;                       // denormalized, trigger-maintained
  waitlist_offered_count: number;             // denormalized, trigger-maintained
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// Derived in the client; not a column
export interface ClassInstanceAvailability {
  class_instance_id: UUID;
  available: number;                          // max_capacity − booked_count − waitlist_offered_count
  is_full: boolean;
  has_waitlist: boolean;
}

// ------------------------------
// Bookings, payments, payment methods
// ------------------------------
export interface Booking {
  id: UUID;
  studio_id: UUID;
  class_instance_id: UUID;
  user_id: UUID;
  status: BookingStatus;
  amount_paid: NOK | null;
  payment_method_id: UUID | null;
  payment_id: UUID | null;                    // FK to payments — provider-neutral
  booked_at: ISODateTime;
  cancelled_at: ISODateTime | null;
}

// Canonical payment record. One row per charge attempt, regardless of provider.
// Provider-specific ids live in provider_session_id / provider_payment_id.
export interface Payment {
  id: UUID;
  studio_id: UUID;
  user_id: UUID;
  provider: PaymentProvider;
  provider_session_id: string | null;         // hosted checkout session ID (cs_xxx / Frisbii session)
  provider_payment_id: string | null;         // final payment ID, populated on succeeded
  provider_customer_id: string | null;
  status: PaymentStatus;
  amount: NOK;
  currency: string;                           // ISO 4217
  checkout_url: string | null;                // provider's hosted page URL
  return_url: string | null;
  description: string | null;
  refunded_amount: NOK;
  provider_refund_id: string | null;
  refund_reason: string | null;
  failure_code: string | null;
  failure_message: string | null;
  metadata: Record<string, unknown>;
  last_webhook_event_id: string | null;
  last_webhook_received_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// Provider-neutral stored payment method (card on file, Vipps agreement, etc.)
export interface PaymentMethod {
  id: UUID;
  studio_id: UUID;
  user_id: UUID;
  provider: PaymentProvider;
  provider_external_id: string;               // pm_xxx (Stripe) / Frisbii token / Vipps agreement
  brand: string | null;                       // nullable — some providers don't expose card metadata
  last4: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  created_at: ISODateTime;
}

export interface Membership {
  id: UUID;
  studio_id: UUID;
  user_id: UUID;
  plan_name: string;
  status: MembershipStatus;
  renewal_days: number;
  credits_remaining: number | null;
  valid_until: ISODate | null;
  provider: PaymentProvider | null;
  provider_subscription_id: string | null;    // sub_xxx (Stripe) / Frisbii subscription id
  created_at: ISODateTime;
}

// Webhook audit log — rows inserted by Edge Functions (service role only).
export interface PaymentWebhookEvent {
  id: UUID;
  provider: PaymentProvider;
  provider_event_id: string;                  // evt_xxx (Stripe) / Frisbii event id
  event_type: string;
  payload: Record<string, unknown>;
  payment_id: UUID | null;
  processed_at: ISODateTime | null;
  error: string | null;
  received_at: ISODateTime;
}

// ------------------------------
// Waitlists
// ------------------------------
export interface WaitlistEntry {
  id: UUID;
  studio_id: UUID;
  class_instance_id: UUID;
  user_id: UUID;
  status: WaitlistStatus;
  joined_at: ISODateTime;
  offered_at: ISODateTime | null;
  offer_expires_at: ISODateTime | null;
  resolved_at: ISODateTime | null;
  resolved_via:
    | 'user_accepted'
    | 'offer_window_expired'
    | 'user_cancelled'
    | 'staff_cancelled'
    | null;
}

// ------------------------------
// Client-side context
// ------------------------------

// Resolved once on app load from the URL (subdomain or path slug). Mutations
// that change the studios row (e.g. SegmentConfigDrawer) call refreshStudio()
// to re-fetch and re-publish to all consumers.
export interface StudioContextValue {
  studio: Studio;
  membership: StudioMember | null;            // null if user is not (yet) a member
  role: StudioRole | null;
  refreshStudio: () => Promise<void>;
}

// Runtime assertion helper used throughout hooks
export function assertStudioContext(
  ctx: StudioContextValue | null,
): asserts ctx is StudioContextValue {
  if (!ctx) throw new Error('Studio context not initialised');
}

// ------------------------------
// Edge Function contracts — provider-neutral
// ------------------------------
// The frontend never mentions a payment provider. It calls create-checkout,
// receives a checkout_url, and redirects. Provider selection happens server-side
// via studio_primary_provider().
export namespace EdgeFunctions {
  export interface CreateCheckoutRequest {
    class_instance_id: UUID;
    return_url?: string;                      // optional override; defaults to /bookings
  }
  export interface CreateCheckoutResponse {
    checkout_url: string;                     // redirect the browser here
    payment_id: UUID;
    booking_id: UUID;                         // booking inserted in 'pending' state
  }

  export interface AcceptWaitlistOfferRequest {
    waitlist_id: UUID;
  }
  export interface AcceptWaitlistOfferResponse {
    checkout_url: string;
    booking_id: UUID;
    payment_id: UUID;
  }

  export interface IssueRefundRequest {
    payment_id: UUID;
    amount?: NOK;                             // partial refund; omit for full
    reason?: string;
  }
  export interface IssueRefundResponse {
    payment_id: UUID;
    refunded_amount: NOK;
    status: PaymentStatus;
  }
}

// ------------------------------
// Provider adapter interface — implemented per provider in
// supabase/functions/_shared/providers/{stripe,frisbii,vipps}.ts
// ------------------------------
export namespace Providers {
  export interface CreateCheckoutParams {
    studio_provider_account_id: string;       // the merchant/Connect id
    amount: NOK;
    currency: string;
    description: string;
    success_url: string;
    cancel_url: string;
    metadata: Record<string, string>;         // must include our payment_id
  }

  export interface CheckoutResult {
    provider_session_id: string;              // session ID to store on payments
    checkout_url: string;                     // URL to redirect the user to
  }

  export interface CanonicalWebhookEvent {
    type:
      | 'payment.succeeded'
      | 'payment.failed'
      | 'payment.cancelled'
      | 'payment.refunded'
      | 'payment.partially_refunded'
      | 'unknown';
    provider_event_id: string;
    provider_session_id?: string;
    provider_payment_id?: string;
    amount?: NOK;
    refunded_amount?: NOK;
    failure_code?: string;
    failure_message?: string;
    raw: Record<string, unknown>;
  }

  export interface RefundParams {
    provider_payment_id: string;
    amount?: NOK;                             // partial refund
    reason?: string;
  }

  export interface RefundResult {
    provider_refund_id: string;
    refunded_amount: NOK;
  }

  // Contract every provider adapter must satisfy.
  export interface PaymentProviderAdapter {
    readonly name: PaymentProvider;
    createCheckoutSession(p: CreateCheckoutParams): Promise<CheckoutResult>;
    parseWebhookEvent(payload: string, signature: string): Promise<CanonicalWebhookEvent>;
    issueRefund(p: RefundParams): Promise<RefundResult>;
  }
}

// ------------------------------
// RPC signatures (match SQL functions exactly)
// ------------------------------
export namespace RPC {
  // Helper called implicitly via RLS, but exposed here for clarity.
  export type UserStudioIds = () => UUID[];

  export type UserHasRole = (args: {
    _studio_id: UUID;
    _roles: StudioRole[];
  }) => boolean;

  export type UserIsStaff = (args: { _studio_id: UUID }) => boolean;

  export type OfferNextWaitlistSpot = (args: {
    _class_instance_id: UUID;
  }) => UUID | null;

  export type AcceptWaitlistOffer = (args: { _waitlist_id: UUID }) => boolean;

  export type MaterializeClassInstances = (args: {
    _studio_id: UUID;
    _from: ISODate;
    _to: ISODate;
  }) => number;
}

// ------------------------------
// Supabase schema aggregation (for useQuery keys, etc.)
// ------------------------------
export type Tables = {
  studios: Studio;
  studio_members: StudioMember;
  studio_payment_providers: StudioPaymentProvider;
  profiles: Profile;
  locations: Location;
  instructors: Instructor;
  class_templates: ClassTemplate;
  schedule_rules: ScheduleRule;
  schedule_exceptions: ScheduleException;
  class_instances: ClassInstance;
  bookings: Booking;
  payments: Payment;
  payment_methods: PaymentMethod;
  payment_webhook_events: PaymentWebhookEvent;
  memberships: Membership;
  waitlists: WaitlistEntry;
};

export type TableName = keyof Tables;
