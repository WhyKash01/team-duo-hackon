# Intelligent Commerce System – Feature Set

---

## 1. Intent-to-Cart Compiler
### Meaning
Converts user input into a structured, editable, purchasable cart before checkout.

### Input Modes
- **Basic Search Mode**
  - Simple product queries (e.g., "paneer", "milk")

- **Intent-Based Search Mode**
  - Understands goal/context (e.g., "make paneer butter masala")

- **Voice Mode**
  - Spoken input → converted into structured cart intent

### Example
User: "I want to make paneer butter masala"
System suggests:
- Paneer
- Butter
- Tomato puree
- Spices
- Cream

### Cart Pre-Commit Editing
Before adding to cart, user can:
- Add/remove items
- Replace items
- Change quantities
- Lock preferences (brand, budget, dietary rules)

### Core Tech (Optional)
- LLM Planning
- Knowledge Graphs
- Recipe/Product Ontologies

---

## 2. Probabilistic Substitution Integrity Layer
### Meaning
Replaces unavailable products with the closest valid alternative while preserving intent, taste, and constraints.

### Example
If **Amul Dahi** is unavailable:
- Suggest **Mother Dairy Dahi**
- Rank alternatives by similarity score (taste, fat %, brand affinity)

### Core Tech (Optional)
- Semantic Embeddings
- Product Graphs
- Bayesian Matching Models

---

## 3. Autonomous Cart Stability System
### Meaning
Keeps cart consistent despite dynamic real-world changes like:
- Stock fluctuations
- Price updates
- Network issues
- Promotions

### Example
Cart remains stable even if:
- Prices change mid-session
- User goes offline and comes back later

### Core Tech (Optional)
- Event Sourcing
- CRDTs (Conflict-free Replicated Data Types)
- Stream Processing

---

## 4. Consumption Forecasting + Recommendation & Replenishment Engine
### Meaning
Learns user/household consumption behavior to predict demand and proactively suggest actions.

### Capabilities
- Predict when items will run out
- Suggest replenishment before stockout
- Recommend relevant products based on usage patterns

### Example
- Milk → every 2 days → suggests reorder
- Rice → monthly → predicts next purchase cycle
- Oil → 3–4 weeks → proactive reminder + bundle recommendation

### Output Types
- **Replenishment Suggestions** (reorder what is running low)
- **Smart Recommendations** (related or better products based on habits)

### Core Tech (Optional)
- Time-Series Forecasting
- Survival Analysis
- Sequential Recommendation Models
- Consumption Graphs

---

## 5. Anti-Double Spend Inventory Enforcement Layer
### Meaning
Ensures each physical inventory unit is reserved only once, even under extreme concurrency.

Prevents:
- Overselling
- Duplicate allocation
- Race-condition based checkout errors

### Example
If only 1 unit is left and 10 users try to buy:
- Only 1 gets reservation
- Others are routed to substitution or failure handling

### Core Tech (Optional)
- Distributed Locks
- Reservation Queues
- Strong Consistency Systems