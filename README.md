# Postly - Multi-Platform AI Content Publishing Engine

A powerful Node.js backend for generating and scheduling AI-powered content across multiple social platforms (Twitter, LinkedIn, Instagram, Threads). It features a Telegram Bot interface, BullMQ background job processing, and secure JWT authentication.

## Features
- **Authentication**: Secure JWT-based auth with short-lived access (15m) and long-lived refresh tokens (7d).
- **AI Content Engine (Groq)**: Integration with Groq (LLaMA 3 8B) to generate platform-specific content tailored to character limits and platform tone.
- **Telegram Bot Integration**: Full conversational flow allowing users to submit ideas and publish directly from Telegram using webhooks (production) or polling (development).
- **Queue-based Publishing**: BullMQ and Redis for reliable background job processing and exponential backoff retries (1s → 5s → 25s).
- **Secure Data Handling**: AES-256 encryption for OAuth tokens and API keys stored in the database.

## Prerequisites
- Node.js (v18+)
- PostgreSQL (e.g., Neon or Supabase for cloud)
- Redis (e.g., Upstash for cloud with TLS enabled)
- API Keys: Groq API Key, Telegram Bot Token

## How It Works
1. **User Connection**: The user signs up via the API and connects their social media accounts. Social account tokens are encrypted.
2. **Idea Submission**: The user submits a short idea via the API dashboard or directly to the Telegram bot.
3. **AI Generation**: The `aiEngine` queries Groq (LLaMA 3) with a system prompt that specifies character limits, hashtags, and formatting rules for each requested platform. It parses the returned JSON.
4. **Queue & Workers**: The system generates records in the PostgreSQL database and pushes "publish" jobs to the BullMQ Redis queue.
5. **Mock Publishing**: Background workers process the jobs, simulating external API calls to Twitter, LinkedIn, etc., updating the DB on success or utilizing exponential backoff on failure.

## Project Structure
```text
.
├── prisma/                 # Database schema and seed scripts
│   └── schema.prisma       # Relational models (Users, Posts, PlatformPosts, etc.)
├── src/                    # Main application code
│   ├── bot/                # Telegram Bot webhook/polling logic
│   ├── config/             # DB & Redis connection setups
│   ├── controllers/        # Route controllers (Auth, Content, Posts, User)
│   ├── middleware/         # Express middlewares (JWT auth, error handler, validation)
│   ├── queues/             # BullMQ setup and background workers
│   ├── routes/             # API routing
│   ├── services/           # AI Engine and Mock Social Media APIs
│   ├── utils/              # Encryption, Logger, and API Response wrappers
│   ├── app.js              # Express app setup (cors, helmet, rate-limit)
│   └── index.js            # Main entry point (Bootstraps DB, Redis, Queue, Bot)
├── tests/                  # Jest & Supertest integration test suite
├── package.json            # Scripts and dependencies
└── README.md               # You are here
```

## Local Installation & Setup

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**:
   Copy `.env.example` to `.env` and fill in your secrets.
   ```bash
   cp .env.example .env
   ```
4. **Database Setup**:
   ```bash
   npx prisma generate
   npm run db:migrate
   npm run db:seed
   ```
5. **Start Redis**:
   Ensure your local Redis server is running, or use Docker Compose (`docker-compose up -d redis postgres`).
6. **Run the Application**:
   ```bash
   npm run dev
   ```

## Production Deployment (Render)

1. Create a PostgreSQL Database on Neon or Supabase and a Redis Database on Upstash.
2. Create a new **Web Service** on Render and connect your repository.
3. **Build Command**:
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy
   ```
4. **Start Command**:
   ```bash
   npm start
   ```
5. **Environment Variables**: Add all your keys from `.env` to the Render Dashboard. Make sure to use the `rediss://` TLS connection string for Upstash Redis.
6. Once deployed, set up the Telegram Webhook by visiting:
   ```text
   https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_RENDER_APP_NAME>.onrender.com/webhook/telegram
   ```

## Running Tests
```bash
npm test
```

## License
MIT License
