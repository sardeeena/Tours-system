export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'manager' | 'staff' | 'customer';
export type TourStatus = 'draft' | 'published' | 'archived';
export type TourType = 'Shared' | 'Private';
export type DurationCategory = 'Half Day' | 'Full Day' | 'Multi Day';
export type TourDifficulty = 'Easy' | 'Moderate' | 'Adventurous';
export type VideoProvider = 'youtube' | 'vimeo' | 'storage' | 'direct';
export type ExtraPricingType = 'per_person' | 'per_booking' | 'per_adult' | 'per_child' | 'per_vehicle' | 'per_item';
export type AvailabilityStatus = 'available' | 'unavailable' | 'sold_out';
export type BookingStatus = 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled' | 'completed' | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';
export type PaymentMethod = 'pay_at_pickup' | 'pay_online';
export type SeoEntityType = 'tour' | 'destination' | 'category' | 'page';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      destinations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          tagline: string | null;
          description: string | null;
          main_image: string | null;
          gallery: string[];
          distance_from_airport: string | null;
          seo_title: string | null;
          seo_description: string | null;
          seo_keywords: string[];
          status: 'draft' | 'published' | 'archived';
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          tagline?: string | null;
          description?: string | null;
          main_image?: string | null;
          gallery?: string[];
          distance_from_airport?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          seo_keywords?: string[];
          status?: 'draft' | 'published' | 'archived';
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          tagline?: string | null;
          description?: string | null;
          main_image?: string | null;
          gallery?: string[];
          distance_from_airport?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          seo_keywords?: string[];
          status?: 'draft' | 'published' | 'archived';
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image: string | null;
          icon_name: string | null;
          seo_title: string | null;
          seo_description: string | null;
          seo_keywords: string[];
          status: 'draft' | 'published' | 'archived';
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image?: string | null;
          icon_name?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          seo_keywords?: string[];
          status?: 'draft' | 'published' | 'archived';
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image?: string | null;
          icon_name?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          seo_keywords?: string[];
          status?: 'draft' | 'published' | 'archived';
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tours: {
        Row: {
          id: string;
          title: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          destination_id: string | null;
          duration: string;
          duration_type: DurationCategory;
          duration_hours: number;
          tour_type: TourType;
          status: TourStatus;
          featured: boolean;
          price: number;
          child_price: number | null;
          infant_price: number | null;
          private_price: number | null;
          currency: string;
          max_guests: number;
          minimum_booking_notice_hours: number;
          pickup_available: boolean;
          pickup_info: string | null;
          cancellation_policy: string | null;
          departure_time: string | null;
          available_days: string[];
          languages: string[];
          difficulty: TourDifficulty | null;
          age_restrictions: string | null;
          badge: string | null;
          rating: number;
          review_count: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          destination_id?: string | null;
          duration?: string;
          duration_type?: DurationCategory;
          duration_hours?: number;
          tour_type?: TourType;
          status?: TourStatus;
          featured?: boolean;
          price?: number;
          child_price?: number | null;
          infant_price?: number | null;
          private_price?: number | null;
          currency?: string;
          max_guests?: number;
          minimum_booking_notice_hours?: number;
          pickup_available?: boolean;
          pickup_info?: string | null;
          cancellation_policy?: string | null;
          departure_time?: string | null;
          available_days?: string[];
          languages?: string[];
          difficulty?: TourDifficulty | null;
          age_restrictions?: string | null;
          badge?: string | null;
          rating?: number;
          review_count?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          short_description?: string | null;
          description?: string | null;
          destination_id?: string | null;
          duration?: string;
          duration_type?: DurationCategory;
          duration_hours?: number;
          tour_type?: TourType;
          status?: TourStatus;
          featured?: boolean;
          price?: number;
          child_price?: number | null;
          infant_price?: number | null;
          private_price?: number | null;
          currency?: string;
          max_guests?: number;
          minimum_booking_notice_hours?: number;
          pickup_available?: boolean;
          pickup_info?: string | null;
          cancellation_policy?: string | null;
          departure_time?: string | null;
          available_days?: string[];
          languages?: string[];
          difficulty?: TourDifficulty | null;
          age_restrictions?: string | null;
          badge?: string | null;
          rating?: number;
          review_count?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tours_destination_id_fkey';
            columns: ['destination_id'];
            isOneToOne: false;
            referencedRelation: 'destinations';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_categories: {
        Row: {
          tour_id: string;
          category_id: string;
        };
        Insert: {
          tour_id: string;
          category_id: string;
        };
        Update: {
          tour_id?: string;
          category_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_categories_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tour_categories_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_images: {
        Row: {
          id: string;
          tour_id: string;
          image_url: string;
          storage_path: string | null;
          alt_text: string | null;
          caption: string | null;
          is_primary: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          image_url: string;
          storage_path?: string | null;
          alt_text?: string | null;
          caption?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          image_url?: string;
          storage_path?: string | null;
          alt_text?: string | null;
          caption?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_images_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_videos: {
        Row: {
          id: string;
          tour_id: string;
          video_url: string;
          title: string | null;
          description: string | null;
          provider: VideoProvider | null;
          storage_path: string | null;
          is_primary: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          video_url: string;
          title?: string | null;
          description?: string | null;
          provider?: VideoProvider | null;
          storage_path?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          video_url?: string;
          title?: string | null;
          description?: string | null;
          provider?: VideoProvider | null;
          storage_path?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_videos_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_itinerary: {
        Row: {
          id: string;
          tour_id: string;
          time: string;
          title: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          time: string;
          title: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          time?: string;
          title?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_itinerary_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_inclusions: {
        Row: {
          id: string;
          tour_id: string;
          item: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          item: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          item?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_inclusions_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_exclusions: {
        Row: {
          id: string;
          tour_id: string;
          item: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          item: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          item?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_exclusions_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_highlights: {
        Row: {
          id: string;
          tour_id: string;
          item: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          item: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          item?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_highlights_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_faqs: {
        Row: {
          id: string;
          tour_id: string;
          question: string;
          answer: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          question: string;
          answer: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          question?: string;
          answer?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_faqs_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      pickup_locations: {
        Row: {
          id: string;
          code: string;
          name: string;
          area: string;
          fee_eur_per_person: number;
          fee_eur_flat: number | null;
          description: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          area: string;
          fee_eur_per_person?: number;
          fee_eur_flat?: number | null;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          area?: string;
          fee_eur_per_person?: number;
          fee_eur_flat?: number | null;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tour_pickup_locations: {
        Row: {
          tour_id: string;
          pickup_location_id: string;
        };
        Insert: {
          tour_id: string;
          pickup_location_id: string;
        };
        Update: {
          tour_id?: string;
          pickup_location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_pickup_locations_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tour_pickup_locations_pickup_location_id_fkey';
            columns: ['pickup_location_id'];
            isOneToOne: false;
            referencedRelation: 'pickup_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_extras: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_eur: number;
          currency: string;
          pricing_type: ExtraPricingType;
          is_active: boolean;
          sort_order: number;
          image_url?: string | null;
          min_quantity?: number;
          max_quantity?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price_eur?: number;
          currency?: string;
          pricing_type?: ExtraPricingType;
          is_active?: boolean;
          sort_order?: number;
          image_url?: string | null;
          min_quantity?: number;
          max_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price_eur?: number;
          currency?: string;
          pricing_type?: ExtraPricingType;
          is_active?: boolean;
          sort_order?: number;
          image_url?: string | null;
          min_quantity?: number;
          max_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tour_assigned_extras: {
        Row: {
          tour_id: string;
          extra_id: string;
          custom_price_eur?: number | null;
        };
        Insert: {
          tour_id: string;
          extra_id: string;
          custom_price_eur?: number | null;
        };
        Update: {
          tour_id?: string;
          extra_id?: string;
          custom_price_eur?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_assigned_extras_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tour_assigned_extras_extra_id_fkey';
            columns: ['extra_id'];
            isOneToOne: false;
            referencedRelation: 'tour_extras';
            referencedColumns: ['id'];
          },
        ];
      };
      tour_availability: {
        Row: {
          id: string;
          tour_id: string;
          date: string;
          status: AvailabilityStatus;
          max_capacity: number;
          booked_count: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          date: string;
          status?: AvailabilityStatus;
          max_capacity?: number;
          booked_count?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          date?: string;
          status?: AvailabilityStatus;
          max_capacity?: number;
          booked_count?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tour_availability_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          whatsapp: string | null;
          country: string;
          country_code: string | null;
          hotel: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          whatsapp?: string | null;
          country: string;
          country_code?: string | null;
          hotel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          whatsapp?: string | null;
          country?: string;
          country_code?: string | null;
          hotel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          booking_reference: string;
          tour_id: string;
          customer_id: string | null;
          booking_date: string;
          status: BookingStatus;
          payment_status: PaymentStatus;
          payment_method: PaymentMethod;
          adult_count: number;
          child_count: number;
          infant_count: number;
          pickup_location_id: string | null;
          pickup_hotel_name: string | null;
          pickup_room_number: string | null;
          subtotal: number;
          extras_total: number;
          discount: number;
          total: number;
          currency: string;
          special_requests: string | null;
          cancellation_reason: string | null;
          cancellation_previous_status: string | null;
          cancellation_requested_at: string | null;
          idempotency_key: string | null;
          idempotency_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_reference: string;
          tour_id: string;
          customer_id?: string | null;
          booking_date: string;
          status?: BookingStatus;
          payment_status?: PaymentStatus;
          payment_method?: PaymentMethod;
          adult_count?: number;
          child_count?: number;
          infant_count?: number;
          pickup_location_id?: string | null;
          pickup_hotel_name?: string | null;
          pickup_room_number?: string | null;
          subtotal?: number;
          extras_total?: number;
          discount?: number;
          total?: number;
          currency?: string;
          special_requests?: string | null;
          cancellation_reason?: string | null;
          cancellation_previous_status?: string | null;
          cancellation_requested_at?: string | null;
          idempotency_key?: string | null;
          idempotency_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_reference?: string;
          tour_id?: string;
          customer_id?: string | null;
          booking_date?: string;
          status?: BookingStatus;
          payment_status?: PaymentStatus;
          payment_method?: PaymentMethod;
          adult_count?: number;
          child_count?: number;
          infant_count?: number;
          pickup_location_id?: string | null;
          pickup_hotel_name?: string | null;
          pickup_room_number?: string | null;
          subtotal?: number;
          extras_total?: number;
          discount?: number;
          total?: number;
          currency?: string;
          special_requests?: string | null;
          cancellation_reason?: string | null;
          cancellation_previous_status?: string | null;
          cancellation_requested_at?: string | null;
          idempotency_key?: string | null;
          idempotency_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_pickup_location_id_fkey';
            columns: ['pickup_location_id'];
            isOneToOne: false;
            referencedRelation: 'pickup_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_extras: {
        Row: {
          id: string;
          booking_id: string;
          extra_id: string | null;
          name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
          pricing_type: string;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          extra_id?: string | null;
          name: string;
          description?: string | null;
          quantity?: number;
          unit_price: number;
          total_price: number;
          pricing_type?: string;
          currency?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          extra_id?: string | null;
          name?: string;
          description?: string | null;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          pricing_type?: string;
          currency?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_extras_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_extras_extra_id_fkey';
            columns: ['extra_id'];
            isOneToOne: false;
            referencedRelation: 'tour_extras';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          tour_id: string | null;
          author_name: string;
          country: string | null;
          country_code: string | null;
          rating: number;
          comment: string;
          date: string;
          traveler_type: string | null;
          verified_booking: boolean;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id?: string | null;
          author_name: string;
          country?: string | null;
          country_code?: string | null;
          rating: number;
          comment: string;
          date?: string;
          traveler_type?: string | null;
          verified_booking?: boolean;
          is_published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string | null;
          author_name?: string;
          country?: string | null;
          country_code?: string | null;
          rating?: number;
          comment?: string;
          date?: string;
          traveler_type?: string | null;
          verified_booking?: boolean;
          is_published?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_tour_id_fkey';
            columns: ['tour_id'];
            isOneToOne: false;
            referencedRelation: 'tours';
            referencedColumns: ['id'];
          },
        ];
      };
      seo_metadata: {
        Row: {
          id: string;
          entity_type: SeoEntityType;
          entity_id: string | null;
          page_slug: string | null;
          seo_title: string | null;
          meta_description: string | null;
          seo_keywords: string[];
          canonical_url: string | null;
          og_title: string | null;
          og_description: string | null;
          og_image: string | null;
          social_image: string | null;
          robots_index: boolean;
          robots_follow: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_type: SeoEntityType;
          entity_id?: string | null;
          page_slug?: string | null;
          seo_title?: string | null;
          meta_description?: string | null;
          seo_keywords?: string[];
          canonical_url?: string | null;
          og_title?: string | null;
          og_description?: string | null;
          og_image?: string | null;
          social_image?: string | null;
          robots_index?: boolean;
          robots_follow?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: SeoEntityType;
          entity_id?: string | null;
          page_slug?: string | null;
          seo_title?: string | null;
          meta_description?: string | null;
          seo_keywords?: string[];
          canonical_url?: string | null;
          og_title?: string | null;
          og_description?: string | null;
          og_image?: string | null;
          social_image?: string | null;
          robots_index?: boolean;
          robots_follow?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscriptions: {
        Row: {
          id: string;
          email: string;
          source: string;
          status: 'subscribed' | 'unsubscribed';
          discount_code: string;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string;
          status?: 'subscribed' | 'unsubscribed';
          discount_code?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          source?: string;
          status?: 'subscribed' | 'unsubscribed';
          discount_code?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inquiries: {
        Row: {
          id: string;
          customer_name: string;
          email: string;
          phone: string | null;
          whatsapp: string | null;
          tour_id: string | null;
          tour_title: string | null;
          subject: string;
          message: string;
          status: 'new' | 'contacted' | 'resolved' | 'converted';
          source: 'web' | 'whatsapp' | 'email' | 'phone';
          ip_address: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          email: string;
          phone?: string | null;
          whatsapp?: string | null;
          tour_id?: string | null;
          tour_title?: string | null;
          subject?: string;
          message: string;
          status?: 'new' | 'contacted' | 'resolved' | 'converted';
          source?: 'web' | 'whatsapp' | 'email' | 'phone';
          ip_address?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          email?: string;
          phone?: string | null;
          whatsapp?: string | null;
          tour_id?: string | null;
          tour_title?: string | null;
          subject?: string;
          message?: string;
          status?: 'new' | 'contacted' | 'resolved' | 'converted';
          source?: 'web' | 'whatsapp' | 'email' | 'phone';
          ip_address?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: 'percentage' | 'fixed';
          discount_value: number;
          min_spend: number | null;
          max_discount: number | null;
          valid_from: string | null;
          valid_until: string | null;
          usage_limit: number | null;
          times_used: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type: 'percentage' | 'fixed';
          discount_value: number;
          min_spend?: number | null;
          max_discount?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          usage_limit?: number | null;
          times_used?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          min_spend?: number | null;
          max_discount?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          usage_limit?: number | null;
          times_used?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vessels: {
        Row: {
          id: string;
          name: string;
          vessel_type: 'motor_yacht' | 'speedboat' | 'catamaran' | 'glass_bottom' | 'semi_submarine' | 'safari_jeep';
          registration_number: string | null;
          port_marina: string;
          passenger_capacity: number;
          crew_capacity: number | null;
          year_built: number | null;
          safety_inspection_expiry: string | null;
          amenities: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          vessel_type: 'motor_yacht' | 'speedboat' | 'catamaran' | 'glass_bottom' | 'semi_submarine' | 'safari_jeep';
          registration_number?: string | null;
          port_marina?: string;
          passenger_capacity?: number;
          crew_capacity?: number | null;
          year_built?: number | null;
          safety_inspection_expiry?: string | null;
          amenities?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          vessel_type?: 'motor_yacht' | 'speedboat' | 'catamaran' | 'glass_bottom' | 'semi_submarine' | 'safari_jeep';
          registration_number?: string | null;
          port_marina?: string;
          passenger_capacity?: number;
          crew_capacity?: number | null;
          year_built?: number | null;
          safety_inspection_expiry?: string | null;
          amenities?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tour_vessels: {
        Row: {
          id: string;
          tour_id: string;
          vessel_id: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tour_id: string;
          vessel_id: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tour_id?: string;
          vessel_id?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      guides: {
        Row: {
          id: string;
          full_name: string;
          role: 'captain' | 'dive_master' | 'snorkel_guide' | 'safari_lead' | 'tour_guide';
          languages: string[];
          phone: string | null;
          email: string | null;
          license_number: string | null;
          rating: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          role: 'captain' | 'dive_master' | 'snorkel_guide' | 'safari_lead' | 'tour_guide';
          languages?: string[];
          phone?: string | null;
          email?: string | null;
          license_number?: string | null;
          rating?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: 'captain' | 'dive_master' | 'snorkel_guide' | 'safari_lead' | 'tour_guide';
          languages?: string[];
          phone?: string | null;
          email?: string | null;
          license_number?: string | null;
          rating?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          category: 'general' | 'booking' | 'cancellation' | 'marine_safety' | 'transfers';
          question: string;
          answer: string;
          sort_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: 'general' | 'booking' | 'cancellation' | 'marine_safety' | 'transfers';
          question: string;
          answer: string;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: 'general' | 'booking' | 'cancellation' | 'marine_safety' | 'transfers';
          question?: string;
          answer?: string;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weather_bulletins: {
        Row: {
          id: string;
          harbor_location: string;
          water_temperature_c: number;
          air_temperature_c: number;
          swell_height_m: number;
          wind_speed_knots: number;
          wind_direction: string;
          visibility_meters: number;
          coast_guard_cleared: boolean;
          advisory_notes: string | null;
          bulletin_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          harbor_location?: string;
          water_temperature_c: number;
          air_temperature_c: number;
          swell_height_m: number;
          wind_speed_knots: number;
          wind_direction: string;
          visibility_meters?: number;
          coast_guard_cleared?: boolean;
          advisory_notes?: string | null;
          bulletin_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          harbor_location?: string;
          water_temperature_c?: number;
          air_temperature_c?: number;
          swell_height_m?: number;
          wind_speed_knots?: number;
          wind_direction?: string;
          visibility_meters?: number;
          coast_guard_cleared?: boolean;
          advisory_notes?: string | null;
          bulletin_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      booking_passengers: {
        Row: {
          id: string;
          booking_id: string;
          full_name: string;
          nationality: string | null;
          passport_or_id_number: string | null;
          passenger_type: 'adult' | 'child' | 'infant';
          is_lead_passenger: boolean;
          is_lead?: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          full_name: string;
          nationality?: string | null;
          passport_or_id_number?: string | null;
          passenger_type?: 'adult' | 'child' | 'infant';
          is_lead_passenger?: boolean;
          is_lead?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          full_name?: string;
          nationality?: string | null;
          passport_or_id_number?: string | null;
          passenger_type?: 'adult' | 'child' | 'infant';
          is_lead_passenger?: boolean;
          is_lead?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_tour_availability_schedule: {
        Args: {
          p_tour_identifier: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: {
          tour_id: string;
          date: string;
          status: string;
          max_capacity: number;
          booked_count: number;
          remaining_capacity: number;
          is_available: boolean;
          is_blackout: boolean;
          departure_time: string;
          notes: string | null;
        }[];
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      set_admin_role_by_email: {
        Args: {
          target_email: string;
        };
        Returns: string;
      };
      record_payment_atomic: {
        Args: {
          p_booking_reference: string;
          p_amount: number;
          p_currency: string;
          p_payment_method: string;
          p_provider: string;
          p_status: string;
          p_transaction_reference: string;
          p_notes: string | null;
          p_recorded_by: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      request_refund_atomic: {
        Args: {
          p_booking_reference: string;
          p_payment_id: string | null;
          p_requested_amount: number;
          p_currency: string;
          p_reason: string;
          p_refund_method: string;
          p_requested_by: string;
          p_notes: string | null;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      transition_refund_atomic: {
        Args: {
          p_refund_id: string;
          p_action: string;
          p_amount: number | null;
          p_actor: string | null;
          p_reason: string | null;
          p_transaction_reference: string | null;
        };
        Returns: Json;
      };
      next_invoice_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience helper type utilities for Supabase query typing
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Type-safe table row definitions
export type ProfileRow = Tables<'profiles'>;
export type DestinationRow = Tables<'destinations'>;
export type CategoryRow = Tables<'categories'>;
export type TourRow = Tables<'tours'>;
export type TourCategoryRow = Tables<'tour_categories'>;
export type TourImageRow = Tables<'tour_images'>;
export type TourVideoRow = Tables<'tour_videos'>;
export type TourItineraryRow = Tables<'tour_itinerary'>;
export type TourInclusionRow = Tables<'tour_inclusions'>;
export type TourExclusionRow = Tables<'tour_exclusions'>;
export type TourHighlightRow = Tables<'tour_highlights'>;
export type TourFaqRow = Tables<'tour_faqs'>;
export type PickupLocationRow = Tables<'pickup_locations'>;
export type TourPickupLocationRow = Tables<'tour_pickup_locations'>;
export type TourExtraRow = Tables<'tour_extras'>;
export type TourAssignedExtraRow = Tables<'tour_assigned_extras'>;
export type TourAvailabilityRow = Tables<'tour_availability'>;
export type CustomerRow = Tables<'customers'>;
export type BookingRow = Tables<'bookings'>;
export type BookingExtraRow = Tables<'booking_extras'>;
export type ReviewRow = Tables<'reviews'>;
export type SeoMetadataRow = Tables<'seo_metadata'>;
export type SiteSettingRow = Tables<'site_settings'>;
export type AuditLogRow = Tables<'audit_logs'>;
export type NewsletterSubscriptionRow = Tables<'newsletter_subscriptions'>;
export type InquiryRow = Tables<'inquiries'>;
export type CouponRow = Tables<'coupons'>;
export type VesselRow = Tables<'vessels'>;
export type TourVesselRow = Tables<'tour_vessels'>;
export type GuideRow = Tables<'guides'>;
export type FaqRow = Tables<'faqs'>;
export type WeatherBulletinRow = Tables<'weather_bulletins'>;
export type BookingPassengerRow = Tables<'booking_passengers'>;
