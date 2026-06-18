import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wsxzbqfeafzccprlllpu.supabase.co";
// Fallback to a dummy JWT token during build/prerendering if the environment variable is not set
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.dummy";

// Expose browser-safe client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

