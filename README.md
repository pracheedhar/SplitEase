# SplitEase — Production-Grade Expense Split Calculator

SplitEase is a production-grade expense split calculator designed for roommates, trips, and events. It supports multi-payer expenses, detailed balance tracking, transaction settlement optimization using the min-cash-flow algorithm, theme selection, mobile responsiveness, downloadable summaries, and comprehensive security controls.

## 🏗️ System Architecture

```mermaid
graph TD
    Client[Next.js Client] --> Gateway[API Gateway / Rate Limiter]
    Gateway --> Auth[JWT Authentication Middleware]
    Auth --> Service[Expense Service]
    Service --> Balance[Balance Engine]
    Balance --> Cache[Redis Cache / Exchange Rates]
    Balance --> DB[(MongoDB Database)]
    Gateway --> Audit[Write Audit Logger Middleware]
    Audit --> DB
```

### Flow Components:
1. **Client**: Next.js App Router with responsive layouts. Uses Axios interceptors for silent token refresh and custom React theme context.
2. **API Gateway / Limiter**: Rate limiters (100req/15min global, 10req/15min for authentication endpoints) to prevent brute-force attacks.
3. **JWT Authentication**: Protects routes using access tokens (15m expiration, in-memory) and HTTP-only refresh tokens (7d expiration, rotated cookie) with reuse detection.
4. **Expense Service**: Implements business logic for managing expenses across 4 split types (equal, exact, percentage, shares).
5. **Balance Engine**: Core math calculation engine that tracks net balances and uses the **Min-Cash-Flow** algorithm to optimize payment suggestions.
6. **Redis Cache**: Caches third-party exchange rates with a 1-hour TTL to ensure speed and rate-limit compliance.
7. **Write Audit Logger**: Automatically intercepts backend write operations (POST, PUT, PATCH, DELETE) and records action records inside database logs.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (TypeScript, App Router, CSS Variables theme engine, Axios)
- **Backend**: Node.js + Express (TypeScript, tsx, Winston logger, Helmet headers, Zod validator)
- **Database**: MongoDB + Mongoose (indexes on all query paths)
- **Cache**: Redis
- **Auth**: JWT (AccessToken in memory, HTTP-only RefreshToken cookie, Google OAuth integration)
- **Testing**: Jest + Supertest (Unit and integration tests with `mongodb-memory-server`)
- **Deployment**: Docker, GitHub Actions, Vercel & Render templates

---

## 🔑 Environment Variables Configuration

Create a `.env.development` or `.env.production` file inside the `server/` directory:

| Variable | Description | Example Value |
|---|---|---|
| `PORT` | Backend listener port | `5001` |
| `NODE_ENV` | Environment identifier | `development` or `production` |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:3000` |
| `API_URL` | Backend base URL for OAuth redirection callback | `http://localhost:5001` or your Render domain |
| `MONGO_URI` | MongoDB Connection URL | `mongodb://localhost:27017/expense_split_dev` |
| `REDIS_URL` | Redis Server connection URI | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for access tokens | `your-very-secure-jwt-access-secret` |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | `your-very-secure-jwt-refresh-secret` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) | `google-oauth-client-id` |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret (optional)| `google-oauth-client-secret` |
| `CLOUDINARY_URL` | Cloudinary credentials URL | `cloudinary://key:secret@cloudname` |

Create a `.env.local` file inside the `client/` directory:

| Variable | Description | Example Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Full URL of the backend API (including `/api/v1` suffix) | `http://localhost:5001/api/v1` (dev) or `https://your-app.onrender.com/api/v1` (prod) |

> **Note:** `NEXT_PUBLIC_API_URL` is required for the frontend to know where to send API requests. Without it, the client defaults to the production Render URL.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose (recommended for MongoDB and Redis setup)

### Step 1: Clone and Install Dependencies
Install all workspace dependencies from the root:
```bash
npm install
```

