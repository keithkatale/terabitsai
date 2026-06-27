const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envPath = "/Users/KeithKatale/Documents/Quant/apps/web/.env.local";
let supabaseUrl = "";
let supabaseServiceKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const urlMatch = envContent.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
  const keyMatch = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseServiceKey = keyMatch[1].trim();
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase config not found");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const conversationId = "33700495-e922-4fb6-b748-0ae9ea525d1a";
  console.log(`Simulating GET messages for conversation: ${conversationId}...`);
  
  // Query conversations
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .maybeSingle();
    
  if (convErr) {
    console.error("Conversation fetch error:", convErr);
    return;
  }
  console.log("Conversation:", conv);

  if (!conv) {
    console.log("Conversation not found");
    return;
  }

  // Fetch messages
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts, tool_pods, sub_agents, sequence, created_at")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true });

  if (error) {
    console.error("Messages fetch error:", error);
    return;
  }

  console.log(`Fetched ${data.length} messages successfully.`);
  
  // Try serialization
  try {
    const serialized = JSON.stringify({ messages: data });
    console.log("JSON serialization check: OK. Length:", serialized.length);
  } catch (err) {
    console.error("JSON serialization failed:", err);
  }
}

main()
  .catch((e) => console.error(e));
