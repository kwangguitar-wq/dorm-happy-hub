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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          bill_month: string
          bill_no: string | null
          created_at: string
          due_date: string | null
          electric_curr: number
          electric_prev: number
          electric_rate: number
          id: string
          other_fee: number
          other_note: string | null
          paid_at: string | null
          receipt_no: string | null
          rent: number
          rental_id: string | null
          room_id: string
          status: string
          tenant_user_id: string | null
          total: number
          water_curr: number
          water_prev: number
          water_rate: number
        }
        Insert: {
          bill_month: string
          bill_no?: string | null
          created_at?: string
          due_date?: string | null
          electric_curr?: number
          electric_prev?: number
          electric_rate?: number
          id?: string
          other_fee?: number
          other_note?: string | null
          paid_at?: string | null
          receipt_no?: string | null
          rent?: number
          rental_id?: string | null
          room_id: string
          status?: string
          tenant_user_id?: string | null
          total?: number
          water_curr?: number
          water_prev?: number
          water_rate?: number
        }
        Update: {
          bill_month?: string
          bill_no?: string | null
          created_at?: string
          due_date?: string | null
          electric_curr?: number
          electric_prev?: number
          electric_rate?: number
          id?: string
          other_fee?: number
          other_note?: string | null
          paid_at?: string | null
          receipt_no?: string | null
          rent?: number
          rental_id?: string | null
          room_id?: string
          status?: string
          tenant_user_id?: string | null
          total?: number
          water_curr?: number
          water_prev?: number
          water_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bills_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          ai_amount: number | null
          ai_checked_at: string | null
          ai_paid_on: string | null
          amount: number
          bill_id: string
          created_at: string
          id: string
          note: string | null
          paid_on: string
          reviewed_at: string | null
          slip_path: string | null
          status: string
          tenant_user_id: string
        }
        Insert: {
          ai_amount?: number | null
          ai_checked_at?: string | null
          ai_paid_on?: string | null
          amount?: number
          bill_id: string
          created_at?: string
          id?: string
          note?: string | null
          paid_on?: string
          reviewed_at?: string | null
          slip_path?: string | null
          status?: string
          tenant_user_id?: string
        }
        Update: {
          ai_amount?: number | null
          ai_checked_at?: string | null
          ai_paid_on?: string | null
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          note?: string | null
          paid_on?: string
          reviewed_at?: string | null
          slip_path?: string | null
          status?: string
          tenant_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      rentals: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          deposit: number
          email: string | null
          id: string
          id_card: string | null
          notes: string | null
          phone: string | null
          rate: number
          rental_type: string
          room_id: string
          status: string
          tenant_name: string
          tenant_user_id: string | null
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          deposit?: number
          email?: string | null
          id?: string
          id_card?: string | null
          notes?: string | null
          phone?: string | null
          rate?: number
          rental_type: string
          room_id: string
          status?: string
          tenant_name: string
          tenant_user_id?: string | null
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          deposit?: number
          email?: string | null
          id?: string
          id_card?: string | null
          notes?: string | null
          phone?: string | null
          rate?: number
          rental_type?: string
          room_id?: string
          status?: string
          tenant_name?: string
          tenant_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          room_id: string | null
          staff_note: string | null
          status: string
          tenant_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          room_id?: string | null
          staff_note?: string | null
          status?: string
          tenant_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          room_id?: string | null
          staff_note?: string | null
          status?: string
          tenant_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repairs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          daily_rate: number
          floor: number
          id: string
          monthly_rate: number
          notes: string | null
          room_number: string
          room_type: string
          status: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          floor?: number
          id?: string
          monthly_rate?: number
          notes?: string | null
          room_number: string
          room_type?: string
          status?: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          floor?: number
          id?: string
          monthly_rate?: number
          notes?: string | null
          room_number?: string
          room_type?: string
          status?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          electric_rate: number
          id: number
          updated_at: string
          water_rate: number
        }
        Insert: {
          electric_rate?: number
          id?: number
          updated_at?: string
          water_rate?: number
        }
        Update: {
          electric_rate?: number
          id?: number
          updated_at?: string
          water_rate?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      link_tenant: {
        Args: { _rental_id: string; _user_id: string }
        Returns: undefined
      }
      mark_bill_paid: { Args: { _bill_id: string }; Returns: string }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "staff" | "tenant"
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
      app_role: ["owner", "staff", "tenant"],
    },
  },
} as const
