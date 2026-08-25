# Quickstart

## 1. Install

```bash
npm install
cp .env.example .env.local
```

## 2. See what is missing

```bash
npm run check-config
```

Open the wizard: start the API, then visit [http://localhost:3000/setup](http://localhost:3000/setup).

## 3. Run tests and the agent loop

```bash
npm test
npm run agents:run
```

## 4. Quote an x402 endpoint (stub DEX is fine)

```bash
npm run dev:api
# another terminal
curl -s http://localhost:3000/health
curl -s http://localhost:3000/v1/tokens | head
```

Fill DEX keys and a Base RPC in `.env.local` when you want live quotes. Fill `PRIVATE_KEY` only when you are ready to settle from a **test** wallet that holds USDC.
