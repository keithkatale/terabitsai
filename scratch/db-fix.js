const { PrismaClient } = require("/Users/KeithKatale/Documents/Quant/node_modules/@prisma/client");

// Load DATABASE_URL from apps/web/.env.local
const fs = require("fs");
const path = require("path");

const envPath = "/Users/KeithKatale/Documents/Quant/apps/web/.env.local";
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    databaseUrl = match[1].trim();
    console.log("Loaded DATABASE_URL from .env.local");
  }
}

if (!databaseUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

// Instantiate PrismaClient
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function main() {
  console.log("Checking columns of table 'chat_messages'...");
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND table_schema = 'public'
  `;
  console.log("Columns of chat_messages:", columns);

  const hasSubAgents = columns.some(c => c.column_name === "sub_agents");
  if (!hasSubAgents) {
    console.log("Column 'sub_agents' is missing. Adding it...");
    await prisma.$executeRaw`
      ALTER TABLE public.chat_messages
      ADD COLUMN IF NOT EXISTS sub_agents jsonb
    `;
    console.log("Column 'sub_agents' added successfully.");
  } else {
    console.log("Column 'sub_agents' already exists.");
  }
}

main()
  .catch((e) => {
    console.error("Error executing query:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
