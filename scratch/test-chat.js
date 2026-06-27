const { PrismaClient } = require("/Users/KeithKatale/Documents/Quant/node_modules/@prisma/client");
const fs = require("fs");

const envPath = "/Users/KeithKatale/Documents/Quant/apps/web/.env.local";
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    databaseUrl = match[1].trim();
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function main() {
  const cid = "33700495-e922-4fb6-b748-0ae9ea525d1a";
  console.log(`Querying all messages for conversation_id: ${cid}...`);
  try {
    const fullMessages = await prisma.$queryRawUnsafe(
      `SELECT * FROM public.chat_messages WHERE conversation_id = CAST($1 AS uuid) ORDER BY sequence ASC`,
      cid
    );
    console.log("Full messages:", JSON.stringify(fullMessages, null, 2));
  } catch (err) {
    console.error("Error querying messages:", err);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
