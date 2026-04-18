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
          id: string
          payment_method_last4: string | null
          session_date: string
          session_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          booked_at?: string
          cancelled_at?: string | null
          id?: string
          payment_method_last4?: string | null
          session_date: string
          session_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          booked_at?: string
          cancelled_at?: string | null
          id?: string
          payment_method_last4?: string | null
          session_date?: string
          session_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
      memberships: {
        Row: {
          created_at: string
          credits_remaining: number | null
          id: string
          plan_name: string
          renewal_days: number | null
          status: string | null
          stripe_subscription_id: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          credits_remaining?: number | null
          id?: string
          plan_name: string
          renewal_days?: number | null
          status?: string | null
          stripe_subscription_id?: string | null
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          credits_remaining?: number | null
          id?: string
          plan_name?: string
          renewal_days?: number | null
          status?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string
          created_at: string
          expiry_month: number
          expiry_year: number
          id: string
          is_default: boolean | null
          last4: string
          stripe_payment_method_id: string | null
          user_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          expiry_month: number
          expiry_year: number
          id?: string
          is_default?: boolean | null
          last4: string
          stripe_payment_method_id?: string | null
          user_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_default?: boolean | null
          last4?: string
          stripe_payment_method_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_initials: string | null
          billing_address: Json | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          level: string | null
          referrals: number | null
          total_sessions: number | null
          updated_at: string
        }
        Insert: {
          avatar_initials?: string | null
          billing_address?: Json | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          level?: string | null
          referrals?: number | null
          total_sessions?: number | null
          updated_at?: string
        }
        Update: {
          avatar_initials?: string | null
          billing_address?: Json | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          level?: string | null
          referrals?: number | null
          total_sessions?: number | null
          updated_at?: string
        }
        Relationships: []
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
      sessions: {
        Row: {
          class_name: string
          created_at: string
          day_of_week: number[] | null
          duration: number
          id: string
          level: string
          location: string
          practitioner_initials: string
          practitioner_name: string
          price: number | null
          time: string
        }
        Insert: {
          class_name: string
          created_at?: string
          day_of_week?: number[] | null
          duration: number
          id?: string
          level: string
          location: string
          practitioner_initials: string
          practitioner_name: string
          price?: number | null
          time: string
        }
        Update: {
          class_name?: string
          created_at?: string
          day_of_week?: number[] | null
          duration?: number
          id?: string
          level?: string
          location?: string
          practitioner_initials?: string
          practitioner_name?: string
          price?: number | null
          time?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_user_sessions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
