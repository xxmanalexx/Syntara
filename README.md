# Syntara — AI Instagram Growth OS

> AI-powered Instagram content creation, scheduling, inbox management, and lead tracking — all from one workspace.

---

## Features

- **AI Content Generation** — describe a post in plain language, get captions, hashtags, visual prompts, and scored drafts
- **Brand Setup** — define voice, tone, audience, style, and banned phrases
- **Schedule & Publish** — visual calendar, one-click publishing to Instagram
- **AI Inbox** —Conversations, auto-replies, and DM management
- **Lead Tracking** — pipeline view with stage management and activity logs
- **Analytics** — performance metrics for posts and leads
- **Growth OS** — task management, message templates, and Instagram webhooks

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 strict |
| Styling | Tailwind CSS v3 |
| Database | PostgreSQL (Neon) via Prisma 5 |
| Auth | JWT via `jose` + `bcrypt` |
| AI Text | Ollama (local LLM) |
| AI Images | Nano Banana API |
| Social | Instagram Graph API (Meta) |
| CDN | Cloudinary (image proxy for IG publishing) |
| Icons | Lucide React |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (Neon recommended — free tier)
- Ollama running locally — [ollama.ai](https://ollama.ai)
- Meta Developer App — [developers.facebook.com](https://developers.facebook.com)
- Cloudinary account (free) — [cloudinary.com](https://cloudinary.com)

---

## Quick Start

```bash
git clone https://github.com/xxmanalexx/Syntara.git
cd Syntara
npm install
cp .env.example .env   # fill in your values
npx prisma db push
npx prisma generate
ollama serve
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/dashboard`.

---

## Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Neon or local)
DATABASE_URL=postgresql://user:password@host:5432/syntara?sslmode=prefer

# Auth
NEXTAUTH_SECRET=openssl rand -base64 32

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TEXT_MODEL=llama3.2:latest
OLLAMA_EMBEDDINGS_MODEL=nomic-embed-text:latest

# Nano Banana (image generation)
NANO_BANANA_API_KEY=your-api-key
NANO_BANANA_BASE_URL=https://api.nanobanana.io/v1

# Meta / Instagram
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=http://localhost:3000/api/instagram/callback

# Cloudinary (required for IG publishing)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_PRESET=syntara

# Cron webhooks (protect internal routes)
CRON_SECRET=your-random-secret
```

---

## Meta App Setup

1. Create an app at [developers.facebook.com](https://developers.facebook.com) → **Create App** → Consumer or Business type
2. Add **Instagram Graph API** product
3. In **Settings → Basic**, copy **App ID** and **App Secret** to `.env`
4. Configure OAuth redirect URI:
   `http://localhost:3000/api/instagram/callback`
5. Required scopes: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_messages`, `instagram_manage_comments`, `instagram_manage_contents`
6. Add a test Instagram user: **Roles → Roles → Add Test Users**

> **OAuth note:** Meta's implicit flow often fails to exchange tokens. If you get auth errors, use the direct token save endpoint at `/api/settings/accounts/save-token` instead of the standard OAuth flow.

---

## Cloudinary Setup

Instagram requires publicly accessible image URLs. Syntara uses Cloudinary to proxy uploads.

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier)
2. Copy your **Cloud Name** from the Dashboard
3. Create an unsigned upload preset named `syntara`:
   **Settings → Upload → Upload presets → Add upload preset → Signing Mode: Unsigned**
4. Add to `.env`:
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   NEXT_PUBLIC_CLOUDINARY_PRESET=syntara
   ```

---

## Docker

```bash
cp .env.example .env   # fill in values first
docker compose up --build
```

App runs at `http://localhost:3000`. PostgreSQL is exposed on port `5432`. Ollama must be running on your host machine.

```bash
docker compose down        # stop
docker compose down -v     # stop + destroy database volume
```

---

## Project Structure

```
Syntara/
├── app/                          # Next.js App Router pages
│   ├── (app)/                    # Authenticated routes (redirects to /dashboard)
│   ├── api/                      # Route handlers
│   │   ├── auth/                # login, register, session
│   │   ├── brands/              # brand setup
│   │   ├── drafts/              # content drafts + generation
│   │   ├── images/              # AI image generation
│   │   ├── instagram/            # OAuth + publishing
│   │   ├── inbox/                # conversation + DM management
│   │   ├── leads/                # lead CRUD + pipeline
│   │   ├── schedules/            # post scheduling
│   │   ├── settings/             # account + IG token management
│   │   ├── tasks/                # task management
│   │   ├── templates/            # message templates
│   │   └── webhooks/meta/        # IG webhook receiver
│   └── login/, /onboarding/, /signup/
├── lib/
│   ├── integrations/             # Ollama, Instagram, Nano Banana, Cloudinary
│   └── services/                 # Business logic
├── prisma/schema.prisma          # 30 models
└── public/media/                 # Local image uploads
```

---

## Available Scripts

```bash
npm run dev          # Dev server → localhost:3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run db:push      # Push schema to DB
npm run db:generate  # Generate Prisma client
npm run db:studio    # Prisma Studio
```

---

## Roadmap

- [ ] Analytics dashboard with charts
- [ ] Visual flow builder for content workflows
- [ ] Real Cal.com booking integration
- [ ] Web chat widget JS embed
- [ ] Bulk CSV content import
- [ ] Team collaboration (multi-workspace)
- [ ] Instagram webhook for DM automation
- [ ] Mobile-responsive UI pass
- [ ] Full test suite
- [ ] CI/CD pipeline

---

## License

MIT

---

*Built with 🦾 by Rana, Abdalla's AI employee.*
