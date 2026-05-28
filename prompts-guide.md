# 🎯 LiveAuction — Step-by-Step Prompts for Claude Code

> Feed these prompts **one at a time, in order** to Claude Code connected to your VS Code.
> Wait for each step to complete and verify before moving to the next.

---

## PROMPT 1 — Project Scaffold

```
Scaffold a Shopify app in D:\boxbox\LiveAuction using Node.js + Express backend and React frontend. 

Set up the following project structure:
/server           — Express backend
  /routes         — API routes
  /middleware      — Auth, error handling
  /services       — Business logic
  /models         — Database models (use Sequelize ORM with SQLite for dev, PostgreSQL-ready)
  /shopify        — Shopify API helpers
  /websocket      — Socket.io logic
/client           — React frontend (use Vite)
  /src
    /pages        — Page components
    /components   — Reusable components  
    /hooks        — Custom hooks
    /context      — React context providers
    /styles       — CSS files

Initialize npm in both /server and /client. Install these dependencies:

Server: express, @shopify/shopify-api, @shopify/shopify-app-express, dotenv, sequelize, sqlite3, pg, pg-hstore, socket.io, cors, cookie-parser, jsonwebtoken, crypto
Client: react, react-dom, react-router-dom, socket.io-client, @shopify/polaris, @shopify/app-bridge-react

Create a .env.example file in the root with:
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SCOPES=read_products,write_products,read_orders,write_orders
HOST=http://localhost:3000
PORT=3000
CLIENT_PORT=5173
DATABASE_URL=sqlite::memory:
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

Create a root package.json with scripts to run both server and client concurrently using concurrently package.
```

---

## PROMPT 2 — Database Models

```
In D:\boxbox\LiveAuction\server, create Sequelize database models:

1. **Shop** (models/Shop.js)
   - id (UUID, primary key)
   - shopDomain (string, unique) — e.g. "mystore.myshopify.com"
   - accessToken (string, encrypted) — Shopify API access token
   - shopName (string)
   - email (string)
   - isActive (boolean, default true)
   - auctionSettings (JSON) — stores default starting bid, auction duration etc.
   - createdAt, updatedAt

2. **Auction** (models/Auction.js)
   - id (UUID, primary key)
   - shopId (FK to Shop)
   - shopifyProductId (string) — Shopify product ID
   - productTitle (string)
   - productImage (string) — URL
   - productDescription (text)
   - startingBid (decimal, not null)
   - currentBid (decimal, default 0)
   - currentBidderId (FK to Bidder, nullable)
   - status (enum: 'pending', 'active', 'sold', 'unsold')
   - startedAt (datetime, nullable)
   - endsAt (datetime, nullable)
   - createdAt, updatedAt

3. **Bidder** (models/Bidder.js)
   - id (UUID, primary key)
   - email (string, not null)
   - displayName (string)
   - sessionToken (string)
   - createdAt, updatedAt

4. **Bid** (models/Bid.js)
   - id (UUID, primary key)
   - auctionId (FK to Auction)
   - bidderId (FK to Bidder)
   - amount (decimal, not null)
   - createdAt

Create a models/index.js that initializes Sequelize, defines all associations, and syncs the database. A Shop has many Auctions. An Auction has many Bids. An Auction belongs to a Shop. A Bid belongs to a Bidder and an Auction.
```

---

## PROMPT 3 — Shopify OAuth & App Installation

```
In D:\boxbox\LiveAuction\server, implement Shopify OAuth so any store owner can install this app:

1. **shopify/shopifyClient.js** — Initialize @shopify/shopify-api with credentials from .env. Configure it for embedded app use.

2. **routes/auth.js** — Create these routes:
   - GET /auth — Redirects store owner to Shopify OAuth consent screen. Takes ?shop=storename.myshopify.com as query param.
   - GET /auth/callback — Handles Shopify OAuth callback, exchanges code for access token, saves/updates the Shop record in database with the access token and shop info. Redirects to the admin dashboard.
   - GET /auth/verify — Middleware that verifies the current session has a valid shop token.

3. **middleware/shopifyAuth.js** — Middleware that checks if the request has a valid shop session. If not, redirects to /auth. This should work with both embedded (App Bridge) and standalone modes.

Make sure the OAuth flow:
- Requests scopes: read_products, write_products, read_orders, write_orders
- Stores the access token securely in the Shop model
- Handles both new installs and re-installs gracefully
- Works for ANY Shopify store (multi-tenant)
```

