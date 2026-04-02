# Syntara — AI Instagram Content OS

> Generate, schedule, and publish Instagram posts with AI — all from one workspace.

---

## What it does

1. **Connect** your Instagram Professional account (Meta OAuth)
2. **Define your brand** — voice, tone, audience, style, banned phrases
3. **Create** — describe your post in plain language, get AI-generated captions, hashtags, visual prompts, and scored drafts
4. **Attach media** — paste an image URL or upload from your device
5. **Publish** — one click posts to Instagram directly

---

## Tech Stack

| Layer | Technology |
|---|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 strict |
| Styling | Tailwind CSS v3 |
| Database | PostgreSQL (Neon) via Prisma 5 |
| Auth | JWT (jose) + bcrypt |
| AI Text | Ollama (local LLM) |
| AI Images | Nano Banana API |
| Social | Instagram Graph API (Meta) |
| CDN | Cloudinary (image uploads for publishing) |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (Neon recommended for free tier)
- Ollama running locally — [ollama.ai](https://ollama.ai)
- Meta Developer App — [developers.facebook.com](https://developers.facebook.com)
- Cloudinary account (free) — [cloudinary.com](https://cloudinary.com) — for image publishing

---

### 1. Clone & Install

```bash
git clone https://github.com/xxmanalexx/Syntara.git
cd Syntara
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. All variables are documented in `.env.example`.

### 3. Database Setup

```bash
npx prisma db push
npx prisma generate
```

### 4. Start Ollama

```bash
ollama serve
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Docker Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### Quick Start

```bash
# Start all services (Postgres + App)
docker compose up --build

# App runs at http://localhost:3000
# PostgreSQL exposed on port 5432
```

### Docker Compose Services

| Service | Port | Notes |
|---|---|---|
| `app` | 3000 | Next.js dev server |
| `postgres` | 5432 | PostgreSQL 15, `syntara` database |

### Persisted Volumes

- `postgres_data` — PostgreSQL data directory
- `./public/media` — locally uploaded images (gitignored)

### Environment Variables

Copy `.env.example` to `.env` and fill in values before running `docker compose up`:

```bash
cp .env.example .env
# Edit .env with your secrets
docker compose up --build
```

The Docker setup uses your host's CPU for Ollama (run `ollama serve` separately on your host machine).

### Stopping

```bash
docker compose down        # stop containers
docker compose down -v      # stop + destroy database volume
```

---

## Meta App Setup

1. Create an app at [developers.facebook.com](https://developers.facebook.com) → **Create App** → choose **Consumer** or **Business** type
2. Add **Instagram Graph API** product to your app
3. In **Settings → Basic**, copy **App ID** and **App Secret** to your `.env`
4. Configure OAuth redirect URI:
   - Settings → Instagram Basic Display → Valid OAuth Redirect URIs:
   - `http://localhost:3000/api/instagram/callback`
5. Required OAuth scopes:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `instagram_manage_contents`
6. Add a test Instagram user: **Roles → Roles** → Add Test Users

### Enabling OAuth Client Flow

If you get implicit flow errors during connect:
1. In Meta Developer Portal → your app → **Products → Facebook Login** → **Settings**
2. Enable **OAuth Client Flow**
3. Set **Valid OAuth Redirect URIs** to `http://localhost:3000/api/instagram/callback`

---

## Cloudinary Setup (Required for Publishing)

Instagram needs publicly accessible image URLs. Syntara uses Cloudinary to proxy local uploads.

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25 credits/month)
2. Copy your **Cloud Name** from the Dashboard
3. Create an upload preset:
   - **Settings** → **Upload** → **Upload presets** → **Add upload preset**
   - Name: `syntara`
   - **Signing Mode**: **Unsigned**
   - Save
4. Add to `.env`:
   ```env
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   NEXT_PUBLIC_CLOUDINARY_PRESET=syntara
   ```

---

## Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntara?sslmode=prefer

# Auth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

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

# Cloudinary (required for publishing)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_PRESET=syntara

# Cron (protect internal webhooks)
CRON_SECRET=your-random-secret
```

---

## Project Structure

```
Syntara/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx             # Login
│   ├── onboarding/page.tsx        # Brand setup wizard
│   ├── dashboard/page.tsx         # Overview with real data
│   ├── create/page.tsx            # AI content generation
│   ├── drafts/
│   │   ├── page.tsx               # Draft list
│   │   └── [id]/page.tsx          # Draft editor
│   ├── calendar/page.tsx          # Schedule calendar
│   ├── analytics/page.tsx         # Performance metrics
│   ├── settings/page.tsx          # Account + IG connection
│   └── api/                       # Route handlers
│       ├── auth/{login,register,session}/
│       ├── brands/
│       ├── drafts/{,generate,[id],[id]/publish,[id]/upload,[id]/media}/
│       ├── dashboard/
│       ├── images/generate/
│       ├── instagram/{connect,callback}/
│       ├── ollama/health/
│       └── schedules/
├── lib/
│   ├── integrations/
│   │   ├── ollama/                # Content generation
│   │   ├── instagram/             # OAuth + publishing
│   │   ├── nanobanana/            # Image generation
│   │   └── cloudinary-upload.ts   # CDN proxy for IG
│   └── services/                  # Business logic
├── prisma/
│   └── schema.prisma              # 20+ models
└── public/media/                  # Local image uploads
```

---

## Available Scripts

```bash
npm run dev          # Dev server (localhost:3000)
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
