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
```
Run these commands to install the required resources 
```
npm install
```
yarn install


Run this command to generate an access token to allow Users/Clients to make paymeents with requirign grants or permissions
```
node generate_token.js
```

Go to link and login and accept the grant to get final token
⚠️ Grant is pending. You must authorize it in your browser:
🔗 Redirect URL: https://auth.example.com/interact/...
Then place the final token in .env

Then to run simulation you require a profile on Africa's Talking to simulate the USSD simualtor 
This is to run the server 
```
node index.js
```


This to run the program so that any values incoparated from the node.
```
ngrok http 3000
```
On simulation:
CON Welcome to Cahce Money
1. Send Payment
2. Check Balance
3. Exit

After giving information that required it will send an amount to individual.
END Payment of 100 sent to $bob.example.com
