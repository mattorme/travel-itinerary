export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activities: {
        Row: {
          booking_url: string | null
          cost_basis: Database["public"]["Enums"]["cost_basis"]
          created_at: string
          custom_name: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          estimated_cost: number | null
          id: string
          inbound_travel: Json | null
          is_locked: boolean
          kind: Database["public"]["Enums"]["activity_kind"]
          order_index: number
          place_id: string | null
          reason: string | null
          source: Database["public"]["Enums"]["activity_source"]
          start_time: string | null
          title: string
          trip_day_id: string
          updated_at: string
        }
        Insert: {
          booking_url?: string | null
          cost_basis?: Database["public"]["Enums"]["cost_basis"]
          created_at?: string
          custom_name?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          estimated_cost?: number | null
          id?: string
          inbound_travel?: Json | null
          is_locked?: boolean
          kind?: Database["public"]["Enums"]["activity_kind"]
          order_index: number
          place_id?: string | null
          reason?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          start_time?: string | null
          title: string
          trip_day_id: string
          updated_at?: string
        }
        Update: {
          booking_url?: string | null
          cost_basis?: Database["public"]["Enums"]["cost_basis"]
          created_at?: string
          custom_name?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          estimated_cost?: number | null
          id?: string
          inbound_travel?: Json | null
          is_locked?: boolean
          kind?: Database["public"]["Enums"]["activity_kind"]
          order_index?: number
          place_id?: string | null
          reason?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          start_time?: string | null
          title?: string
          trip_day_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          cached_tokens: number
          cost_usd: number
          created_at: string
          error_code: string | null
          id: string
          input_tokens: number
          job_id: string | null
          latency_ms: number | null
          model: string
          ok: boolean
          output_tokens: number
          provider: string
          reasoning_tokens: number
          stage: string
          trip_id: string | null
        }
        Insert: {
          cached_tokens?: number
          cost_usd?: number
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number
          job_id?: string | null
          latency_ms?: number | null
          model: string
          ok?: boolean
          output_tokens?: number
          provider?: string
          reasoning_tokens?: number
          stage: string
          trip_id?: string | null
        }
        Update: {
          cached_tokens?: number
          cost_usd?: number
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number
          job_id?: string | null
          latency_ms?: number | null
          model?: string
          ok?: boolean
          output_tokens?: number
          provider?: string
          reasoning_tokens?: number
          stage?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          job_id: string | null
          provider: Database["public"]["Enums"]["api_provider"]
          sku: string
          trip_id: string | null
          units: number
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          job_id?: string | null
          provider: Database["public"]["Enums"]["api_provider"]
          sku: string
          trip_id?: string | null
          units?: number
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          job_id?: string | null
          provider?: Database["public"]["Enums"]["api_provider"]
          sku?: string
          trip_id?: string | null
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          parent_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          parent_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          parent_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          bbox: Json | null
          blurb: string | null
          cost_index: number
          country_code: string
          country_name: string
          created_at: string
          currency: string | null
          google_place_id: string | null
          hero_credit: Json | null
          hero_image_url: string | null
          id: string
          is_curated: boolean
          kind: Database["public"]["Enums"]["destination_kind"]
          lat: number
          lng: number
          name: string
          parent_id: string | null
          slug: string
          timezone: string
          trip_count: number
          updated_at: string
        }
        Insert: {
          bbox?: Json | null
          blurb?: string | null
          cost_index?: number
          country_code: string
          country_name: string
          created_at?: string
          currency?: string | null
          google_place_id?: string | null
          hero_credit?: Json | null
          hero_image_url?: string | null
          id?: string
          is_curated?: boolean
          kind: Database["public"]["Enums"]["destination_kind"]
          lat: number
          lng: number
          name: string
          parent_id?: string | null
          slug: string
          timezone: string
          trip_count?: number
          updated_at?: string
        }
        Update: {
          bbox?: Json | null
          blurb?: string | null
          cost_index?: number
          country_code?: string
          country_name?: string
          created_at?: string
          currency?: string | null
          google_place_id?: string | null
          hero_credit?: Json | null
          hero_image_url?: string | null
          id?: string
          is_curated?: boolean
          kind?: Database["public"]["Enums"]["destination_kind"]
          lat?: number
          lng?: number
          name?: string
          parent_id?: string | null
          slug?: string
          timezone?: string
          trip_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          as_of: string
          base: string
          quote: string
          rate: number
        }
        Insert: {
          as_of: string
          base: string
          quote: string
          rate: number
        }
        Update: {
          as_of?: string
          base?: string
          quote?: string
          rate?: number
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          attempt: number
          created_at: string
          error: Json | null
          finished_at: string | null
          id: string
          input: Json
          progress: number
          requester_id: string
          stage: string | null
          stage_history: Json
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          error?: Json | null
          finished_at?: string | null
          id?: string
          input: Json
          progress?: number
          requester_id: string
          stage?: string | null
          stage_history?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: Json | null
          finished_at?: string | null
          id?: string
          input?: Json
          progress?: number
          requester_id?: string
          stage?: string | null
          stage_history?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      place_cache: {
        Row: {
          business_status: string | null
          display_name: string | null
          editorial_summary: string | null
          expires_at: string
          fetched_at: string
          formatted_address: string | null
          google_maps_uri: string | null
          lat: number | null
          lng: number | null
          opening_hours: Json | null
          payload: Json | null
          photo_names: string[] | null
          place_id: string
          price_level: string | null
          price_range: Json | null
          rating: number | null
          user_rating_count: number | null
          website_uri: string | null
        }
        Insert: {
          business_status?: string | null
          display_name?: string | null
          editorial_summary?: string | null
          expires_at: string
          fetched_at?: string
          formatted_address?: string | null
          google_maps_uri?: string | null
          lat?: number | null
          lng?: number | null
          opening_hours?: Json | null
          payload?: Json | null
          photo_names?: string[] | null
          place_id: string
          price_level?: string | null
          price_range?: Json | null
          rating?: number | null
          user_rating_count?: number | null
          website_uri?: string | null
        }
        Update: {
          business_status?: string | null
          display_name?: string | null
          editorial_summary?: string | null
          expires_at?: string
          fetched_at?: string
          formatted_address?: string | null
          google_maps_uri?: string | null
          lat?: number | null
          lng?: number | null
          opening_hours?: Json | null
          payload?: Json | null
          photo_names?: string[] | null
          place_id?: string
          price_level?: string | null
          price_range?: Json | null
          rating?: number | null
          user_rating_count?: number | null
          website_uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_cache_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_signals: {
        Row: {
          place_id: string
          score: number
          source: Database["public"]["Enums"]["signal_source"]
          tag: string
          updated_at: string
        }
        Insert: {
          place_id: string
          score?: number
          source?: Database["public"]["Enums"]["signal_source"]
          tag: string
          updated_at?: string
        }
        Update: {
          place_id?: string
          score?: number
          source?: Database["public"]["Enums"]["signal_source"]
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_signals_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          created_at: string
          destination_id: string | null
          google_place_id: string
          id: string
          primary_type: string | null
          tags: string[]
          types: string[]
        }
        Insert: {
          created_at?: string
          destination_id?: string | null
          google_place_id: string
          id?: string
          primary_type?: string | null
          tags?: string[]
          types?: string[]
        }
        Update: {
          created_at?: string
          destination_id?: string | null
          google_place_id?: string
          id?: string
          primary_type?: string | null
          tags?: string[]
          types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "places_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          display_name: string | null
          follower_count: number
          following_count: number
          id: string
          is_anonymous: boolean
          is_public: boolean
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          trip_count: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id: string
          is_anonymous?: boolean
          is_public?: boolean
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          trip_count?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id?: string
          is_anonymous?: boolean
          is_public?: boolean
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          trip_count?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      route_legs: {
        Row: {
          depart_bucket: number
          dest_place_id: string
          distance_m: number
          duration_s: number
          expires_at: string
          fetched_at: string
          mode: Database["public"]["Enums"]["transport_mode"]
          origin_place_id: string
          polyline: string | null
        }
        Insert: {
          depart_bucket: number
          dest_place_id: string
          distance_m: number
          duration_s: number
          expires_at: string
          fetched_at?: string
          mode: Database["public"]["Enums"]["transport_mode"]
          origin_place_id: string
          polyline?: string | null
        }
        Update: {
          depart_bucket?: number
          dest_place_id?: string
          distance_m?: number
          duration_s?: number
          expires_at?: string
          fetched_at?: string
          mode?: Database["public"]["Enums"]["transport_mode"]
          origin_place_id?: string
          polyline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_legs_dest_place_id_fkey"
            columns: ["dest_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_legs_origin_place_id_fkey"
            columns: ["origin_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_clones: {
        Row: {
          cloned_trip_id: string
          cloner_id: string
          created_at: string
          id: string
          source_trip_id: string
          source_version: number
        }
        Insert: {
          cloned_trip_id: string
          cloner_id: string
          created_at?: string
          id?: string
          source_trip_id: string
          source_version: number
        }
        Update: {
          cloned_trip_id?: string
          cloner_id?: string
          created_at?: string
          id?: string
          source_trip_id?: string
          source_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_clones_cloned_trip_id_fkey"
            columns: ["cloned_trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_clones_cloner_id_fkey"
            columns: ["cloner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_clones_source_trip_id_fkey"
            columns: ["source_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          created_at: string
          date: string | null
          day_index: number
          destination_id: string | null
          estimated_cost: number | null
          id: string
          notes: string | null
          summary: string | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          day_index: number
          destination_id?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          summary?: string | null
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string | null
          day_index?: number
          destination_id?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          summary?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_destinations: {
        Row: {
          anchor_label: string | null
          anchor_place_id: string | null
          destination_id: string
          first_day_index: number
          id: string
          nights: number
          order_index: number
          trip_id: string
        }
        Insert: {
          anchor_label?: string | null
          anchor_place_id?: string | null
          destination_id: string
          first_day_index: number
          id?: string
          nights: number
          order_index: number
          trip_id: string
        }
        Update: {
          anchor_label?: string | null
          anchor_place_id?: string | null
          destination_id?: string
          first_day_index?: number
          id?: string
          nights?: number
          order_index?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_destinations_anchor_place_id_fkey"
            columns: ["anchor_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_destinations_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_destinations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          actor_hash: string | null
          channel: string | null
          country: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id: string
          profile_id: string | null
          referrer_host: string | null
          trip_id: string
        }
        Insert: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id: string
        }
        Update: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events_202608: {
        Row: {
          actor_hash: string | null
          channel: string | null
          country: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id: string
          profile_id: string | null
          referrer_host: string | null
          trip_id: string
        }
        Insert: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id: string
        }
        Update: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id?: string
        }
        Relationships: []
      }
      trip_events_202609: {
        Row: {
          actor_hash: string | null
          channel: string | null
          country: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id: string
          profile_id: string | null
          referrer_host: string | null
          trip_id: string
        }
        Insert: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id: string
        }
        Update: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id?: string
        }
        Relationships: []
      }
      trip_events_202610: {
        Row: {
          actor_hash: string | null
          channel: string | null
          country: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id: string
          profile_id: string | null
          referrer_host: string | null
          trip_id: string
        }
        Insert: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id: string
        }
        Update: {
          actor_hash?: string | null
          channel?: string | null
          country?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["trip_event_type"]
          id?: string
          profile_id?: string | null
          referrer_host?: string | null
          trip_id?: string
        }
        Relationships: []
      }
      trip_likes: {
        Row: {
          created_at: string
          profile_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_likes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_saves: {
        Row: {
          created_at: string
          profile_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_saves_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_saves_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          accommodation_pref:
            | Database["public"]["Enums"]["accommodation_kind"]
            | null
          budget_daily: number | null
          budget_total: number | null
          clone_count: number
          comment_count: number
          created_at: string
          currency: string
          date_mode: Database["public"]["Enums"]["date_mode"]
          deleted_at: string | null
          duration_days: number
          end_date: string | null
          estimated_cost_breakdown: Json | null
          estimated_cost_total: number | null
          food_prefs: string[]
          forked_from_trip_id: string | null
          forked_from_version: number | null
          hero_credit: Json | null
          hero_image_url: string | null
          highlights: string[]
          id: string
          interests: string[]
          is_featured: boolean
          is_indexable: boolean
          like_count: number
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          origin_creator_username: string | null
          origin_title: string | null
          owner_id: string
          pace: Database["public"]["Enums"]["trip_pace"]
          party: Json
          published_at: string | null
          quality_score: number
          root_trip_id: string | null
          save_count: number
          search_vector: unknown
          share_count: number
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          subtitle: string | null
          summary: string | null
          title: string
          transport_modes: Database["public"]["Enums"]["transport_mode"][]
          travel_style: Database["public"]["Enums"]["travel_style"]
          updated_at: string
          user_notes: string | null
          version: number
          view_count: number
          visibility: Database["public"]["Enums"]["trip_visibility"]
        }
        Insert: {
          accommodation_pref?:
            | Database["public"]["Enums"]["accommodation_kind"]
            | null
          budget_daily?: number | null
          budget_total?: number | null
          clone_count?: number
          comment_count?: number
          created_at?: string
          currency?: string
          date_mode?: Database["public"]["Enums"]["date_mode"]
          deleted_at?: string | null
          duration_days: number
          end_date?: string | null
          estimated_cost_breakdown?: Json | null
          estimated_cost_total?: number | null
          food_prefs?: string[]
          forked_from_trip_id?: string | null
          forked_from_version?: number | null
          hero_credit?: Json | null
          hero_image_url?: string | null
          highlights?: string[]
          id?: string
          interests?: string[]
          is_featured?: boolean
          is_indexable?: boolean
          like_count?: number
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          origin_creator_username?: string | null
          origin_title?: string | null
          owner_id: string
          pace?: Database["public"]["Enums"]["trip_pace"]
          party?: Json
          published_at?: string | null
          quality_score?: number
          root_trip_id?: string | null
          save_count?: number
          search_vector?: unknown
          share_count?: number
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          subtitle?: string | null
          summary?: string | null
          title: string
          transport_modes?: Database["public"]["Enums"]["transport_mode"][]
          travel_style?: Database["public"]["Enums"]["travel_style"]
          updated_at?: string
          user_notes?: string | null
          version?: number
          view_count?: number
          visibility?: Database["public"]["Enums"]["trip_visibility"]
        }
        Update: {
          accommodation_pref?:
            | Database["public"]["Enums"]["accommodation_kind"]
            | null
          budget_daily?: number | null
          budget_total?: number | null
          clone_count?: number
          comment_count?: number
          created_at?: string
          currency?: string
          date_mode?: Database["public"]["Enums"]["date_mode"]
          deleted_at?: string | null
          duration_days?: number
          end_date?: string | null
          estimated_cost_breakdown?: Json | null
          estimated_cost_total?: number | null
          food_prefs?: string[]
          forked_from_trip_id?: string | null
          forked_from_version?: number | null
          hero_credit?: Json | null
          hero_image_url?: string | null
          highlights?: string[]
          id?: string
          interests?: string[]
          is_featured?: boolean
          is_indexable?: boolean
          like_count?: number
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          origin_creator_username?: string | null
          origin_title?: string | null
          owner_id?: string
          pace?: Database["public"]["Enums"]["trip_pace"]
          party?: Json
          published_at?: string | null
          quality_score?: number
          root_trip_id?: string | null
          save_count?: number
          search_vector?: unknown
          share_count?: number
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          subtitle?: string | null
          summary?: string | null
          title?: string
          transport_modes?: Database["public"]["Enums"]["transport_mode"][]
          travel_style?: Database["public"]["Enums"]["travel_style"]
          updated_at?: string
          user_notes?: string | null
          version?: number
          view_count?: number
          visibility?: Database["public"]["Enums"]["trip_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "trips_forked_from_trip_id_fkey"
            columns: ["forked_from_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_root_trip_id_fkey"
            columns: ["root_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_destination_trip_count: { Args: { d: string }; Returns: undefined }
      can_edit_trip: { Args: { t: string }; Returns: boolean }
      can_read_trip: { Args: { t: string }; Returns: boolean }
      clone_trip: { Args: { source_trip_id: string }; Returns: string }
      destination_stats: {
        Args: { p_destination_id: string }
        Returns: {
          common_pace: string
          common_style: string
          currency: string
          max_days: number
          median_cost: number
          median_days: number
          min_days: number
          top_interests: string[]
          trip_count: number
        }[]
      }
      destination_top_places: {
        Args: { p_destination_id: string; p_limit?: number }
        Returns: {
          maps_url: string
          name: string
          place_id: string
          rating: number
          tags: string[]
          trips: number
          user_rating_count: number
        }[]
      }
      ensure_trip_events_partition: {
        Args: { target: string }
        Returns: undefined
      }
      is_anonymous_profile: { Args: { p_id: string }; Returns: boolean }
      record_trip_event: {
        Args: {
          p_actor_hash?: string
          p_channel?: string
          p_event_type: Database["public"]["Enums"]["trip_event_type"]
          p_referrer_host?: string
          p_trip_id: string
        }
        Returns: undefined
      }
      refresh_trip_indexability: { Args: never; Returns: number }
      reorder_activities: {
        Args: { p_day_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      rollup_trip_counters: { Args: { since?: string }; Returns: number }
      search_trips: {
        Args: {
          p_interest?: string
          p_limit?: number
          p_max_days?: number
          p_min_days?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
          p_style?: string
        }
        Returns: {
          avatar_url: string
          clone_count: number
          currency: string
          display_name: string
          duration_days: number
          estimated_cost_total: number
          hero_credit: Json
          hero_image_url: string
          id: string
          interests: string[]
          like_count: number
          rank: number
          slug: string
          subtitle: string
          title: string
          travel_style: string
          username: string
        }[]
      }
      slugify: { Args: { input: string }; Returns: string }
      spend_today_usd: { Args: never; Returns: number }
      sweep_expired_cache: { Args: never; Returns: number }
      text_array_to_string: {
        Args: { arr: string[]; sep: string }
        Returns: string
      }
      trip_comments: {
        Args: { p_trip_id: string }
        Returns: {
          author_id: string
          avatar_url: string
          body: string
          created_at: string
          display_name: string
          id: string
          username: string
        }[]
      }
      trip_id_for_day: { Args: { d: string }; Returns: string }
      unaccent_fallback: { Args: { input: string }; Returns: string }
      unique_trip_slug: { Args: { base: string }; Returns: string }
    }
    Enums: {
      accommodation_kind:
        | "hostel"
        | "budget_hotel"
        | "hotel"
        | "apartment"
        | "boutique"
        | "resort"
        | "luxury"
      activity_kind:
        | "activity"
        | "meal"
        | "transit"
        | "accommodation"
        | "free_time"
      activity_source: "generated" | "user_added" | "cloned"
      api_provider:
        | "openai"
        | "google_places"
        | "google_routes"
        | "google_photos"
        | "images"
      cost_basis: "modelled" | "user" | "source"
      date_mode: "exact" | "flexible"
      destination_kind: "city" | "region" | "country"
      job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      moderation_state: "pending" | "approved" | "flagged" | "blocked"
      signal_source: "behavioural" | "editorial"
      subscription_tier: "free" | "pro"
      transport_mode:
        | "walking"
        | "transit"
        | "driving"
        | "rideshare"
        | "cycling"
        | "mixed"
      travel_style:
        | "budget"
        | "backpacker"
        | "mid_range"
        | "balanced"
        | "luxury"
      trip_event_type:
        | "view"
        | "share"
        | "og_render"
        | "cta_click"
        | "clone_start"
      trip_pace: "relaxed" | "balanced" | "packed"
      trip_status: "draft" | "generating" | "ready" | "failed"
      trip_visibility: "private" | "unlisted" | "public"
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
    Enums: {
      accommodation_kind: [
        "hostel",
        "budget_hotel",
        "hotel",
        "apartment",
        "boutique",
        "resort",
        "luxury",
      ],
      activity_kind: [
        "activity",
        "meal",
        "transit",
        "accommodation",
        "free_time",
      ],
      activity_source: ["generated", "user_added", "cloned"],
      api_provider: [
        "openai",
        "google_places",
        "google_routes",
        "google_photos",
        "images",
      ],
      cost_basis: ["modelled", "user", "source"],
      date_mode: ["exact", "flexible"],
      destination_kind: ["city", "region", "country"],
      job_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      moderation_state: ["pending", "approved", "flagged", "blocked"],
      signal_source: ["behavioural", "editorial"],
      subscription_tier: ["free", "pro"],
      transport_mode: [
        "walking",
        "transit",
        "driving",
        "rideshare",
        "cycling",
        "mixed",
      ],
      travel_style: ["budget", "backpacker", "mid_range", "balanced", "luxury"],
      trip_event_type: [
        "view",
        "share",
        "og_render",
        "cta_click",
        "clone_start",
      ],
      trip_pace: ["relaxed", "balanced", "packed"],
      trip_status: ["draft", "generating", "ready", "failed"],
      trip_visibility: ["private", "unlisted", "public"],
    },
  },
} as const

