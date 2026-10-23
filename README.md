# CareerHub

CareerHub is a MERN MVP for tracking job and internship applications and remembering **which resume version** you submitted to each opportunity. It also includes an AI resume tailor powered by Google Gemini.

The product name in the UI is **CareerHub**. Resume files live on Cloudinary. Application data lives in MongoDB.

## What it does

- Register / login with JWT stored in an HTTP-only cookie
- Upload named resume PDF versions
- Track applications (company, role, JD, status, notes)
- Link one resume version to each application
- Dashboard counts
- Resume library with view / download / delete
- AI tailor that rewrites **only existing resume content**
- Download a clean generated PDF of the tailored resume
- Marketing landing page at `/` that connects to login, register, and the dashboard

## Folder structure

```text
carrerHub/
  README.md
  backend/
    server.js
    config/          db + Cloudinary
    models/          User, Resume, JobApplication
    controllers/     auth, resume, job, ai
    routes/
    middleware/      auth, upload, errors
    services/        Cloudinary, Gemini, PDF text, PDF build
    utils/
  frontend/
    src/
      pages/         landing, auth, dashboard, apps, library, AI
      components/
      layouts/
      context/
      services/      Axios API client
      routes/        protected + public-only
```

## Data flow

1. Browser talks to Express at `/api/*` with cookies.
2. Auth routes set an HTTP-only JWT cookie. Protected routes read it and attach `req.user`.
3. Resume PDFs go: browser → Multer (memory) → Cloudinary → MongoDB stores URL + `publicId` + name/version (never the PDF bytes).
4. Job applications are MongoDB documents owned by `user`. `resume` is an ObjectId pointing at that user's Resume.
5. AI tailor: browser sends JD text/file + resume id/file → backend extracts text → Gemini on the **server** → JSON → UI. Download uses PDFKit to build a readable PDF from that JSON.
6. Every resume/job query is scoped with `{ user: req.user._id }`. IDs in the URL cannot read another user's data.

## 1. Requirements

- Node.js 18+
- npm
- Local MongoDB running on `127.0.0.1:27017`
- A free [Cloudinary](https://cloudinary.com/) account
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/apikey))

MongoDB Atlas is not required. Later you can switch by changing `MONGODB_URI` only.

## 2. Install dependencies

From the project root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## 3. Start local MongoDB

Windows (if MongoDB is installed as a service, it may already be running). Otherwise:

```bash
mongod
```

The app uses this database by default:

```text
mongodb://127.0.0.1:27017/resumevault
```

## 4. Create a Cloudinary account

1. Sign up at https://cloudinary.com/
2. Open the dashboard
3. Copy **Cloud name**, **API Key**, and **API Secret**

PDFs are uploaded as Cloudinary raw files under `careerhub/resumes`.

## 5. Get a Gemini API key

1. Open https://aistudio.google.com/apikey
2. Create an API key
3. Paste it into `backend/.env` as `GEMINI_API_KEY`

The key is used only on the backend. It is never sent to the browser.

If a model name is unavailable on your account, set `GEMINI_MODEL` (for example `gemini-2.0-flash` or `gemini-1.5-flash`).

## 6. Create `.env` files

### Backend

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/resumevault
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
```

### Frontend

`frontend/.env.example` (already copied to `frontend/.env` for local use):

```env
VITE_API_URL=http://localhost:5000/api
```

## 7. Start backend

```bash
cd backend
npm run dev
```

You should see:

```text
MongoDB connected: 127.0.0.1
CareerHub API running on http://localhost:5000
```

Health check: http://localhost:5000/api/health

## 8. Start frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

## 9. Open the application

Open http://localhost:5173

- Landing page: `/`
- Register: `/register`
- Login: `/login`
- App (after login): `/dashboard`, `/applications`, `/resumes`, `/ai-tailor`

## Architecture (interview-friendly)

### Models (3)

- **User** — name, email, hashed password
- **Resume** — name, version, Cloudinary URL / publicId, owner
- **JobApplication** — job fields, status, optional `resume` reference, owner

### API

| Area | Base path |
| --- | --- |
| Auth | `/api/auth` |
| Resumes | `/api/resumes` |
| Jobs | `/api/jobs` |
| Dashboard stats | `/api/jobs/dashboard` |
| AI | `/api/ai` |

### Auth

- Passwords hashed with bcrypt
- JWT signed with `JWT_SECRET`
- Token stored in an HTTP-only cookie (`token`)
- `protect` middleware rejects missing/invalid sessions
- Ownership is taken from `req.user`, never from the request body

### AI safety

Gemini is instructed: never fabricate skills, projects, jobs, metrics, or certifications. It may reorder and rewrite existing content. Missing JD requirements are listed under `missingFromResume` instead of being added.

The tailored download is a **clean PDF generated from the AI JSON**, not a pixel-perfect edit of the original PDF layout. That is the practical MVP approach.

Scanned image-only PDFs may not extract text. Use a text-based PDF.

## 11. How to deploy later

1. Put MongoDB on Atlas and set `MONGODB_URI` to the Atlas connection string. No code change.
2. Host the API (Render, Railway, Fly, a VPS). Set `NODE_ENV=production`, a strong `JWT_SECRET`, and `CLIENT_ORIGIN` to your frontend URL.
3. Host the frontend (Vercel, Netlify, Cloudflare Pages). Set `VITE_API_URL` to `https://your-api.example.com/api`.
4. Keep Cloudinary and Gemini keys on the **server** only.
5. In production, cookies use `secure` + `sameSite=none` so they work across domains over HTTPS.

## Limitation (honest)

The AI cannot surgically restyle your original PDF. It extracts text, produces structured JSON, and CareerHub builds a simple readable PDF from that output.
