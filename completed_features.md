# Completed Features

---

## Feature 3 — Autonomous Cart Stability System

### What It Does
Keeps the shopping cart consistent despite real-world changes (price updates, stock fluctuations, network drops) happening after items are added.

### Implementation

**Price Snapshot on Add:**
- When a product is added to cart, `price_at_add` is stored in the `OrderItem` struct alongside `unit_price`.
- If the product price changes later, the system detects the drift.

**Event-Driven Stale Detection (RabbitMQ + Redis):**
- Admin/system triggers `POST /api/admin/update-price` or `POST /api/admin/update-stock` → updates MongoDB → publishes `price.changed` or `stock.changed` event to RabbitMQ exchange (`commerce.events`, topic type).
- A background goroutine (`cart_stability_consumer.go`) consumes from the `cart.stability` queue, finds all carts containing the affected product, and writes stale flags into Redis (`stale:cart:{user_id}` hash).
- Frontend polls `GET /api/cart/status` every 30s → returns stale items with type (`price_changed`, `low_stock`, `out_of_stock`) and values.

**Frontend Cart Warnings:**
- `CartStabilityBanner` component renders inline per-item alerts (yellow for price change, orange for low stock, red for out of stock).
- User can dismiss alerts via `POST /api/cart/clear-stale`.

**Offline/Online Resilience:**
- `NetworkStatusBanner` component listens to `navigator.onLine` events.
- When offline: red banner shown, all API polling stops, product/cart state is preserved (never wiped on network failure).
- When back online: green "syncing" banner, auto-refetches cart + stability status + recommendations.
- Cart operations use **optimistic updates** — UI updates instantly via Redux reducers (`optimisticUpdateQty`, `optimisticAddItem`, `optimisticRemoveItem`), server sync happens in background. No button locking on slow networks.

**Files:**
- `Server/services/cart_stability_consumer.go` — RabbitMQ consumer
- `Server/services/redis.go` — Redis connection
- `Server/services/events.go` — RabbitMQ setup + publishing
- `Server/controllers/recommendation_controllers.go` — `GetCartStatus`, `ClearStaleItem`
- `Client/src/features/cart/cartStabilitySlice.ts` — Redux state
- `Client/src/components/CartStabilityBanner.tsx` — UI alerts
- `Client/src/components/NetworkStatusBanner.tsx` — Offline/online banner

---

## Feature 4 — Consumption Forecasting & Replenishment Engine

### What It Does
Tracks per-user purchase patterns and scores items by how overdue they are for repurchase. Surfaces recommendations by reordering the product catalog (frequently bought items appear first).

### Implementation

**Event Publishing:**
- When `PlaceOrder` succeeds, it publishes a `user.purchase` event per item to RabbitMQ (routing key: `user.purchase`, queue: `replenishment.stats`).
- Payload: `{user_id, product_id, timestamp}`.

**Stats Consumer (Redis):**
- `replenishment_consumer.go` goroutine consumes purchase events.
- Updates Redis hash `replenish:{user_id}:{product_id}` with fields: `count` (HINCRBY), `first_used` (HSETNX), `last_used` (HSET current).
- TTL: 90 days.

**Scoring Algorithm (from feature4.md):**
```
avg_interval = (last_used - first_used) / max(count - 1, 1)
gap = now - last_used
score = gap / avg_interval
weighted_score = 0.6 * score + 0.4 * log(count + 1)
```
- `≥ 2.0` → urgency "high" (overdue)
- `≥ 1.2` → urgency "medium" (due soon)
- `< 1.2` → urgency "low"
- Minimum 2 purchases required to infer a pattern.

**API:** `GET /api/recommendations` (protected) — scans Redis keys for the user, computes scores, fetches product details, returns top 10 sorted by score.

**Frontend Integration:**
- `recommendationSlice.ts` fetches on login.
- `App.tsx` sorts the product grid by recommendation score — high-score items float to top.
- Products with recommendations show a "⟳ Buy Again" badge on their card.

**Files:**
- `Server/services/replenishment_consumer.go` — Event consumer
- `Server/controllers/recommendation_controllers.go` — `GetRecommendations`
- `Client/src/features/recommendations/recommendationSlice.ts`

---

## Feature 5 — Anti-Double Spend Inventory Enforcement

### What It Does
Ensures each physical inventory unit is reserved only once, even under concurrent checkouts. Prevents overselling.

### Implementation

**Stock Field:**
- Added `stock int` to `Product` model in MongoDB.
- All products default to 999. Admin can set specific stock levels.

**Redis Atomic Counters:**
- On server start, `HydrateInventory()` loads all product stock counts from MongoDB into Redis keys (`inventory:{product_id}`).
- `ReserveStock(productID, qty)` — uses `DECRBY` atomically. If result < 0, restores with `INCRBY` and returns false (out of stock).
- `ReleaseStock(productID, qty)` — `INCRBY` to restore (for failed orders).

**Checkout Enforcement (`PlaceOrder`):**
1. For each item, calls `ReserveStock` atomically.
2. If any item fails — releases all previously reserved items in this order, returns `409 Conflict` with `{error: "out_of_stock", unavailable_items: [...]}`.
3. On success — creates order, decrements MongoDB stock (`$inc: {stock: -qty}`), publishes `stock.changed` event if stock ≤ 5 (feeds Feature 3's cart stability).

**Add-to-Cart Stock Check:**
- `AddToCart` controller checks `product.Stock` before adding. Rejects if `stock <= 0` or if `existing_qty + new_qty > stock`.
- `UpdateCartItem` controller also enforces stock limit on qty changes.

**Frontend Enforcement:**
- Product cards show "Out of Stock" badge (red) or "Only X left" badge (orange).
- Out-of-stock items have disabled grayed-out "Out of Stock" button — cannot be added.
- Qty +/- button disables at max stock.
- Cart qty dropdown capped at `min(10, product.stock)`.
- "Proceed to Buy" button disabled when any cart item exceeds available stock.

**Files:**
- `Server/services/inventory.go` — `HydrateInventory`, `ReserveStock`, `ReleaseStock`, `GetStock`
- `Server/controllers/cart_controllers.go` — Stock checks in `AddToCart`, `UpdateCartItem`
- `Server/controllers/order_controllers.go` — Atomic reservation in `PlaceOrder`
- `Server/controllers/admin_controllers.go` — `UpdateProductStock` (demo trigger)

---

## Infrastructure

| Component | Purpose | Config |
|-----------|---------|--------|
| Redis (Docker) | Fast state: inventory counters, stale cart flags, replenishment stats | `localhost:6379` |
| RabbitMQ (Docker) | Async event bus: price/stock/purchase events | `localhost:5672`, mgmt: `localhost:15672` |
| Docker Compose | Spins up both with `docker compose up -d` | `docker-compose.yml` at root |

**New Go packages:** `github.com/redis/go-redis/v9`, `github.com/rabbitmq/amqp091-go`

---

## How to Run

```bash
docker compose up -d          # Redis + RabbitMQ
cd Server && go run main.go   # Backend (port 8080)
cd Client && npm run dev      # Frontend (port 5173)
```
