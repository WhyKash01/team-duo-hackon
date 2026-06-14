# Implementation Plan — Features 3, 4 & 5

## Overview

This plan adds three intelligent commerce features to the existing Amazon clone monolith:

| # | Feature | Summary |
|---|---------|---------|
| 3 | Autonomous Cart Stability System | Keeps the cart consistent despite price changes, stock fluctuations, and offline/reconnect scenarios |
| 4 | Consumption Forecasting & Replenishment Engine | Rule-based (no ML) system that tracks purchase patterns and suggests reorders |
| 5 | Anti-Double Spend Inventory Enforcement | Prevents overselling via atomic Redis counters and reservation TTLs |

**Architecture**: Single Go binary (monolith). RabbitMQ for async event processing. Redis for fast state, counters, and scoring data.

---

## Infrastructure

### Docker Compose (`docker-compose.yml` at project root)

```yaml
version: "3.8"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest

volumes:
  redis_data:
```

### Environment Variables (`Server/.env` additions)

```env
REDIS_URL=localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

### New Go Dependencies

```
github.com/redis/go-redis/v9
github.com/rabbitmq/amqp091-go
```

---

## Feature 3 — Autonomous Cart Stability System

### Goal
Cart items reflect real-time truth. If a product's price or stock changes after the user added it to their cart, the system detects this and notifies the user before checkout.

### Backend Changes

#### 1. Schema: Add `price_at_add` to OrderItem

```go
// models/product&order_model.go
type OrderItem struct {
    ProductID  bson.ObjectID `json:"product_id" bson:"product_id"`
    Quantity   int           `json:"quantity" bson:"quantity"`
    UnitPrice  float64       `json:"unit_price" bson:"unit_price"`
    PriceAtAdd float64       `json:"price_at_add" bson:"price_at_add"` // NEW: snapshot when added
    Subtotal   float64       `json:"subtotal" bson:"subtotal"`
}
```

#### 2. Schema: Add `stock` to Product

```go
// models/product&order_model.go
type Product struct {
    // ... existing fields ...
    Stock int `json:"stock" bson:"stock"` // NEW: inventory count
}
```

Run once in mongosh: `db.Products.updateMany({}, { $set: { stock: 999 } })`

#### 3. New file: `Server/services/events.go`

RabbitMQ connection, exchange/queue setup, and publishing helpers:
- Exchange: `commerce.events` (topic)
- Queues: `cart.stability`, `replenishment.stats`
- Routing keys: `price.changed`, `stock.changed`, `user.purchase`

#### 4. New file: `Server/services/redis.go`

Redis connection pool initialization, used by both Feature 3 and 4.

#### 5. New file: `Server/services/cart_stability_consumer.go`

Goroutine that consumes from `cart.stability` queue:
- On `price.changed` event (payload: `{product_id, old_price, new_price}`):
  - Query MongoDB: find all carts containing this product_id
  - For each affected cart, write a Redis hash: `stale:cart:{user_id}` → `{product_id: {old_price, new_price, type: "price_changed"}}`
- On `stock.changed` event (payload: `{product_id, new_stock}`):
  - If new_stock == 0: find carts with this product, mark as `out_of_stock` in Redis
  - If new_stock <= 5: mark as `low_stock`

#### 6. New endpoint: `GET /api/cart/status` (protected)

Reads Redis for the user's stale items and returns:
```json
{
  "success": true,
  "stale_items": [
    {
      "product_id": "abc123",
      "type": "price_changed",
      "old_price": 56,
      "new_price": 62
    },
    {
      "product_id": "def456",
      "type": "low_stock",
      "available": 2
    }
  ]
}
```

#### 7. Modify: `AddToCart` controller

When adding to cart, store `PriceAtAdd: product.Price` in the OrderItem.

#### 8. Modify: Checkout (`PlaceOrder`) validation

Before creating the order, compare each item's `PriceAtAdd` with current product price. If different, return:
```json
{
  "success": false,
  "error": "price_changed",
  "stale_items": [...]
}
```
Frontend handles this by showing the diff and asking user to confirm.

#### 9. New endpoint: `POST /api/admin/update-price` (unprotected for demo)

Accepts `{product_id, new_price}`. Updates MongoDB product price AND publishes `price.changed` event to RabbitMQ. This is the demo trigger.

#### 10. New endpoint: `POST /api/admin/update-stock` (unprotected for demo)

Accepts `{product_id, new_stock}`. Updates MongoDB product stock AND publishes `stock.changed` event.

### Frontend Changes

#### 1. New Redux slice: `features/cart/cartStabilitySlice.ts`

- `fetchCartStatus()` async thunk → GET /api/cart/status
- State: `staleItems: StaleItem[]`

#### 2. Modify: `CartPage.tsx`

- Poll `/api/cart/status` every 30 seconds (or on focus)
- Show inline warnings per item:
  - **Price changed**: Yellow banner — "Price updated: ₹56 → ₹62" with "Accept new price" button
  - **Low stock**: Orange badge — "Only 2 left in stock"
  - **Out of stock**: Red banner — "This item is currently unavailable" with "Remove" button

#### 3. Modify: `CheckoutPage.tsx`

- Before placing order, call cart/status check
- If stale items found, show a confirmation modal with the diffs
- User can accept all changes or go back to cart

#### 4. New component: `CartStabilityBanner.tsx`

Reusable inline alert component used in CartPage for each stale item.

#### 5. New page: `AdminPanel.tsx` (route: `/admin`)

Simple form with:
- Product ID dropdown (fetched from /api/products)
- New Price input + "Update Price" button
- New Stock input + "Update Stock" button
- Shows live event log (events published)

Accessible from SubHeader or direct URL. For demo purposes only.

---

## Feature 4 — Consumption Forecasting & Replenishment Engine

### Goal
Track purchase frequency per user per product. Score items by how "overdue" they are for repurchase. Surface suggestions on the frontend.

### Backend Changes

#### 1. New file: `Server/services/replenishment_consumer.go`

Goroutine consuming from `replenishment.stats` queue:
- On `user.purchase` event (payload: `{user_id, product_id, timestamp}`):
  - Redis key: `replenish:{user_id}:{product_id}` (hash)
  - Fields: `count` (HINCRBY 1), `first_used` (HSETNX), `last_used` (HSET to current timestamp)

#### 2. Modify: `PlaceOrder` controller

After successfully creating the order, publish one `user.purchase` event per item to RabbitMQ:
```json
{
  "user_id": "abc123",
  "product_id": "def456",
  "timestamp": 1718000000
}
```

#### 3. New endpoint: `GET /api/recommendations` (protected)

Logic:
1. Scan Redis keys matching `replenish:{user_id}:*`
2. For each key, compute:
   ```
   avg_interval = (last_used - first_used) / max(count - 1, 1)
   gap = now - last_used
   score = gap / avg_interval
   weighted_score = 0.6 * score + 0.4 * log(count)
   ```
3. Filter: only items with `count >= 2` (need at least 2 purchases to infer pattern)
4. Sort by weighted_score descending
5. Return top 10 items with their scores and product details:
```json
{
  "success": true,
  "data": [
    {
      "product_id": "abc",
      "product": { /* full product object */ },
      "score": 2.3,
      "urgency": "high",
      "last_purchased_days_ago": 5,
      "avg_interval_days": 2
    }
  ]
}
```

Urgency mapping:
- `score >= 2.0` → "high" (strongly recommend)
- `score >= 1.2` → "medium" (suggest)
- `score < 1.2` → "low" (not yet due)

#### 4. Seed script: `Server/cmd/seed_replenishment.go`

Standalone Go program that populates Redis with 2 months of fake purchase history for a demo user:
- Milk: every 2 days (count=30)
- Rice: every 30 days (count=2)
- Oil: every 25 days (count=2)
- Bread: every 3 days (count=20)
- Eggs: every 4 days (count=15)
- etc.

Sets `first_used` = 60 days ago, `last_used` = appropriate based on frequency.

Run with: `go run cmd/seed_replenishment.go`

### Frontend Changes

#### 1. New Redux slice: `features/recommendations/recommendationSlice.ts`

- `fetchRecommendations()` async thunk → GET /api/recommendations
- State: `items: Recommendation[]`, loading, error

#### 2. New component: `BuyAgainSection.tsx`

Amazon-style horizontal scrollable section on the homepage (above the product grid):
- Title: "Buy Again" or "Recommended for You"
- Cards showing:
  - Product image
  - Product name (truncated)
  - "Last bought X days ago"
  - "Usually every Y days"
  - Urgency indicator: green dot (low), orange dot (medium), red pulsing dot (high)
  - "Add to Cart" button (one-click)
- Only shown when user is authenticated and has recommendations

#### 3. Notification toast for high-urgency items

When recommendations load and any item has `urgency: "high"`:
- Show a toast notification: "🔔 Running low on Milk? Reorder now" with "Add to Cart" action
- Auto-dismiss after 8 seconds

#### 4. Integrate into `App.tsx`

- Fetch recommendations on mount when authenticated
- Render `BuyAgainSection` above the product grid on homepage

---

## Feature 5 — Anti-Double Spend Inventory Enforcement

### Goal
Ensure each physical inventory unit is reserved only once, even under extreme concurrency.

### Backend Changes

#### 1. Redis inventory counters

On server start (or via seed script), hydrate Redis from MongoDB:
```
inventory:{product_id} → stock count (integer)
```

#### 2. New file: `Server/services/inventory.go`

Functions:
- `HydrateInventory()`: Reads all products from MongoDB, sets Redis keys
- `ReserveStock(productID string, qty int) (bool, error)`:
  - Uses Redis DECRBY atomically
  - If result >= 0 → success
  - If result < 0 → INCRBY to restore, return false
- `ReleaseStock(productID string, qty int)`: INCRBY (for failed orders or TTL expiry)

#### 3. Modify: `PlaceOrder` controller

Before creating the order document:
1. For each item, call `ReserveStock(productID, quantity)`
2. If any fails: release all previously reserved items in this order, return error:
   ```json
   {
     "success": false,
     "error": "out_of_stock",
     "unavailable_items": ["product_id_1"]
   }
   ```
3. If all succeed: create order, then update MongoDB stock (eventual consistency)

#### 4. Reservation TTL (RabbitMQ delayed message)

When stock is reserved:
- Publish a delayed message to RabbitMQ (10 min TTL) with `{order_id, items}`
- Consumer checks after 10 min: if order status is still "PENDING" (not confirmed), release the stock back

For this demo, since orders are instant (COD), this is mainly for showing the architecture. In production, this handles payment timeouts.

#### 5. Stock sync event

After `PlaceOrder` decrements stock:
- Publish `stock.changed` event (feeds into Feature 3's cart stability consumer)
- If stock hits 0, all carts with that item get flagged

#### 6. Modify: Product API responses

Include `stock` field in product responses. Frontend can show:
- "In Stock" (stock > 10)
- "Only X left" (stock <= 10 and > 0)
- "Out of Stock" (stock == 0)

### Frontend Changes

#### 1. Stock badge on ProductPage

Read `product.stock` from API:
- `stock > 10`: Green "In Stock"
- `stock <= 10`: Orange "Only X left in stock — order soon"
- `stock == 0`: Red "Currently Unavailable" + disable Add to Cart

#### 2. Stock badge on catalog cards

Small indicator on product cards in the grid for low-stock items.

#### 3. Checkout error handling

If checkout returns `out_of_stock` error:
- Show modal listing unavailable items
- Offer to remove them and proceed with remaining items
- Or navigate back to cart

---

## Implementation Order

### Phase 1: Infrastructure (Day 1)
1. Create `docker-compose.yml`
2. Add Redis and RabbitMQ connection code (`services/redis.go`, `services/events.go`)
3. Add new Go dependencies
4. Update `Server/.env`
5. Update `main.go` to initialize Redis/RabbitMQ connections and start consumers
6. Add `stock` field to Product model + run MongoDB update

### Phase 2: Feature 3 — Cart Stability (Day 1-2)
1. Add `price_at_add` to OrderItem model
2. Modify `AddToCart` to store price snapshot
3. Create cart stability consumer
4. Create `/api/cart/status` endpoint
5. Create admin endpoints (update-price, update-stock)
6. Frontend: CartStabilityBanner, CartPage modifications
7. Frontend: Admin panel page
8. Frontend: Checkout validation with stale item handling

### Phase 3: Feature 4 — Replenishment (Day 2-3)
1. Create replenishment consumer
2. Hook PlaceOrder to publish purchase events
3. Create `/api/recommendations` endpoint with scoring logic
4. Create seed script for demo data
5. Frontend: BuyAgainSection component
6. Frontend: Recommendation slice + integration in App.tsx
7. Frontend: Toast notifications for high-urgency items

### Phase 4: Feature 5 — Inventory Enforcement (Day 3-4)
1. Create inventory service with Redis counters
2. Hydrate inventory on server start
3. Modify PlaceOrder to reserve stock atomically
4. Publish stock.changed events (connects to Feature 3)
5. Add reservation TTL handling
6. Frontend: Stock badges on product pages and catalog
7. Frontend: Out-of-stock error handling at checkout

### Phase 5: Polish & Demo (Day 4)
1. End-to-end testing of all flows
2. Seed script for replenishment demo
3. Admin panel for live demo triggers
4. README update with new features documentation

---

## File Structure (New additions)

```
Server/
├── services/
│   ├── redis.go                    # Redis connection pool
│   ├── events.go                   # RabbitMQ connection, publishing helpers
│   ├── cart_stability_consumer.go  # Feature 3 consumer
│   ├── replenishment_consumer.go   # Feature 4 consumer
│   └── inventory.go                # Feature 5 atomic stock operations
├── controllers/
│   ├── admin_controllers.go        # Demo triggers (update price/stock)
│   └── recommendation_controllers.go # GET /api/recommendations
├── cmd/
│   └── seed_replenishment.go       # Seed script for demo data
└── ...

