import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wsxzbqfeafzccprlllpu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Expose browser-safe client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
