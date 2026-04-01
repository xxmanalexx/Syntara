# Syntara — AI Instagram Content OS

> An AI-native, Instagram-first content automation platform for solopreneurs and small teams. Generate on-brand captions, visuals, and scheduling strategy — all from one workspace.

⚠️ **Status:** Syntara v0.1.0 MVP scaffold — fully typed, zero TS errors. Push to GitHub pending PAT scope resolution (see [#getting-started](#getting-help)).

---

## 🎯 What Syntara Does

| Step | What happens |
|------|-------------|
| **1. Connect** | Link your Instagram Professional account via Meta OAuth |
| **2. Define your brand** | Set voice, tone, audience, style keywords, banned phrases |
| **3. Create** | Describe your post in plain language — Syntara generates 3 caption variants, hook/body/CTA structure, hashtags, and visual prompts |
| **4. Generate visuals** | AI-generated images via Nano Banana — create, regenerate, or vary your visuals |
| **5. Score & refine** | Real-time readiness scoring (brand alignment, completeness, hook strength) |
| **6. Schedule** | Pick a time — Syntara publishes when your audience is most active |
| **7. Learn** | Analytics sync back to measure what worked |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Next.js 14 App Router                   │
│  /login  /onboarding  /dashboard  /create  /drafts  /calendar   │
│  /analytics  /settings  /drafts/[id]                             │
├─────────────────────────────────────────────────────────────────┤
│                         API Routes (11 routes)                   │
│  auth · brands · drafts · images · schedules · instagram · cron │
├──────────────┬──────────────┬────────────────────────────────────┤
│   Ollama     │  Nano Banana  │         Instagram / Meta           │
│  Text +      │  Image Gen    │         OAuth + Publishing         │
│  Embeddings  │  Provider     │         (two-step container)      │
│              │  Adapter       │                                    │
├──────────────┴──────────────┴────────────────────────────────────┤
│                      Core Services Layer                          │
│  DraftService · BrandProfileService · SchedulingService          │
│  AnalyticsSyncService · ContentScoringService                    │
├─────────────────────────────────────────────────────────────────┤
│                      Background Workers                           │
│  publish-worker · analytics-worker · ollama-health-worker        │
├─────────────────────────────────────────────────────────────────┤
│                      Prisma ORM → PostgreSQL                      │
│  20+ models: User, Workspace, BrandProfile, Draft, DraftVariant, │
│  DraftSection, MediaAsset, ScheduledPost, AnalyticsSnapshot...   │
└─────────────────────────────────────────────────────────────────┘
```

### Integrations

| Integration | Purpose | Adapter |
|-------------|---------|---------|
| **Ollama** | Caption generation, rewriting, hashtag extraction, reel scripts, hook analysis | `lib/integrations/ollama/` |
| **Nano Banana** | Text-to-image, image editing, variations | `lib/integrations/nanobanana/` |
| **Instagram API** | OAuth, publishing (two-step), analytics sync | `lib/integrations/instagram/` |

### Key Design Decisions

- **Provider adapter pattern** — image generation uses a Nano Banana adapter; swap internals without touching the rest of the codebase
- **Prompt lineage** — every generated image stores its full `PromptVersion` chain for traceability
- **Idempotent publishing** — duplicate detection via Instagram container ID before publish
- **Rate-limit aware scheduling** — retry logic with exponential backoff on 429 responses
- **Readiness scoring** — content graded on hook strength, brand alignment, completeness, and media presence before publishing is allowed

---

## 📁 Project Structure

```
Syntara/
├── app/
│   ├── page.tsx                    # Landing / marketing page
│   ├── login/page.tsx             # Auth — login
│   ├── onboarding/page.tsx        # Brand profile setup wizard
│   ├── dashboard/
│   │   ├── layout.tsx             # Dashboard shell with sidebar
│   │   └── page.tsx               # Overview + quick actions
│   ├── create/page.tsx            # AI content generation form
│   ├── drafts/
│   │   ├── page.tsx               # Draft list with status filters
│   │   └── [id]/
│   │       └── page.tsx           # Full editor — caption / visuals / preview / insights
│   ├── calendar/page.tsx          # Scheduled post calendar view
│   ├── analytics/page.tsx         # Performance dashboard
│   └── settings/page.tsx          # Account + Instagram connection
│   └── api/                       # 11 Route Handlers
│       ├── auth/{login,register,session}/
│       ├── brands/
│       ├── drafts/{,generate,[id]}/
│       ├── images/generate/
│       ├── instagram/{connect,callback}/
│       ├── ollama/health/
│       ├── schedules/
│       └── cron/{publish,analytics}/
│
├── lib/
│   ├── db.ts                      # Prisma singleton
│   ├── utils.ts                   # Formatting, date helpers, cn()
│   ├── validation.ts              # Zod schemas for all inputs
│   │
│   ├── integrations/
│   │   ├── ollama/
│   │   │   ├── client.ts          # HTTP client, retries, timeouts, streaming
│   │   │   ├── content-service.ts # All 8 content generation methods
│   │   │   ├── embedding-service.ts
│   │   │   └── index.ts
│   │   ├── nanobanana/
│   │   │   ├── client.ts          # Image gen HTTP client, 3 endpoints
│   │   │   ├── image-service.ts   # Draft-aware image ops (generate, regenerate, edit, variants)
│   │   │   ├── types.ts           # All Nano Banana types
│   │   │   └── index.ts
│   │   └── instagram/
│   │       ├── types.ts           # Instagram API types
│   │       ├── auth-service.ts    # Meta OAuth flow
│   │       ├── publishing-service.ts # Two-step publish, carousel, rate limit handling
│   │       └── index.ts
│   │
│   ├── services/
│   │   ├── draft-service.ts       # CRUD + variant management
│   │   ├── brand-service.ts       # BrandProfile CRUD + Zod validation
│   │   ├── scheduling-service.ts  # Optimal time calculation, scheduling
│   │   ├── analytics-service.ts   # IG metrics sync, engagement rates
│   │   └── scoring-service.ts     # Readiness, brand, completeness, insight generation
│   │
│   └── workers/
│       ├── publish-worker.ts      # Cron-triggered publish queue processor
│       ├── analytics-worker.ts    # Periodic analytics sync
│       └── ollama-health-worker.ts # Periodic Ollama health checks
│
├── prisma/
│   └── schema.prisma              # 20+ models, all enums, PostgreSQL
│
├── types/
│   └── index.ts                   # All TypeScript types + enums (single file)
│
├── .env.example                   # All required environment variables
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🗄️ Database Schema

20 models across 5 domains:

**Identity & Workspace**
- `User` — email, password hash, timestamps
- `Workspace` — user's isolated workspace

**Brand**
- `BrandProfile` — voice, tone, style keywords, banned phrases, visual references
- `ContentSource` — raw input topics, links, briefs

**Content**
- `Draft` — all post content, scores, metadata
- `DraftVariant` — A/B caption variants stored as JSON
- `DraftSection` — structured sections: hook, body, CTA, hashtags, script, shot list
- `DraftMedia` — draft-to-asset join table with primary flag

**Media**
- `MediaAsset` — image/video/carousel assets (uploaded or AI-generated)
- `ImageGenerationJob` — job tracking with status + error messages
- `PromptVersion` — full prompt lineage for every generated image

**Publishing & Analytics**
- `SocialAccount` — Instagram OAuth tokens, account metadata, professional flag
- `ScheduledPost` — scheduled publish with retry state
- `PublishAttempt` — per-attempt result log
- `AnalyticsSnapshot` — synced IG metrics (likes, comments, reach, impressions)
- `ContentInsight` — AI-generated content tips (hook strength, brand alignment, gaps)
- `UsageEvent` — usage logging for all generations

---

## 🔌 API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Email/password login → JWT session cookie |
| `/api/auth/register` | POST | Create account with hashed password |
| `/api/auth/session` | GET | Validate session, return user data |
| `/api/brands` | GET/POST | List and create brand profiles |
| `/api/drafts` | GET/POST | List and create drafts |
| `/api/drafts/[id]` | GET/PATCH/DELETE | Single draft operations |
| `/api/drafts/generate` | POST | Trigger full AI content generation pipeline |
| `/api/images/generate` | POST | Generate image via Nano Banana |
| `/api/schedules` | GET/POST/PATCH | Manage scheduled posts |
| `/api/instagram/connect` | GET | Start Meta OAuth flow |
| `/api/instagram/callback` | GET | Handle OAuth callback, store tokens |
| `/api/ollama/health` | GET | Check Ollama is reachable |
| `/api/cron/publish` | POST | Trigger publish worker (protected by CRON_SECRET) |
| `/api/cron/analytics` | POST | Trigger analytics sync (protected by CRON_SECRET) |

---

## 🧠 Ollama Content Generation Methods

`OllamaContentService` exposes 8 generation methods, all with JSON schema validation and Zod output parsing:

| Method | Output |
|--------|--------|
| `generateCaption(brandId, contentType, topic)` | Hook + body + CTA + hashtags (structured JSON) |
| `generateCaptionVariants(brandId, topic, numVariants)` | 3 tone-shifted caption variants |
| `rewriteCaption(brandId, caption, instruction)` | Rewrites from natural language instruction |
| `generateHashtags(brandId, caption)` | Ranked 1–30 hashtags with reasoning |
| `extractContentTopics(rawText)` | Parsed topics, themes, tone from raw input |
| `analyzeHookStrength(caption)` | Hook quality 0–100 + improvement suggestions |
| `generateReelScript(brandId, topic)` | Hook + body + CTA + shot list (structured JSON) |
| `generateVisualPrompt(brandId, topic, style?)` | Detailed SD image prompt |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 15+** (Neon, Supabase, or local)
- **Ollama** running locally (`ollama serve`) — [ollama.ai](https://ollama.ai)
- **Nano Banana API key** — from [nanobanana.io](https://nanobanana.io)
- **Meta Developer App** — [developers.facebook.com](https://developers.facebook.com)

### 1. Clone & Install

```bash
git clone https://github.com/xxmanalexx/Syntara.git
cd Syntara
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values (see Configuration section below)
```

### 3. Database Setup

```bash
# Push schema to your PostgreSQL database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 4. Start Ollama

```bash
ollama serve
# In another terminal:
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔧 Configuration

### Required Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Neon PostgreSQL example)
DATABASE_URL=postgresql://user:password@host:5432/syntara?sslmode=require

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TEXT_MODEL=llama3.2:latest
OLLAMA_EMBEDDINGS_MODEL=nomic-embed-text:latest

# Nano Banana (image generation)
NANO_BANANA_API_KEY=your-api-key
NANO_BANANA_BASE_URL=https://api.nanobanana.io/v1

# Meta / Instagram
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret
META_REDIRECT_URI=http://localhost:3000/api/instagram/callback

# Auth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
ENCRYPTION_KEY=64-hex-chars-for-aes-256

# Cron (protect internal webhooks)
CRON_SECRET=your-random-secret
```

### Meta App Setup

1. Create app at [developers.facebook.com](https://developers.facebook.com)
2. Add **Instagram Graph API** product
3. Configure OAuth redirect: `http://localhost:3000/api/instagram/callback`
4. Set required scopes: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_read_engagement`
5. Add test Instagram user in Roles → Test Users

### Ollama Model Notes

The `OLLAMA_TEXT_MODEL` must support JSON tool/schema output for best results. `llama3.2:latest` is recommended. For embeddings, `nomic-embed-text` provides high-quality vectors for semantic matching.

---

## 📊 Content Scoring System

Every draft gets three scores computed by `ContentScoringService`:

| Score | Range | What it checks |
|-------|-------|----------------|
| **Readiness** | 0–100 | Is the post ready to publish? (hook, CTA, media present, no banned phrases) |
| **Brand Alignment** | 0–100 | Does tone/voice match the BrandProfile settings? |
| **Completeness** | 0–100 | Are all required fields filled for the content type? |

Scoring runs automatically after each AI generation and on every draft save.

---

## ⏰ Scheduling Logic

`SchedulingService` calculates optimal posting windows based on:

1. User's historical engagement patterns (synced from Instagram analytics)
2. Timezone-aware slot generation (default: 08:00, 12:00, 17:00, 20:00 GMT)
3. Rate limit protection — max 2 posts per Instagram Professional account per 24h

---

## 🔒 Security Notes

- Social account access/refresh tokens are encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`)
- Cron routes protected by `CRON_SECRET` bearer token
- JWT sessions via `jose` library with RS256/HS256
- Banned phrases enforced server-side — checked by `scoring-service` before publishing

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v3 |
| Database | PostgreSQL via Prisma 5 |
| Auth | Custom JWT (jose) + bcrypt |
| Validation | Zod |
| AI Text | Ollama (local LLM) |
| AI Images | Nano Banana API |
| Social | Instagram Graph API via Meta |
| Icons | Lucide React |
| State | React Hook Form + TanStack Query |

---

## 📦 Available Scripts

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run typecheck    # TypeScript type check (zero errors)
npm run db:push      # Push Prisma schema to DB
npm run db:migrate   # Run migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with sample data
```

---

## 🐛 Known Issues

- **GitHub push blocked** — PAT lacks `repo` scope for Syntara repo; push pending PAT scope resolution. Workaround: clone locally and push from machine with full-scope token.
- **Instagram webhook** — webhook route is scaffolded but not yet wired in the app (container creation + publish happens in `publishing-service.ts`; webhook verification endpoint needs registration in Meta Developer Portal)
- **Redis not wired** — `REDIS_URL` is in env but background jobs use in-process queues; swap for BullMQ + Redis for production concurrency
- **No email delivery** — transactional emails (magic link, digest) need an email provider (Resend, Postmark) wired into the auth routes

---

## 🛤️ Roadmap

- [ ] Wire Instagram webhook route + register in Meta Developer Portal
- [ ] Visual drag-and-drop flow builder for content workflows
- [ ] Real Cal.com booking API for appointment posts
- [ ] Web chat widget JS embed (for website widget)
- [ ] Full analytics dashboard with charts (Recharts)
- [ ] Bulk CSV import for content sources
- [ ] Team collaboration (multi-workspace roles)
- [ ] Mobile-responsive UI pass
- [ ] Nightly FollowUpAgent cron job (rescue unresponded DMs)
- [ ] Slack escalation notifications
- [ ] Full test suite (Vitest + Playwright)
- [ ] CI/CD pipeline (GitHub Actions)

---

## 📄 License

MIT — © 2025 xxmanalexx

---

*Built with 🦾 by Rana, Abdalla's AI employee.*
