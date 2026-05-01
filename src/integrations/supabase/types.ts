export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          amount_paid: number | null
          booked_at: string
          cancelled_at: string | null
          checked_in_at: string | null
          class_instance_id: string
          id: string
          payment_id: string | null
          payment_method_last4: string | null
          status: string | null
          studio_id: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          booked_at?: string
          cancelled_at?: string | null
          checked_in_at?: string | null
          class_instance_id: string
          id?: string
          payment_id?: string | null
          payment_method_last4?: string | null
          status?: string | null
          studio_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          booked_at?: string
          cancelled_at?: string | null
          checked_in_at?: string | null
          class_instance_id?: string
          id?: string
          payment_id?: string | null
          payment_method_last4?: string | null
          status?: string | null
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_instances: {
        Row: {
          booked_count: number
          created_at: string
          ends_at: string
          id: string
          instructor_id: string
          location_id: string
          max_capacity: number
          notes: string | null
          price: number
          rule_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["class_instance_status"]
          studio_id: string
          template_id: string
          time_range: unknown
          updated_at: string
          waitlist_offered_count: number
        }
        Insert: {
          booked_count?: number
          created_at?: string
          ends_at: string
          id?: string
          instructor_id: string
          location_id: string
          max_capacity: number
          notes?: string | null
          price: number
          rule_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["class_instance_status"]
          studio_id: string
          template_id: string
          time_range?: unknown
          updated_at?: string
          waitlist_offered_count?: number
        }
        Update: {
          booked_count?: number
          created_at?: string
          ends_at?: string
          id?: string
          instructor_id?: string
          location_id?: string
          max_capacity?: number
          notes?: string | null
          price?: number
          rule_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["class_instance_status"]
          studio_id?: string
          template_id?: string
          time_range?: unknown
          updated_at?: string
          waitlist_offered_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_instances_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "schedule_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      class_templates: {
        Row: {
          created_at: string
          default_duration_minutes: number
          default_max_capacity: number
          default_price: number
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          level: string
          name: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          default_duration_minutes?: number
          default_max_capacity?: number
          default_price?: number
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: string
          name: string
          studio_id: string
        }
        Update: {
          created_at?: string
          default_duration_minutes?: number
          default_max_capacity?: number
          default_price?: number
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: string
          name?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_templates_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          id: string
          image_url: string | null
          initials: string
          is_active: boolean
          studio_id: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          id?: string
          image_url?: string | null
          initials: string
          is_active?: boolean
          studio_id: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          image_url?: string | null
          initials?: string
          is_active?: boolean
          studio_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructors_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          default_capacity: number
          id: string
          is_active: boolean
          name: string
          studio_id: string
          timezone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_capacity?: number
          id?: string
          is_active?: boolean
          name: string
          studio_id: string
          timezone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          default_capacity?: number
          id?: string
          is_active?: boolean
          name?: string
          studio_id?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          credits_remaining: number | null
          id: string
          plan_name: string
          product_id: string | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          provider_subscription_id: string | null
          renewal_days: number | null
          status: string | null
          studio_id: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          credits_remaining?: number | null
          id?: string
          plan_name: string
          product_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          provider_subscription_id?: string | null
          renewal_days?: number | null
          status?: string | null
          studio_id: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          credits_remaining?: number | null
          id?: string
          plan_name?: string
          product_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          provider_subscription_id?: string | null
          renewal_days?: number | null
          status?: string | null
          studio_id?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          booking_id: string | null
          channel: string
          error: string | null
          id: string
          idempotency_key: string
          recipient: string
          sent_at: string
          studio_id: string | null
          template: string
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          channel?: string
          error?: string | null
          id?: string
          idempotency_key: string
          recipient: string
          sent_at?: string
          studio_id?: string | null
          template: string
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          recipient?: string
          sent_at?: string
          studio_id?: string | null
          template?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean | null
          last4: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_external_id: string
          studio_id: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_external_id: string
          studio_id: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_external_id?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_event_id: string
          received_at: string
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_event_id: string
          received_at?: string
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          description: string | null
          discount_code: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          last_webhook_event_id: string | null
          last_webhook_received_at: string | null
          metadata: Json
          product_id: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_customer_id: string | null
          provider_payment_id: string | null
          provider_refund_id: string | null
          provider_session_id: string | null
          refund_reason: string | null
          refunded_amount: number
          return_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          studio_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          created_at?: string
          currency: string
          description?: string | null
          discount_code?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          last_webhook_event_id?: string | null
          last_webhook_received_at?: string | null
          metadata?: Json
          product_id?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_customer_id?: string | null
          provider_payment_id?: string | null
          provider_refund_id?: string | null
          provider_session_id?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          return_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          studio_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          discount_code?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          last_webhook_event_id?: string | null
          last_webhook_received_at?: string | null
          metadata?: Json
          product_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_customer_id?: string | null
          provider_payment_id?: string | null
          provider_refund_id?: string | null
          provider_session_id?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          return_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          studio_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          billing_interval: string | null
          commitment_months: number | null
          created_at: string
          credits: number | null
          currency: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_minor: number
          provider_price_id: string | null
          requires_contact: boolean
          studio_id: string
          tag: string | null
          type: string
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          billing_interval?: string | null
          commitment_months?: number | null
          created_at?: string
          credits?: number | null
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_minor: number
          provider_price_id?: string | null
          requires_contact?: boolean
          studio_id: string
          tag?: string | null
          type: string
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          billing_interval?: string | null
          commitment_months?: number | null
          created_at?: string
          credits?: number | null
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_minor?: number
          provider_price_id?: string | null
          requires_contact?: boolean
          studio_id?: string
          tag?: string | null
          type?: string
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_initials: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          marketing_email_opt_in: boolean
          marketing_sms_opt_in: boolean
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_initials?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          marketing_email_opt_in?: boolean
          marketing_sms_opt_in?: boolean
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_initials?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          marketing_email_opt_in?: boolean
          marketing_sms_opt_in?: boolean
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          exception_date: string
          id: string
          kind: Database["public"]["Enums"]["exception_kind"]
          new_duration_minutes: number | null
          new_instructor_id: string | null
          new_location_id: string | null
          new_start_time: string | null
          reason: string | null
          rule_id: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exception_date: string
          id?: string
          kind: Database["public"]["Enums"]["exception_kind"]
          new_duration_minutes?: number | null
          new_instructor_id?: string | null
          new_location_id?: string | null
          new_start_time?: string | null
          reason?: string | null
          rule_id: string
          studio_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exception_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["exception_kind"]
          new_duration_minutes?: number | null
          new_instructor_id?: string | null
          new_location_id?: string | null
          new_start_time?: string | null
          reason?: string | null
          rule_id?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_new_instructor_id_fkey"
            columns: ["new_instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_new_location_id_fkey"
            columns: ["new_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "schedule_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_rules: {
        Row: {
          created_at: string
          day_of_week: number
          duration_minutes: number
          effective_from: string
          effective_until: string | null
          id: string
          instructor_id: string
          is_active: boolean
          location_id: string
          max_capacity: number
          price: number
          start_time: string
          studio_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          duration_minutes: number
          effective_from: string
          effective_until?: string | null
          id?: string
          instructor_id: string
          is_active?: boolean
          location_id: string
          max_capacity: number
          price: number
          start_time: string
          studio_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          effective_from?: string
          effective_until?: string | null
          id?: string
          instructor_id?: string
          is_active?: boolean
          location_id?: string
          max_capacity?: number
          price?: number
          start_time?: string
          studio_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_rules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_rules_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_config: {
        Row: {
          contact_email: string | null
          id: string
          location: string
          logo_url: string | null
          primary_color: string | null
          studio_name: string
        }
        Insert: {
          contact_email?: string | null
          id?: string
          location: string
          logo_url?: string | null
          primary_color?: string | null
          studio_name: string
        }
        Update: {
          contact_email?: string | null
          id?: string
          location?: string
          logo_url?: string | null
          primary_color?: string | null
          studio_name?: string
        }
        Relationships: []
      }
      studio_members: {
        Row: {
          billing_address: Json | null
          deactivated_at: string | null
          id: string
          is_active: boolean
          joined_at: string
          level: string
          referral_code: string | null
          referred_by_user_id: string | null
          role: Database["public"]["Enums"]["studio_role"]
          studio_id: string
          total_sessions: number
          user_id: string
        }
        Insert: {
          billing_address?: Json | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          level?: string
          referral_code?: string | null
          referred_by_user_id?: string | null
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id: string
          total_sessions?: number
          user_id: string
        }
        Update: {
          billing_address?: Json | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          level?: string
          referral_code?: string | null
          referred_by_user_id?: string | null
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id?: string
          total_sessions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_payment_providers: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          onboarded_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_account_id: string | null
          studio_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          onboarded_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_account_id?: string | null
          studio_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          onboarded_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_account_id?: string | null
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_payment_providers_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          address: string | null
          cancellation_window_hours: number
          contact_email: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string
          slug: string
          timezone: string
          updated_at: string
          waitlist_offer_window_minutes: number
        }
        Insert: {
          address?: string | null
          cancellation_window_hours?: number
          contact_email?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string
          slug: string
          timezone?: string
          updated_at?: string
          waitlist_offer_window_minutes?: number
        }
        Update: {
          address?: string | null
          cancellation_window_hours?: number
          contact_email?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string
          slug?: string
          timezone?: string
          updated_at?: string
          waitlist_offer_window_minutes?: number
        }
        Relationships: []
      }
      waitlists: {
        Row: {
          class_instance_id: string
          id: string
          joined_at: string
          offer_expires_at: string | null
          offered_at: string | null
          resolved_at: string | null
          resolved_via: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          studio_id: string
          user_id: string
        }
        Insert: {
          class_instance_id: string
          id?: string
          joined_at?: string
          offer_expires_at?: string | null
          offered_at?: string | null
          resolved_at?: string | null
          resolved_via?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          studio_id: string
          user_id: string
        }
        Update: {
          class_instance_id?: string
          id?: string
          joined_at?: string
          offer_expires_at?: string | null
          offered_at?: string | null
          resolved_at?: string | null
          resolved_via?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlists_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlists_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_waitlist_offer: {
        Args: { _waitlist_id: string }
        Returns: boolean
      }
      activate_membership: {
        Args: { p_payment_id: string; p_provider_subscription_id?: string }
        Returns: string
      }
      cancel_membership_by_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      confirm_booking: { Args: { p_payment_id: string }; Returns: undefined }
      expire_stale_waitlist_offers: { Args: never; Returns: number }
      increment_user_sessions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      materialize_class_instances: {
        Args: { _from: string; _studio_id: string; _to: string }
        Returns: number
      }
      offer_next_waitlist_spot: {
        Args: { _class_instance_id: string }
        Returns: string
      }
      refund_booking: { Args: { p_payment_id: string }; Returns: undefined }
      renew_membership_by_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      studio_accepts_online_payment: {
        Args: { _studio_id: string }
        Returns: boolean
      }
      studio_primary_provider: {
        Args: { _studio_id: string }
        Returns: Database["public"]["Enums"]["payment_provider"]
      }
      user_has_role: {
        Args: {
          _roles: Database["public"]["Enums"]["studio_role"][]
          _studio_id: string
        }
        Returns: boolean
      }
      user_is_staff: { Args: { _studio_id: string }; Returns: boolean }
      user_studio_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      class_instance_status: "scheduled" | "cancelled" | "completed"
      exception_kind: "cancel" | "reschedule" | "sub_instructor" | "relocate"
      payment_provider: "stripe" | "frisbii" | "vipps"
      payment_status:
        | "requires_action"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      studio_role: "owner" | "manager" | "instructor" | "member"
      waitlist_status:
        | "waiting"
        | "offered"
        | "accepted"
        | "expired"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      class_instance_status: ["scheduled", "cancelled", "completed"],
      exception_kind: ["cancel", "reschedule", "sub_instructor", "relocate"],
      payment_provider: ["stripe", "frisbii", "vipps"],
      payment_status: [
        "requires_action",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      studio_role: ["owner", "manager", "instructor", "member"],
      waitlist_status: [
        "waiting",
        "offered",
        "accepted",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