Client/src/
├── features/
│   ├── cart/
│   │   └── cartStabilitySlice.ts   # Cart status polling
│   └── recommendations/
│       └── recommendationSlice.ts  # Replenishment suggestions
├── components/
│   ├── BuyAgainSection.tsx         # Homepage recommendations
│   ├── CartStabilityBanner.tsx     # Inline cart warnings
│   ├── AdminPanel.tsx              # Demo control panel
│   └── ...
└── ...

docker-compose.yml                  # Redis + RabbitMQ
```

---

## Demo Script (How to show it)

1. **Start infra**: `docker compose up -d`
2. **Start server**: `cd Server && go run main.go`
3. **Start client**: `cd Client && npm run dev`
4. **Seed data**: `cd Server && go run cmd/seed_replenishment.go`

### Demo Flow:

**Feature 4 (Replenishment)**:
- Login as demo user → Homepage shows "Buy Again" section with items scored by urgency
- Show milk as "overdue" (red indicator) → one-click add to cart

**Feature 3 (Cart Stability)**:
- Add items to cart
- Open `/admin` in another tab → change a product's price
- Switch back to cart → yellow banner appears: "Price changed: ₹56 → ₹62"
- Set stock to 0 → cart shows "Out of Stock" warning

**Feature 5 (Inventory)**:
- Set a product stock to 2 in admin panel
- Open 3 browser tabs, add 1 unit each to cart
- Try to checkout from all 3 → only first 2 succeed, 3rd gets "out of stock" error
- Show RabbitMQ management UI with events flowing
