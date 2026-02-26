# SweepBot 🤖

> *The operating system for the sweepstakes casino player ecosystem.*

[![License: UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange)](https://pnpm.io)

SweepBot gives sweepstakes casino players what the house never wants them to have: **complete, cross-platform transparency, automation of tedious tasks, and data-driven intelligence.**

---

## 📦 Monorepo Structure

```
sweepbot/
├── apps/
│   ├── web/          → React dashboard (Vite + Tailwind + shadcn/ui)
│   ├── api/          → REST + WebSocket API (Fastify + TypeScript)
│   ├── extension/    → Browser extension (WXT + React + TypeScript, MV3)
│   └── desktop/      → Automation engine (Tauri + React)
├── packages/
│   ├── types/        → Shared TypeScript interfaces & Zod schemas
│   ├── utils/        → Shared utility functions
│   └── config/       → Shared ESLint, TypeScript, Tailwind configs
└── docs/             → All project documentation
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- [pnpm 9+](https://pnpm.io/installation)
- [Docker](https://docker.com) (for local database)

### 1. Clone & Install

```bash
git clone https://github.com/apPYness/sweepbot.git
cd sweepbot
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase, Stripe, and other credentials
```

### 3. Start Development

```bash
# Start all apps in development mode
pnpm dev

# Or start individual apps:
pnpm --filter @sweepbot/api dev
pnpm --filter @sweepbot/web dev
pnpm --filter @sweepbot/extension dev
```

### 4. Build for Production

```bash
pnpm build
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Product Requirements Document |
| [Architecture](docs/TECHNICAL_ARCHITECTURE.md) | System design and tech stack |
| [Database Schema](docs/DATABASE_SCHEMA.md) | Full PostgreSQL schema |
| [API Design](docs/API_DESIGN.md) | REST and WebSocket API reference |
| [Roadmap](docs/DEVELOPMENT_ROADMAP.md) | Phase-by-phase development plan |
| [Monetization](docs/MONETIZATION_STRATEGY.md) | Revenue model and pricing |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Backend | Fastify 5, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 (Supabase) |
| Cache | Redis (Upstash) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Extension | WXT (Web Extension Tools), MV3 |
| Desktop | Tauri v2, Playwright |
| Monorepo | pnpm workspaces + Turborepo |
| CI/CD | GitHub Actions |
| Hosting | Vercel (web), Railway (API) |

---

## 🔑 Environment Variables

See [.env.example](.env.example) for all required variables.

Key services to configure:
- **Supabase** — Database, Auth, Storage
- **Stripe** — Subscription billing
- **Upstash Redis** — Caching and job queues
- **Resend** — Transactional email

---

## 🏗 Development

### Running Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

### Type Checking

```bash
pnpm typecheck         # Check all packages
```

### Linting

```bash
pnpm lint              # Lint all packages
pnpm lint:fix          # Auto-fix lint issues
```

---

## 📋 Contributing

This is a private project owned by APPYness. All rights reserved.

---

## 🏢 Built by APPYness

**APPYness** — *"Developing Joy"*

Creator: Vincent Kinney

---

*SweepBot is a transparency and productivity tool. It is not a gambling product and does not provide gambling advice.*