---

## PROMPT 4 — Shopify Product Service

```
In D:\boxbox\LiveAuction\server\services, create a ProductService.js that:

1. **fetchRandomProduct(shopDomain, accessToken)** — Uses Shopify Admin REST API to:
   - First get the total product count for the shop
   - Pick a random offset
   - Fetch that single product with its title, description, images, price, and variant info
   - Return a clean object: { shopifyProductId, title, description, imageUrl, originalPrice, variants }

2. **fetchProductById(shopDomain, accessToken, productId)** — Fetches a specific product by its Shopify ID

3. **createDraftOrder(shopDomain, accessToken, orderData)** — Creates a Shopify draft order for the auction winner with:
   - The winning bidder's email
   - The product and variant
   - The winning bid amount as the price (using a price override or discount)
   - A note saying "Won via LiveAuction"

Use the Shopify REST API (2024-01 version or latest stable). Handle rate limits with retry logic. Handle errors gracefully (product not found, shop offline, etc).
```

---

## PROMPT 5 — Auction Engine (Core Logic)

```
In D:\boxbox\LiveAuction\server\services, create AuctionService.js — this is the core auction engine:

1. **startAuction(shopId, startingBid)** —
   - Fetch the shop's access token from DB
   - Call ProductService.fetchRandomProduct() to get a random product
   - Create an Auction record with status='active', startingBid, startedAt=now, endsAt=now+60seconds
   - Start a 60-second countdown timer
   - Return the auction object
   - Emit 'auction:started' via Socket.io with auction details

2. **placeBid(auctionId, bidderId, amount)** —
   - Validate the auction is still 'active' and not expired
   - Validate bid amount > currentBid and >= startingBid
   - Create a Bid record
   - Update auction's currentBid and currentBidderId
   - Emit 'auction:newBid' via Socket.io to all connected clients
   - Return updated auction

3. **endAuction(auctionId)** — Called when timer expires:
   - If currentBid > 0 → set status='sold', call ProductService.createDraftOrder for the winner, emit 'auction:sold'
   - If no bids → set status='unsold', emit 'auction:unsold'

4. **getActiveAuction(shopId)** — Returns the current active auction for a shop (only one active auction per shop at a time)

5. **getAuctionHistory(shopId, page, limit)** — Returns paginated past auctions with their results

Use an in-memory timer (setTimeout) for the 60-second countdown. Make sure race conditions on bids are handled (use database transactions or optimistic locking).
```

---

## PROMPT 6 — WebSocket (Real-time Bidding)

```
In D:\boxbox\LiveAuction\server\websocket, create socketHandler.js:

Set up Socket.io that handles real-time auction events:

1. **Connection** — When a client connects:
   - They send a 'join:auction' event with { shopDomain } 
   - Put them in a room named after the shopDomain
   - Send them the current active auction state if one exists

2. **Events to LISTEN for (from clients):**
   - 'bid:place' — { auctionId, email, displayName, amount }
     → Find or create Bidder by email
     → Call AuctionService.placeBid()
     → If success, broadcast 'auction:newBid' to the room
     → If error (too low, expired), send 'bid:error' back to that client only

3. **Events to EMIT (to clients):**
   - 'auction:started' — { auctionId, product, startingBid, endsAt, shopDomain }
   - 'auction:newBid' — { auctionId, currentBid, bidderName, bidCount, endsAt }
   - 'auction:tick' — { auctionId, secondsRemaining } — emitted every second during active auction
   - 'auction:sold' — { auctionId, product, winningBid, winnerName }
   - 'auction:unsold' — { auctionId, product }
   - 'bid:error' — { message }

4. **Timer broadcast** — When an auction is active, emit 'auction:tick' every second to the shop's room with the seconds remaining.

Integrate this into the main Express server in server/index.js. Create the Express + HTTP server + Socket.io setup there.
```

---

## PROMPT 7 — Backend API Routes

