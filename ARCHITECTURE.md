# Architecture Document

## High-Level Overview
Postly uses a typical N-Tier architecture built on Express.js, integrating external APIs (LLMs, Telegram) and async job processing.

- **Client Layer**: Telegram Bot / Web Clients.
- **API Layer**: Express.js REST APIs with robust validation and security middleware.
- **Service Layer**: Business logic for content generation (`aiEngine`), user management, and orchestration.
- **Queue/Worker Layer**: BullMQ backed by Redis for asynchronous, fault-tolerant job processing.
- **Data Layer**: PostgreSQL managed via Prisma ORM for relational persistence.

## System Components

### 1. Web API Server
Handles HTTP requests, authenticates users (JWT), validates payloads (`express-validator`), and coordinates the flow. Exposes endpoints for Dashboard, Posts, Content Generation, and Auth.

### 2. Telegram Bot Interface
Operates via webhooks in production and long-polling in development. Maintains conversation state in Redis (with TTLs) to guide the user through idea submission -> tone selection -> AI generation -> confirmation.

### 3. AI Engine Service
Abstracts interactions with OpenAI and Anthropic SDKs. Builds platform-specific system prompts dynamically to ensure length and tone constraints are met, returning structured JSON.

### 4. Publishing Queue
To prevent the application from hanging during third-party API calls, all publishing actions are enqueued in Redis via BullMQ. Separate Worker instances process these jobs, allowing for features like:
- Exponential backoff retries (1s -> 5s -> 25s)
- Delayed/Scheduled publishing

### 5. Database Schema
- **User / RefreshToken**: Manages core identities and session security.
- **SocialAccount / AiKey**: Stores encrypted credentials for external services.
- **Post / PlatformPost**: Represents the parent post idea and its platform-specific child variations.

## Security Practices
- Rate limiting implemented via `express-rate-limit`.
- Passwords hashed with `bcrypt` (cost 12).
- Sensitive OAuth tokens and user API keys are encrypted at rest using AES-256 via `crypto-js`.
- Short-lived Access Tokens (15m) and revokable Refresh Tokens (7d).
