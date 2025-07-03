import dotenv from "dotenv";
import {
  createAuthenticatedClient,
  isPendingGrant,
  isFinalizedGrant
} from "@interledger/open-payments";
import { randomUUID } from "crypto";
import { setTimeout as wait } from "timers/promises"; // ⬅️ Needed for polling

dotenv.config();

// Load environment variables
const walletAddressUrl = process.env.OPEN_PAYMENTS_CLIENT_ADDRESS;
const privateKeyPath = process.env.OPEN_PAYMENTS_SECRET_KEY_PATH;
const keyId = process.env.OPEN_PAYMENTS_KEY_ID;

console.log("Wallet Address:", walletAddressUrl);
console.log("Key ID:", keyId);

// Validate environment variables
if (!walletAddressUrl || !privateKeyPath || !keyId) {
  console.error("❌ Missing required environment variables.");
  if (!walletAddressUrl) console.log("Missing: OPEN_PAYMENTS_CLIENT_ADDRESS");
  if (!keyId) console.log("Missing: OPEN_PAYMENTS_KEY_ID");
  if (!privateKeyPath) console.log("Missing: OPEN_PAYMENTS_SECRET_KEY_PATH");
  process.exit(1);
}

// Create client
async function getAuthenticatedClient() {
  let address = walletAddressUrl;
  if (address.startsWith("$")) {
    address = address.replace("$", "https://");
  }

  return await createAuthenticatedClient({
    walletAddressUrl: address,
    privateKey: privateKeyPath,
    keyId: keyId,
  });
}

// Fetch wallet info
async function getWalletAddressInfo(client, address) {
  if (address.startsWith("$")) {
    address = address.replace("$", "https://");
  }

  return await client.walletAddress.get({ url: address });
}

// Request token with polling
async function requestAccessToken(client, wallet) {
  console.log("📡 Requesting grant...");

  const grant = await client.grant.request(
    {
      url: wallet.authServer,
    },
    {
      access_token: {
        access: [
          {
            type: "outgoing-payment",
            identifier: wallet.id,
            actions: ["create", "read", "list"],
            limits: {
              debitAmount: {
                value: "100000",
                assetCode: wallet.assetCode,
                assetScale: wallet.assetScale,
              },
            },
          },
        ],
      },
      interact: {
        start: ["redirect"],
      },
    }
  );

  if (isPendingGrant(grant)) {
    console.log("⚠️ Grant is pending. You must authorize it in your browser:");
    console.log("🔗 Redirect URL:", grant.interact?.redirect);
    
    let continuedGrant = grant;

    while (!isFinalizedGrant(continuedGrant)) {
      console.log("⏳ Waiting for user authorization...");
      console.log("➡️ Continue URI:", grant.continueUri);
      console.log("🆔 Interact Ref:", grant.interact?.interactRef);
      await wait(grant.continue.wait * 1000) // wait 20 seconds
      continuedGrant = await client.grant.continue(
        {
          url: grant.continue.uri,
          accessToken: grant.continue.access_token.value,
        },
      );
    console.log(continuedGrant)
    }
      
    console.log("✅ Final Access Token:", continuedGrant.access_token.value);
  } else {
    console.log("✅ Final Access Token:", grant.access_token.value);
  }
}

// Main runner
async function run() {
  try {
    const client = await getAuthenticatedClient();
    const wallet = await getWalletAddressInfo(client, walletAddressUrl);
    await requestAccessToken(client, wallet);
  } catch (err) {
    console.error("❌ Failed to generate token:", err);
  }
}

run();