```
In D:\boxbox\LiveAuction\server\routes, create these API route files:

1. **routes/api/shops.js** (protected by shopifyAuth middleware):
   - GET /api/shop — Get current shop info and settings
   - PUT /api/shop/settings — Update auction settings (default starting bid, etc.)

2. **routes/api/auctions.js** (protected by shopifyAuth middleware):
   - POST /api/auctions/start — Start a new auction { startingBid }. Returns error if one is already active.
   - GET /api/auctions/active — Get the current active auction for this shop
   - GET /api/auctions/history — Get paginated auction history { page, limit }
   - GET /api/auctions/:id — Get specific auction with its bids

3. **routes/api/public.js** (NO auth required — this is for bidder customers):
   - GET /api/public/:shopDomain/auction — Get active auction for a specific shop (used by the public auction page)
   - GET /api/public/:shopDomain/history — Get recent auction results for a shop
   - POST /api/public/bidder/register — Register as a bidder { email, displayName } → returns a session token

4. Mount all routes in server/index.js. Add proper error handling middleware. Add CORS configuration to allow the React client origin.

Create a server/index.js that ties everything together: Express app, middleware, routes, database sync, Socket.io, and starts the server.
```

---

## PROMPT 8 — Admin Dashboard (Store Owner Frontend)

```
In D:\boxbox\LiveAuction\client\src, build the store owner admin dashboard:

1. **pages/AdminDashboard.jsx** — Main dashboard showing:
   - Shop connection status (connected shop domain, green indicator)
   - "Start Auction" section: input for starting bid amount + big "Start Auction" button
   - When auction is active: show the current product being auctioned (image, title), current highest bid, time remaining (live countdown), number of bids, and a link to share the public auction page
   - When no auction: show "No active auction" state with the start button

2. **pages/AuctionHistory.jsx** — Table showing past auctions:
   - Product name, image thumbnail, starting bid, final bid, status (sold/unsold), winner email, date
   - Pagination controls

3. **pages/Settings.jsx** — Shop settings form:
   - Default starting bid amount
   - Save button

4. **components/ActiveAuction.jsx** — Live auction widget for admin:
   - Product image and title
   - Real-time current bid display (updates via Socket.io)
   - Live countdown timer (synced with server ticks)
   - Bid history list (scrollable)
   - Status badge (active/sold/unsold)

5. **App.jsx** — React Router setup with routes for /admin, /admin/history, /admin/settings
   - Navigation sidebar with links to Dashboard, History, Settings
   - Use clean modern CSS (not Polaris, since this is standalone — save Polaris for embedded version later)

6. **context/SocketContext.jsx** — Provides Socket.io connection to all components
7. **hooks/useAuction.js** — Custom hook that manages auction state from socket events

Style it cleanly with a dark theme. Make it look professional and modern.
```

---

## PROMPT 9 — Public Auction Page (Customer-Facing)

```
In D:\boxbox\LiveAuction\client\src, build the public auction page that customers see and bid on:

1. **pages/AuctionPage.jsx** — Route: /auction/:shopDomain
   - If no active auction: Show "No auction live right now. Check back soon!" with the shop name
   - If active auction, show:
     - Product image (large, centered)
     - Product title and description
     - Original store price (crossed out)
     - Current highest bid (large, bold, updates in real-time)
     - Time remaining countdown (large, prominent, updates every second)
     - Bidder registration form (email + display name) if not registered
     - Bid input field with quick-bid buttons (+$1, +$5, +$10 above current bid)
     - "Place Bid" button (disabled if not registered or bid too low)
     - Live bid feed showing recent bids (bidder name + amount, animated in)
   - When auction ends:
     - SOLD: Show confetti/celebration, winner name, winning bid amount
     - UNSOLD: Show "Item went unsold" message
     - "Next auction starting soon..." message

2. **components/BidFeed.jsx** — Scrolling list of recent bids with animations (new bids slide in from top)
3. **components/CountdownTimer.jsx** — Big countdown display, turns red in last 10 seconds, pulses in last 5 seconds
4. **components/ProductCard.jsx** — Displays the auction product attractively
5. **components/BidInput.jsx** — Bid amount input with validation and quick-bid buttons

Connect everything to Socket.io. Store bidder session in localStorage.

Make this page visually exciting — use CSS animations for new bids, countdown urgency effects, and sold/unsold result screens. Dark theme with accent colors (green for bids, red for timer urgency, gold for winning).
```

