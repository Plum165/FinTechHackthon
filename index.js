import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import africastalking from "africastalking";
import {
  createAuthenticatedClient,
  isPendingGrant,
} from "@interledger/open-payments";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const WALLET_ADDRESS = process.env.OPEN_PAYMENTS_CLIENT_ADDRESS ?? "";
const ACCESS_TOKEN = process.env.OPEN_PAYMENTS_ACCESS_TOKEN ?? "";

if (!ACCESS_TOKEN) {
  console.error("OPEN_PAYMENTS_ACCESS_TOKEN not set");
  process.exit(1);
}

// Africa's Talking SMS setup
const at = africastalking({
  apiKey: process.env.AT_API_KEY ?? "",
  username: process.env.AT_USERNAME ?? "sandbox",
});
const sms = at.SMS;

async function sendSMS(to, message) {
  if (to.startsWith("0")) to = "+27" + to.slice(1);
  try {
    await sms.send({ to: [to], message });
    console.log(`SMS sent to ${to}: ${message}`);
  } catch (err) {
    console.error("SMS error:", err.message || err);
  }
}

// Helper functions from your op.ts adapted for JS
async function getAuthenticatedClient() {
  let walletAddress = WALLET_ADDRESS;
  if (walletAddress.startsWith("$")) {
    walletAddress = walletAddress.replace("$", "https://");
  }
  return await createAuthenticatedClient({
    walletAddressUrl: walletAddress,
    privateKey: process.env.OPEN_PAYMENTS_SECRET_KEY_PATH ?? "",
    keyId: process.env.OPEN_PAYMENTS_KEY_ID ?? "",
  });
}

async function getWalletAddressInfo(client, walletAddress) {
  if (walletAddress.startsWith("$")) {
    walletAddress = walletAddress.replace("$", "https://");
  }
  const walletAddressDetails = await client.walletAddress.get({
    url: walletAddress,
  });
  return { walletAddress, walletAddressDetails };
}

async function createIncomingPayment(client, value, walletAddressDetails) {
  const grant = await client.grant.request(
    {
      url: walletAddressDetails.authServer,
    },
    {
      access_token: {
        access: [
          {
            type: "incoming-payment",
            actions: ["read", "create", "complete"],
          },
        ],
      },
    }
  );

  if (grant && isPendingGrant(grant)) {
    throw new Error("Expected non-interactive grant");
  }

  const incomingPayment = await client.incomingPayment.create(
    {
      url: new URL(walletAddressDetails.id).origin,
      accessToken: grant.access_token.value,
    },
    {
      walletAddress: walletAddressDetails.id,
      incomingAmount: {
        value: value,
        assetCode: walletAddressDetails.assetCode,
        assetScale: walletAddressDetails.assetScale,
      },
      expiresAt: new Date(Date.now() + 60_000 * 30).toISOString(),
    }
  );

  return incomingPayment;
}

async function createQuote(client, incomingPaymentUrl, walletAddressDetails) {
  const grant = await client.grant.request(
    {
      url: walletAddressDetails.authServer,
    },
    {
      access_token: {
        access: [
          {
            type: "quote",
            actions: ["create", "read", "read-all"],
          },
        ],
      },
    }
  );

  if (grant && isPendingGrant(grant)) {
    throw new Error("Expected non-interactive grant");
  }

  const quote = await client.quote.create(
    {
      url: new URL(walletAddressDetails.id).origin,
      accessToken: grant.access_token.value,
    },
    {
      method: "ilp",
      walletAddress: walletAddressDetails.id,
      receiver: incomingPaymentUrl,
    }
  );

  return quote;
}

async function sendInterledgerPayment(senderWalletAddress, recipientWalletAddress, amount) {
  const client = await getAuthenticatedClient();

  // Get wallet details
  const { walletAddressDetails: senderWalletDetails } = await getWalletAddressInfo(client, senderWalletAddress);
  const { walletAddressDetails: recipientWalletDetails } = await getWalletAddressInfo(client, recipientWalletAddress);

  // Create Incoming Payment for recipient
  const incomingPayment = await createIncomingPayment(client, amount, recipientWalletDetails);

  // Create Quote referencing the incoming payment URL
  const quote = await createQuote(client, incomingPayment.id, senderWalletDetails);

  // Create Outgoing Payment referencing the quote and using your ACCESS_TOKEN
  const outgoingPayment = await client.outgoingPayment.create(
    {
      url: new URL(senderWalletAddress).origin,
      accessToken: ACCESS_TOKEN,
    },
    {
      walletAddress: senderWalletAddress,
      quoteId: quote.id,
    }
  );

  return outgoingPayment;
}


// Express middleware
app.use(bodyParser.urlencoded({ extended: false }));

// USSD endpoint
app.post("/ussd", async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  let response = "";

  const textArray = text.split("*");

  try {
    if (text === "") {
      response = `CON Welcome to Cache Money
1. Send Payment
2. Check Balance
3. Exit`;
    } else if (text === "1") {
      response = `CON Enter recipient wallet address:`;
    } else if (textArray[0] === "1" && textArray.length === 2) {
      response = `CON Enter amount to send (in base units, e.g., 100 for R1.00):`;
    } else if (textArray[0] === "1" && textArray.length === 3) {
      const recipientWalletAddress = textArray[1];
      const amountStr = textArray[2];

      try {
        await sendInterledgerPayment(WALLET_ADDRESS, recipientWalletAddress, amountStr);


        response = `END Payment of ${amountStr} sent to ${recipientWalletAddress}`;
        await sendSMS(phoneNumber, `You sent ${amountStr} cents to ${recipientWalletAddress}`);
      } catch (err) {
        console.error("Payment error:", err);
        response = `END Payment failed: ${err.message || err.toString()}`;
      }
    } else if (text === "2") {
      response = `END Your balance is R50.00`; // Dummy
      await sendSMS(phoneNumber, `Balance check: R50.00`);
    } else if (text === "4") {
      response = `END Thank you for using MyApp. Goodbye!`;
    } else {
      response = `END Invalid input. Please try again.`;
    }
  } catch (err) {
    console.error("USSD handler error:", err);
    response = `END An error occurred: ${err.message || err.toString()}`;
  }

  res.set("Content-Type", "text/plain");
  res.send(response);
});

app.listen(port, () => {
  console.log(`USSD app running on http://localhost:${port}`);
});