### Step 2: Spin Up Infrastructure (Docker)
Start MongoDB and Redis using Docker Compose:
```bash
docker compose up -d
```

### Step 3: Run Development Servers
Start both backend (Express) and frontend (Next.js) dev servers concurrently:
```bash
npm run dev
```
- Frontend will be available at `http://localhost:3000`
- Backend will be available at `http://localhost:5001`
- Swagger API Docs will be available at `http://localhost:5001/api/docs`

---

## 🧪 Testing

To run the automated Jest unit and integration tests (including code coverage):
```bash
npm run test:server
```

---

## 💻 Implemented Enhancements & Features

The following updates and features are fully integrated and verified in the codebase:

### 1. Persistent Theme Engine
- **ThemeContext**: Created light/dark toggles utilizing `localStorage` to save choices.
- **SSR Flash Prevention**: Injected a direct inline blocker script into the layout head that loads theme configurations before Next.js page initialization.
- **`useColors()` Hook**: Implemented dynamic colors matching the active theme for components using inline styles.

### 2. Client Split Validations
Added row-by-row live inputs inside the expense form modal:
- **Exact Split**: Sum of individual shares must equal the total expense amount.
- **Percentage Split**: Shows remaining allocations and validates that the sum equals exactly 100%.
- **Shares Split**: Provides weight inputs (defaulting to 1) and shows calculated totals dynamically.

### 3. Mobile Adaptation
- Mobile headers with collapsible side panels.
- Overlay click shields to close the sidebar.
- Responsive structures for analytics tables and list items.

### 4. Text Summary Report Downloader
- Includes a button to download the formatted group summary (`.txt`) containing members, expenses, net balances, and cash-flow-optimized settlement guidelines.

### 5. Write Audit Logging
- Intercepts mutating requests (POST, PATCH, DELETE) to log actors, actions, entities, timestamps, IP addresses, and user agents in the `AuditLog` collection.

---

## 📡 API Endpoint Reference

### 🔐 Authentication (`/api/v1/auth`)
- `POST /register`: Register a new user
- `POST /login`: Login user (sets HTTP-only refresh cookie, returns access token)
- `POST /refresh`: Refresh access token
- `POST /logout`: Logout user (invalidates token)
- `GET /me` (Protected): Get logged-in user profile

### 👥 Groups (`/api/v1/groups`)
- `POST /`: Create a new group
- `GET /`: List groups the user belongs to
- `POST /join`: Join a group via invite code
- `GET /:groupId`: Get group details (members, invite code)
- `PATCH /:groupId` (Admin): Update group metadata
- `DELETE /:groupId` (Admin): Deactivate group
- `POST /:groupId/leave`: Leave group
- `PATCH /:groupId/invite-code` (Admin): Regenerate invite code
- `DELETE /:groupId/members/:memberId` (Admin): Remove member from group

### 💰 Expenses (`/api/v1/groups/:groupId/expenses`)
- `POST /`: Create a new expense (validates split totals)
- `GET /`: Get all group expenses (with search/filter pagination)
- `GET /balances`: Fetch current balance sheet & settlement recommendations
- `GET /:expenseId`: Get details of a single expense
- `PATCH /:expenseId`: Edit an expense (recalculates balances)
- `DELETE /:expenseId`: Soft-delete an expense

### 🤝 Settlements (`/api/v1/groups/:groupId/settlements`)
- `POST /`: Log a settlement payment (status: `pending`)
- `GET /`: List all group settlements
- `PATCH /:settlementId` (Recipient only): Mark settlement as `completed` or `rejected`

### 📊 Dashboard (`/api/v1/groups/:groupId/dashboard`)
- `GET /`: Get dashboard overview (total group spend, category breakdown, 6-month monthly trends)
- `GET /activity`: Get historical activity timeline

### 📥 Export & Upload (`/api/v1/groups/:groupId/export`)
- `GET /csv`: Export all group expenses as a CSV file
- `POST /expenses/:expenseId/attachment`: Upload a receipt file (Cloudinary storage)