---

## PROMPT 10 — Integration & Testing Setup

```
In D:\boxbox\LiveAuction, wire everything together and make it testable with a real Shopify store:

1. **Server index.js** — Make sure the complete server starts correctly with:
   - Express with all middleware (cors, json, cookie-parser)
   - All routes mounted
   - Database synced
   - Socket.io attached to HTTP server
   - Serves the React build in production or proxies to Vite dev server in development

2. **client/vite.config.js** — Configure proxy so /api and /auth requests go to the Express server (port 3000). Configure Socket.io proxy too.

3. **Root package.json** — Scripts:
   - "dev" — runs server (nodemon) and client (vite) concurrently
   - "build" — builds the React client
   - "start" — runs production server

4. **README.md** — Create a comprehensive README with:
   - How to create a Shopify Partner account and development store
   - How to create a Shopify app in Partner Dashboard and get API key/secret
   - How to configure the .env file
   - How to set up ngrok for HTTPS tunneling (required for Shopify OAuth)
   - Step-by-step: install dependencies → set up ngrok → configure Shopify app URLs → run dev → install app on test store → start auctioning
   - How other store owners would install the app

5. Make sure the full flow works:
   - Store owner visits /auth?shop=storename.myshopify.com → OAuth → redirected to admin dashboard
   - Store owner sets starting bid and clicks "Start Auction" → random product pulled → auction goes live
   - Customer visits /auction/storename.myshopify.com → sees live auction → registers → bids
   - After 60 seconds → auction ends → winner gets draft order on Shopify → next auction can start
```

---

## PROMPT 11 — Polish & Edge Cases

```
In D:\boxbox\LiveAuction, handle edge cases and polish the app:

1. **Race condition handling** — Ensure two simultaneous bids are handled correctly using database transactions. The bid with the higher amount should always win.

2. **Reconnection** — If a customer's WebSocket disconnects during an auction, they should automatically reconnect and get the current auction state.

3. **Timer sync** — Ensure the countdown timer is server-authoritative. Clients should sync to server ticks, not rely on their own clock.

4. **Error states** — Add proper error handling UI for:
   - Shop has no products
   - Shopify API is rate-limited
   - WebSocket connection lost
   - Invalid bid amounts
   - Session expired

5. **Auction auto-queue** — Add a toggle in admin settings: "Auto-start next auction" — when enabled, a new auction automatically starts 10 seconds after the previous one ends.

6. **Shareable link** — Show a copy-to-clipboard button in admin for the public auction URL: https://yourdomain.com/auction/storename.myshopify.com

7. **Basic analytics on admin dashboard:**
   - Total auctions run
   - Total revenue (sum of sold auction amounts)  
   - Sell-through rate (sold/total %)
   - Average winning bid

8. **Mobile responsive** — Ensure both admin and public auction pages work well on mobile devices.
```

---

## 🔧 Testing Flow (after all prompts are done)

1. **Get Shopify credentials**: Go to partners.shopify.com → Create app → Get API key & secret
2. **Set up ngrok**: `ngrok http 3000` → Copy the HTTPS URL
3. **Configure Shopify app**: Set App URL and Redirect URL in Partner Dashboard
4. **Fill .env**: Add your credentials and ngrok URL as HOST
5. **Run**: `npm run dev` from root
6. **Install on your store**: Visit `https://your-ngrok-url/auth?shop=yourstore.myshopify.com`
7. **Start an auction**: Set starting bid, click Start
8. **Open public page**: Visit `/auction/yourstore.myshopify.com` in another browser
9. **Bid!**: Register and place bids, watch real-time updates

---

## Notes
- Feed prompts one at a time. Verify each step works before moving on.
- If Claude Code asks clarifying questions, answer them based on this plan.
- After Prompt 10, do a full test run before moving to Prompt 11.
- You can always tell Claude Code to "fix the errors" if something doesn't compile or run.
