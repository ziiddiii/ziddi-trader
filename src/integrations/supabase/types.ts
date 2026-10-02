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
      autoinvest_passkeys: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          id: string
          is_active: boolean
          max_amount: number
          min_amount: number
          return_percent: number
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          duration_days: number
          id?: string
          is_active?: boolean
          max_amount?: number
          min_amount: number
          return_percent: number
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          max_amount?: number
          min_amount?: number
          return_percent?: number
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      autoinvests: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          id: string
          matured_at: string | null
          matures_at: string
          passkey_id: string | null
          principal: number
          projected_return: number
          return_percent: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_days: number
          id?: string
          matured_at?: string | null
          matures_at: string
          passkey_id?: string | null
          principal: number
          projected_return: number
          return_percent: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          id?: string
          matured_at?: string | null
          matures_at?: string
          passkey_id?: string | null
          principal?: number
          projected_return?: number
          return_percent?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autoinvests_passkey_id_fkey"
            columns: ["passkey_id"]
            isOneToOne: false
            referencedRelation: "autoinvest_passkeys"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_name: string | null
          body: string
          category: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      deposit_settings: {
        Row: {
          account_number: string
          active_method: string
          business_name: string
          created_at: string
          crypto_enabled: boolean
          crypto_kes_per_usd: number
          id: string
          instructions: string | null
          max_deposit: number
          min_deposit: number
          mobile_enabled: boolean
          paybill_number: string
          stk_enabled: boolean
          till_business_name: string
          till_number: string
          updated_at: string
        }
        Insert: {
          account_number?: string
          active_method?: string
          business_name?: string
          created_at?: string
          crypto_enabled?: boolean
          crypto_kes_per_usd?: number
          id?: string
          instructions?: string | null
          max_deposit?: number
          min_deposit?: number
          mobile_enabled?: boolean
          paybill_number?: string
          stk_enabled?: boolean
          till_business_name?: string
          till_number?: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          active_method?: string
          business_name?: string
          created_at?: string
          crypto_enabled?: boolean
          crypto_kes_per_usd?: number
          id?: string
          instructions?: string | null
          max_deposit?: number
          min_deposit?: number
          mobile_enabled?: boolean
          paybill_number?: string
          stk_enabled?: boolean
          till_business_name?: string
          till_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          approved_at?: string | null
          channel?: string
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone: string
          status?: string
          tx_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          approved_at?: string | null
          channel?: string
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone?: string
          status?: string
          tx_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          opened_by: string
          opened_role: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          opened_by: string
          opened_role: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          opened_by?: string
          opened_role?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          avg_price: number
          company_name: string | null
          created_at: string
          id: string
          quantity: number
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_price?: number
          company_name?: string | null
          created_at?: string
          id?: string
          quantity?: number
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_price?: number
          company_name?: string | null
          created_at?: string
          id?: string
          quantity?: number
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string
          duration_hours: number
          id: string
          interest_rate: number
          max_amount: number
          min_amount: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          interest_rate?: number
          max_amount?: number
          min_amount?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          interest_rate?: number
          max_amount?: number
          min_amount?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          amount: number
          created_at: string
          duration_hours: number
          expected_return: number
          id: string
          interest_rate: number
          invested_at: string
          matures_at: string
          plan_id: string | null
          plan_name: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          duration_hours: number
          expected_return: number
          id?: string
          interest_rate: number
          invested_at?: string
          matures_at: string
          plan_id?: string | null
          plan_name: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          duration_hours?: number
          expected_return?: number
          id?: string
          interest_rate?: number
          invested_at?: string
          matures_at?: string
          plan_id?: string | null
          plan_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "investment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          created_at: string
          full_name: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string
          id_type: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number: string
          id_type: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string
          id_type?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        Insert: {
          buyer_id?: string | null
          change_percent?: number
          chat_closed_at?: string | null
          chat_closed_by?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          min_buy_amount?: number | null
          pending_at?: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name?: string | null
          status?: string
          ticker: string
        }
        Update: {
          buyer_id?: string | null
          change_percent?: number
          chat_closed_at?: string | null
          chat_closed_by?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          min_buy_amount?: number | null
          pending_at?: string | null
          price_per_share?: number
          quantity?: number
          seller_id?: string
          seller_name?: string | null
          status?: string
          ticker?: string
        }
        Relationships: []
      }
      lock_deposits: {
        Row: {
          created_at: string
          daily_rate: number
          id: string
          interest_credited: number
          lock_period_hours: number
          locked_at: string
          principal: number
          released_at: string | null
          status: string
          unlock_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_rate: number
          id?: string
          interest_credited?: number
          lock_period_hours: number
          locked_at?: string
          principal: number
          released_at?: string | null
          status?: string
          unlock_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          id?: string
          interest_credited?: number
          lock_period_hours?: number
          locked_at?: string
          principal?: number
          released_at?: string | null
          status?: string
          unlock_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lock_settings: {
        Row: {
          daily_rate: number
          id: string
          lock_period_hours: number
          max_amount: number
          min_amount: number
          updated_at: string
        }
        Insert: {
          daily_rate?: number
          id?: string
          lock_period_hours?: number
          max_amount?: number
          min_amount?: number
          updated_at?: string
        }
        Update: {
          daily_rate?: number
          id?: string
          lock_period_hours?: number
          max_amount?: number
          min_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          listing_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          listing_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          listing_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_balance_checks: {
        Row: {
          available_balance: number | null
          conversation_id: string | null
          created_at: string
          id: string
          originator_conversation_id: string | null
          raw_response: Json | null
          raw_result: Json | null
          requested_by: string | null
          reserved_balance: number | null
          result_code: string | null
          result_desc: string | null
          status: string
          uncleared_balance: number | null
          updated_at: string
          working_balance: number | null
        }
        Insert: {
          available_balance?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          originator_conversation_id?: string | null
          raw_response?: Json | null
          raw_result?: Json | null
          requested_by?: string | null
          reserved_balance?: number | null
          result_code?: string | null
          result_desc?: string | null
          status?: string
          uncleared_balance?: number | null
          updated_at?: string
          working_balance?: number | null
        }
        Update: {
          available_balance?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          originator_conversation_id?: string | null
          raw_response?: Json | null
          raw_result?: Json | null
          requested_by?: string | null
          reserved_balance?: number | null
          result_code?: string | null
          result_desc?: string | null
          status?: string
          uncleared_balance?: number | null
          updated_at?: string
          working_balance?: number | null
        }
        Relationships: []
      }
      mpesa_payouts: {
        Row: {
          amount: number
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          occasion: string | null
          originator_conversation_id: string | null
          phone: string
          raw_response: Json | null
          raw_result: Json | null
          receiver_name: string | null
          remarks: string
          result_code: string | null
          result_desc: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          occasion?: string | null
          originator_conversation_id?: string | null
          phone: string
          raw_response?: Json | null
          raw_result?: Json | null
          receiver_name?: string | null
          remarks?: string
          result_code?: string | null
          result_desc?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          occasion?: string | null
          originator_conversation_id?: string | null
          phone?: string
          raw_response?: Json | null
          raw_result?: Json | null
          receiver_name?: string | null
          remarks?: string
          result_code?: string | null
          result_desc?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          listing_id: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_content: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          media_type: string
          media_url: string
          published: boolean
          sort_order: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category: string
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          published?: boolean
          sort_order?: number
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          published?: boolean
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_id: string
          balance: number
          created_at: string
          id: string
          phone: string | null
          suspended: boolean
          username: string
        }
        Insert: {
          account_id?: string
          balance?: number
          created_at?: string
          id: string
          phone?: string | null
          suspended?: boolean
          username: string
        }
        Update: {
          account_id?: string
          balance?: number
          created_at?: string
          id?: string
          phone?: string | null
          suspended?: boolean
          username?: string
        }
        Relationships: []
      }
      promo_flashes: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          message: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          message: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          message?: string
        }
        Relationships: []
      }
      stock_settings: {
        Row: {
          default_min_buy: number
          id: string
          max_total: number
          min_total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_min_buy?: number
          id?: string
          max_total?: number
          min_total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_min_buy?: number
          id?: string
          max_total?: number
          min_total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_by_admin: boolean
          read_by_user: boolean
          sender_id: string | null
          sender_role: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_user?: boolean
          sender_id?: string | null
          sender_role: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_user?: boolean
          sender_id?: string | null
          sender_role?: string
          user_id?: string
        }
        Relationships: []
      }
      transfer_settings: {
        Row: {
          id: string
          min_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          min_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          min_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          id: string
          recipient_id: string
          recipient_label: string | null
          sender_id: string
          sender_label: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          recipient_id: string
          recipient_label?: string | null
          sender_id: string
          sender_label?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          recipient_id?: string
          recipient_label?: string | null
          sender_id?: string
          sender_label?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_tax_settings: {
        Row: {
          active_method: string
          id: string
          instructions: string
          max_withdrawal: number
          min_withdrawal: number
          paybill_account: string
          paybill_number: string
          tax_enabled: boolean
          tax_percent: number
          till_business_name: string
          till_number: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_method?: string
          id?: string
          instructions?: string
          max_withdrawal?: number
          min_withdrawal?: number
          paybill_account?: string
          paybill_number?: string
          tax_enabled?: boolean
          tax_percent?: number
          till_business_name?: string
          till_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_method?: string
          id?: string
          instructions?: string
          max_withdrawal?: number
          min_withdrawal?: number
          paybill_account?: string
          paybill_number?: string
          tax_enabled?: boolean
          tax_percent?: number
          till_business_name?: string
          till_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          status: string
          tax_paid_at: string | null
          tax_tx_code: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          destination: string
          id?: string
          method: string
          status?: string
          tax_paid_at?: string | null
          tax_tx_code?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          destination?: string
          id?: string
          method?: string
          status?: string
          tax_paid_at?: string | null
          tax_tx_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_deposit: {
        Args: { _id: string }
        Returns: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_approve_kyc: {
        Args: { _id: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string
          id_type: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_approve_payment: {
        Args: { _listing_id: string }
        Returns: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_approve_withdrawal: {
        Args: { _id: string }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          status: string
          tax_paid_at: string | null
          tax_tx_code: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_passkey: {
        Args: {
          _code: string
          _duration_days: number
          _max_amount: number
          _min_amount: number
          _return_percent: number
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          id: string
          is_active: boolean
          max_amount: number
          min_amount: number
          return_percent: number
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "autoinvest_passkeys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_credit_user_balance: {
        Args: { _amount: number; _note: string; _user_id: string }
        Returns: number
      }
      admin_list_users: {
        Args: never
        Returns: {
          balance: number
          created_at: string
          email: string
          email_confirmed_at: string
          id: string
          last_sign_in_at: string
          phone: string
          suspended: boolean
          username: string
        }[]
      }
      admin_reject_deposit: {
        Args: { _id: string; _note?: string }
        Returns: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reject_kyc: {
        Args: { _id: string; _reason: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string
          id_type: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reject_withdrawal: {
        Args: { _id: string; _reason: string }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          status: string
          tax_paid_at: string | null
          tax_tx_code: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_resolve_dispute: {
        Args: { _action: string; _id: string; _resolution: string }
        Returns: {
          created_at: string
          id: string
          listing_id: string
          opened_by: string
          opened_role: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_send_as_seller: {
        Args: { _content: string; _listing_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          listing_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_send_user_mail: {
        Args: { _body: string; _subject: string; _user_id: string }
        Returns: undefined
      }
      admin_set_tax_enabled: {
        Args: { _enabled: boolean }
        Returns: {
          active_method: string
          id: string
          instructions: string
          max_withdrawal: number
          min_withdrawal: number
          paybill_account: string
          paybill_number: string
          tax_enabled: boolean
          tax_percent: number
          till_business_name: string
          till_number: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_tax_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_user_suspended: {
        Args: { _suspended: boolean; _user_id: string }
        Returns: {
          account_id: string
          balance: number
          created_at: string
          id: string
          phone: string | null
          suspended: boolean
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_toggle_passkey: {
        Args: { _active: boolean; _id: string }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          duration_days: number
          id: string
          is_active: boolean
          max_amount: number
          min_amount: number
          return_percent: number
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "autoinvest_passkeys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_lock_settings: {
        Args: {
          _daily_rate: number
          _lock_period_hours: number
          _max_amount: number
          _min_amount: number
        }
        Returns: {
          daily_rate: number
          id: string
          lock_period_hours: number
          max_amount: number
          min_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lock_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_stock_settings:
        | {
            Args: { _max: number; _min: number }
            Returns: {
              default_min_buy: number
              id: string
              max_total: number
              min_total: number
              updated_at: string
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "stock_settings"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { _default_min_buy: number; _max: number; _min: number }
            Returns: {
              default_min_buy: number
              id: string
              max_total: number
              min_total: number
              updated_at: string
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "stock_settings"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      admin_update_tax_settings:
        | {
            Args: {
              _instructions: string
              _paybill_account: string
              _paybill_number: string
              _tax_percent: number
              _till_business_name: string
              _till_number: string
            }
            Returns: {
              active_method: string
              id: string
              instructions: string
              max_withdrawal: number
              min_withdrawal: number
              paybill_account: string
              paybill_number: string
              tax_enabled: boolean
              tax_percent: number
              till_business_name: string
              till_number: string
              updated_at: string
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "withdrawal_tax_settings"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _active_method?: string
              _instructions: string
              _paybill_account: string
              _paybill_number: string
              _tax_percent: number
              _till_business_name: string
              _till_number: string
            }
            Returns: {
              active_method: string
              id: string
              instructions: string
              max_withdrawal: number
              min_withdrawal: number
              paybill_account: string
              paybill_number: string
              tax_enabled: boolean
              tax_percent: number
              till_business_name: string
              till_number: string
              updated_at: string
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "withdrawal_tax_settings"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _active_method?: string
              _instructions: string
              _max_withdrawal?: number
              _min_withdrawal?: number
              _paybill_account: string
              _paybill_number: string
              _tax_percent: number
              _till_business_name: string
              _till_number: string
            }
            Returns: {
              active_method: string
              id: string
              instructions: string
              max_withdrawal: number
              min_withdrawal: number
              paybill_account: string
              paybill_number: string
              tax_enabled: boolean
              tax_percent: number
              till_business_name: string
              till_number: string
              updated_at: string
              updated_by: string | null
            }
            SetofOptions: {
              from: "*"
              to: "withdrawal_tax_settings"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      admin_update_transfer_settings: {
        Args: { _min: number }
        Returns: {
          id: string
          min_amount: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transfer_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      buy_bond: {
        Args: { _bond_type: string }
        Returns: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      buy_from_balance: {
        Args: { _listing_id: string; _quantity?: number }
        Returns: {
          avg_price: number
          company_name: string | null
          created_at: string
          id: string
          quantity: number
          ticker: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "holdings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_purchase: {
        Args: { _listing_id: string }
        Returns: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_listing_chat: { Args: { _listing_id: string }; Returns: undefined }
      expire_pending_and_notify: { Args: never; Returns: undefined }
      fail_crypto_deposit: {
        Args: { _payment_id: string; _reason?: string }
        Returns: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_stk_deposit: {
        Args: { _checkout_request_id: string; _reason: string }
        Returns: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_transfer_recipient: {
        Args: { _q: string }
        Returns: {
          account_id: string
          id: string
          username: string
        }[]
      }
      gen_account_id: { Args: never; Returns: string }
      get_my_balance: { Args: never; Returns: number }
      get_usernames: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invest_in_plan: {
        Args: { _amount: number; _plan_id: string }
        Returns: {
          amount: number
          created_at: string
          duration_hours: number
          expected_return: number
          id: string
          interest_rate: number
          invested_at: string
          matures_at: string
          plan_id: string | null
          plan_name: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "investments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_suspended: { Args: { _user_id: string }; Returns: boolean }
      lock_funds: {
        Args: { _amount: number }
        Returns: {
          created_at: string
          daily_rate: number
          id: string
          interest_credited: number
          lock_period_hours: number
          locked_at: string
          principal: number
          released_at: string | null
          status: string
          unlock_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lock_deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_paid: {
        Args: { _listing_id: string }
        Returns: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_withdrawal_tax_paid: {
        Args: { _id: string }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          status: string
          tax_paid_at: string | null
          tax_tx_code: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mature_autoinvest: {
        Args: { _id: string }
        Returns: {
          code: string
          created_at: string
          duration_days: number
          id: string
          matured_at: string | null
          matures_at: string
          passkey_id: string | null
          principal: number
          projected_return: number
          return_percent: number
          started_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "autoinvests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notification_email_target: { Args: { _user_id: string }; Returns: string }
      open_dispute: {
        Args: { _listing_id: string; _reason: string }
        Returns: {
          created_at: string
          id: string
          listing_id: string
          opened_by: string
          opened_role: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_shares: {
        Args: { _listing_id: string }
        Returns: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sell_from_holdings: {
        Args: { _price: number; _quantity: number; _ticker: string }
        Returns: number
      }
      settle_crypto_deposit: {
        Args: { _payment_id: string; _receipt?: string }
        Returns: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      settle_stk_deposit: {
        Args: {
          _amount?: number
          _checkout_request_id: string
          _receipt?: string
        }
        Returns: {
          admin_note: string | null
          amount: number
          approved_at: string | null
          channel: string
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          status: string
          tx_ref: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_autoinvest: {
        Args: { _amount: number; _code: string }
        Returns: {
          code: string
          created_at: string
          duration_days: number
          id: string
          matured_at: string | null
          matures_at: string
          passkey_id: string | null
          principal: number
          projected_return: number
          return_percent: number
          started_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "autoinvests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_purchase: {
        Args: { _listing_id: string }
        Returns: {
          buyer_id: string | null
          change_percent: number
          chat_closed_at: string | null
          chat_closed_by: string | null
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          min_buy_amount: number | null
          pending_at: string | null
          price_per_share: number
          quantity: number
          seller_id: string
          seller_name: string | null
          status: string
          ticker: string
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_kyc: {
        Args: {
          _full_name: string
          _id_back: string
          _id_front: string
          _id_number: string
          _id_type: string
          _selfie: string
        }
        Returns: {
          created_at: string
          full_name: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string
          id_type: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_withdrawal_tax_code: {
        Args: { _code: string; _id: string }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          status: string
          tax_paid_at: string | null
          tax_tx_code: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_funds: {
        Args: { _amount: number; _recipient: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          recipient_id: string
          recipient_label: string | null
          sender_id: string
          sender_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unlock_funds: {
        Args: { _lock_id: string }
        Returns: {
          created_at: string
          daily_rate: number
          id: string
          interest_credited: number
          lock_period_hours: number
          locked_at: string
          principal: number
          released_at: string | null
          status: string
          unlock_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lock_deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_funds: {
        Args: { _amount: number; _destination: string; _method: string }
        Returns: {
          amount: number
          created_at: string
          destination: string
          id: string
          method: string
          status: string
          tax_paid_at: string | null
          tax_tx_code: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
