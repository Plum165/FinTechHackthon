# 🌍 FinTech Hackathon – USSD + Interledger Open Payments

This project demonstrates how to:
- Generate a non-interactive **access token** using the Interledger Open Payments protocol.
- Use the token to send a payment **without needing user redirection** (ideal for USSD/SMS apps).

---

## 🔐 : Environment Setup

Create a `.env` file in your root directory with the following:

```env
# Wallet Details
OPEN_PAYMENTS_CLIENT_ADDRESS=$wallet.example.com/alice
OPEN_PAYMENTS_KEY_ID=your-wallet-key-id
OPEN_PAYMENTS_SECRET_KEY_PATH=./private.key

# Optional for SMS
AT_API_KEY=your-africas-talking-api-key
AT_USERNAME=sandbox
PORT=3000

npm install

yarn install

node generate_token.js

⚠️ Grant is pending. You must authorize it in your browser:
🔗 Redirect URL: https://auth.example.com/interact/...


node index.js

On simulation:
CON Welcome to Cahce Money
1. Send Payment
2. Check Balance
3. Exit

After giving information that required it will send an amount to individual.
END Payment of 100 sent to $bob.example.com
