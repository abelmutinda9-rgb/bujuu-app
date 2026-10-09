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
      access_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          created_at: string
          device_id: string | null
          event: string
          id: string
          meta: Json | null
          subscriber_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event: string
          id?: string
          meta?: Json | null
          subscriber_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event?: string
          id?: string
          meta?: Json | null
          subscriber_id?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_seen_at: string
          platform: string | null
          revoked_at: string | null
          secret_hash: string
          subscriber_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          platform?: string | null
          revoked_at?: string | null
          secret_hash: string
          subscriber_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          platform?: string | null
          revoked_at?: string | null
          secret_hash?: string
          subscriber_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      media_cache: {
        Row: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          applied_at: string | null
          created_at: string
          device_id: string | null
          id: string
          phone: string
          provider_reference: string | null
          raw: Json | null
          reference: string
          status: string
          subscriber_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          applied_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          phone: string
          provider_reference?: string | null
          raw?: Json | null
          reference: string
          status?: string
          subscriber_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          applied_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          phone?: string
          provider_reference?: string | null
          raw?: Json | null
          reference?: string
          status?: string
          subscriber_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      playback_progress: {
        Row: {
          backdrop_path: string | null
          duration_seconds: number | null
          episode: number
          media_type: string
          poster_path: string | null
          season: number
          title: string
          tmdb_id: number
          updated_at: string
          user_id: string
          watched_seconds: number
        }
        Insert: {
          backdrop_path?: string | null
          duration_seconds?: number | null
          episode?: number
          media_type: string
          poster_path?: string | null
          season?: number
          title: string
          tmdb_id: number
          updated_at?: string
          user_id: string
          watched_seconds?: number
        }
        Update: {
          backdrop_path?: string | null
          duration_seconds?: number | null
          episode?: number
          media_type?: string
          poster_path?: string | null
          season?: number
          title?: string
          tmdb_id?: number
          updated_at?: string
          user_id?: string
          watched_seconds?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          provider: string | null
          provider_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          provider?: string | null
          provider_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          provider?: string | null
          provider_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          key: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          payout_status: string
          referral_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          payout_status?: string
          referral_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          payout_status?: string
          referral_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_ledger_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_withdrawals: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          phone: string
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          request_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          phone: string
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          request_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          phone?: string
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          request_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          payment_id: string | null
          referred_id: string
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id?: string | null
          referred_id: string
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string | null
          referred_id?: string
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduler_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token?: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          id: string
          phone: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          cancelled_at: string | null
          created_at: string
          expires_at: string
          id: string
          last_charge_attempt_at: string | null
          started_at: string
          status: string
          subscriber_id: string
        }
        Insert: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_charge_attempt_at?: string | null
          started_at?: string
          status?: string
          subscriber_id: string
        }
        Update: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_charge_attempt_at?: string | null
          started_at?: string
          status?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          episode: number | null
          id: string
          media_type: string
          poster_path: string | null
          season: number | null
          title: string
          tmdb_id: number
          user_id: string
          watched_at: string
        }
        Insert: {
          episode?: number | null
          id?: string
          media_type: string
          poster_path?: string | null
          season?: number | null
          title: string
          tmdb_id: number
          user_id: string
          watched_at?: string
        }
        Update: {
          episode?: number | null
          id?: string
          media_type?: string
          poster_path?: string | null
          season?: number | null
          title?: string
          tmdb_id?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          backdrop_path: string | null
          created_at: string
          media_type: string
          poster_path: string | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Insert: {
          backdrop_path?: string | null
          created_at?: string
          media_type: string
          poster_path?: string | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Update: {
          backdrop_path?: string | null
          created_at?: string
          media_type?: string
          poster_path?: string | null
          title?: string
          tmdb_id?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          _bucket: string
          _key: string
          _limit: number
          _window_seconds: number
        }
        Returns: boolean
      }
      referral_available_balance: {
        Args: { _user_id: string }
        Returns: number
      }
      reserve_referral_withdrawal: {
        Args: {
          _min: number
          _phone: string
          _request_key: string
          _user_id: string
        }
        Returns: {
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          phone: string
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          request_key: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
