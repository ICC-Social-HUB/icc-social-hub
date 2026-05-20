import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
// (In a standard React project, these are injected via import.meta.env or process.env)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || window.ICC_CONFIG?.SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || window.ICC_CONFIG?.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * ========================================================
 * ICC EVENTS SERVICE LAYER
 * Separates anonymous reads from authenticated mutations.
 * ========================================================
 */
export const EventService = {
  
  // ==========================================
  // 1. PUBLIC / UNAUTHENTICATED DATA FETCHING
  // ==========================================

  /**
   * Fetches all events categorized by status (upcoming or past)
   */
  async getEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) throw error;

      // Segregate upcoming vs past in memory for clean UI consumption
      const now = new Date();
      const upcoming = [];
      const past = [];

      (data || []).forEach(event => {
        const eventDate = new Date(event.event_date);
        if (eventDate >= now || event.status === 'upcoming') {
          upcoming.push(event);
        } else {
          past.push(event);
        }
      });

      // Sort upcoming ascending (soonest first), past descending (most recent first)
      upcoming.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
      past.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

      return { upcoming, past, error: null };
    } catch (error) {
      console.error('Error fetching events:', error);
      return { upcoming: [], past: [], error };
    }
  },

  /**
   * Fetches a single event details by its ID (Public view)
   */
  async getEventById(eventId) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      return { event: data, error: null };
    } catch (error) {
      console.error(`Error fetching event ${eventId}:`, error);
      return { event: null, error };
    }
  },

  // ==========================================
  // 2. PROTECTED / ADMIN MUTATIONS
  // ==========================================

  /**
   * Helper to verify if the current user session is an admin.
   */
  async isAdmin() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || !profile) return false;
      return profile.role === 'admin';
    } catch {
      return false;
    }
  },

  /**
   * Creates a new event record (Requires Admin Session)
   */
  async createEvent(eventFields) {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert([eventFields])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Admin createEvent error:', error);
      return { data: null, error };
    }
  },

  /**
   * Updates an existing event record (Requires Admin Session)
   */
  async updateEvent(eventId, eventFields) {
    try {
      const { data, error } = await supabase
        .from('events')
        .update(eventFields)
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error(`Admin updateEvent error for ${eventId}:`, error);
      return { data: null, error };
    }
  },

  /**
   * Deletes an event and cleans up its associated images in storage (Requires Admin Session)
   */
  async deleteEvent(event) {
    try {
      // 1. Delete associated banner if it exists in our 'events' storage bucket
      if (event.banner_url && event.banner_url.includes('/storage/v1/object/public/events/')) {
        const bannerPath = event.banner_url.split('/events/')[1];
        await supabase.storage.from('events').remove([bannerPath]);
      }

      // 2. Delete gallery images
      if (event.gallery_urls && event.gallery_urls.length > 0) {
        const pathsToRemove = event.gallery_urls
          .filter(url => url.includes('/storage/v1/object/public/events/'))
          .map(url => url.split('/events/')[1]);
        
        if (pathsToRemove.length > 0) {
          await supabase.storage.from('events').remove(pathsToRemove);
        }
      }

      // 3. Delete DB record
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      console.error(`Admin deleteEvent error for ${event.id}:`, error);
      return { success: false, error };
    }
  },

  /**
   * Uploads an event asset (banner/gallery) to the public 'events' bucket
   */
  async uploadEventImage(file, pathPrefix = 'banners') {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('events')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('events')
        .getPublicUrl(fileName);

      return { publicUrl: data.publicUrl, error: null };
    } catch (error) {
      console.error('Image upload error:', error);
      return { publicUrl: null, error };
    }
  }
};
