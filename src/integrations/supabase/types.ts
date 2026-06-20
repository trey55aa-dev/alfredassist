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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      custom_lists: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          items: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          items?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          items?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          client_id: string
          created_at: string
          current_value: number | null
          deadline: string | null
          done: boolean
          id: string
          last_check_in: string | null
          note: string | null
          plan_start_date: string | null
          plan_summary: string | null
          progress_log: Json | null
          quarter: string | null
          sub_steps: Json | null
          tags: string[] | null
          target: number | null
          timeframe: string
          title: string
          unit: string | null
          daily_log: Json | null
          goal_type: string | null
          relapse_log: Json | null
          streak_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          done?: boolean
          id?: string
          last_check_in?: string | null
          note?: string | null
          plan_start_date?: string | null
          plan_summary?: string | null
          progress_log?: Json | null
          quarter?: string | null
          sub_steps?: Json | null
          tags?: string[] | null
          target?: number | null
          timeframe?: string
          title: string
          unit?: string | null
          daily_log?: Json | null
          goal_type?: string | null
          relapse_log?: Json | null
          streak_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          done?: boolean
          id?: string
          last_check_in?: string | null
          note?: string | null
          plan_start_date?: string | null
          plan_summary?: string | null
          progress_log?: Json | null
          quarter?: string | null
          sub_steps?: Json | null
          tags?: string[] | null
          target?: number | null
          timeframe?: string
          title?: string
          unit?: string | null
          daily_log?: Json | null
          goal_type?: string | null
          relapse_log?: Json | null
          streak_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_state: {
        Row: {
          key: string
          updated_at: string
          user_id: string
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string
          user_id: string
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_client_id: string
          id: string
          log_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_client_id: string
          id?: string
          log_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_client_id?: string
          id?: string
          log_date?: string
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          archived: boolean
          cadence: string
          client_id: string
          created_at: string
          goal_id: string | null
          goal_increment: number | null
          id: string
          recovery_steps: string[] | null
          target: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          cadence?: string
          client_id: string
          created_at?: string
          goal_id?: string | null
          goal_increment?: number | null
          id?: string
          recovery_steps?: string[] | null
          target?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          cadence?: string
          client_id?: string
          created_at?: string
          goal_id?: string | null
          goal_increment?: number | null
          id?: string
          recovery_steps?: string[] | null
          target?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      local_events: {
        Row: {
          actual_minutes: number | null
          all_day: boolean
          calendar_color: string | null
          calendar_name: string | null
          carry_count: number | null
          client_id: string
          completed: boolean
          created_at: string
          description: string | null
          emoji: string | null
          end_at: string
          estimated_minutes: number | null
          id: string
          location: string | null
          original_date: string | null
          start_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          all_day?: boolean
          calendar_color?: string | null
          calendar_name?: string | null
          carry_count?: number | null
          client_id: string
          completed?: boolean
          created_at?: string
          description?: string | null
          emoji?: string | null
          end_at: string
          estimated_minutes?: number | null
          id?: string
          location?: string | null
          original_date?: string | null
          start_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          all_day?: boolean
          calendar_color?: string | null
          calendar_name?: string | null
          carry_count?: number | null
          client_id?: string
          completed?: boolean
          created_at?: string
          description?: string | null
          emoji?: string | null
          end_at?: string
          estimated_minutes?: number | null
          id?: string
          location?: string | null
          original_date?: string | null
          start_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
