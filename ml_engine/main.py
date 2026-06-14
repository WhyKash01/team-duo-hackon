from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from typing import Optional, Dict, Any
import psycopg2
import math

app = FastAPI()

print("Downloading/Loading ML Model... (This takes a minute the first time)")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
print("Model Loaded!")

# Global Seeding Status
seeding_status = {
    "status": "idle",
    "processed": 0,
    "total": 0,
    "error": None
}

# Local Docker Database Config
DB_CONFIG = {
    "dbname": "hackon",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": "5432"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

# --- 1. Automatic Database Setup ---
@app.on_event("startup")
def startup_event():
    conn = get_db_connection()
    cur = conn.cursor()
    # Enable vector extension and create table
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255),
            brand VARCHAR(100),
            category VARCHAR(100),
            price NUMERIC(10, 2),
            embedding vector(384)
        );
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Database tables verified.")

# --- 2. Request / Response Models ---
class ProductPayload(BaseModel):
    id_obj: Optional[Dict[str, str]] = Field(default=None, alias="_id")
    id_num: Optional[Any] = Field(default=None, alias="id")
    Brand: str
    Product: str
    Quantity: Optional[str] = ""
    Price: float
    MRP: Optional[float] = 0.0
    Category: str
    Sub_Category: Optional[str] = Field(default="", alias="Sub-Category")

    @property
    def parsed_id(self) -> str:
        if self.id_obj and "$oid" in self.id_obj:
            return str(self.id_obj["$oid"])
        if self.id_num is not None:
            if isinstance(self.id_num, dict) and "$oid" in self.id_num:
                return str(self.id_num["$oid"])
            return str(self.id_num)
        return "unknown"

class SubstituteResult(BaseModel):
    id: str
    id_obj: Optional[Dict[str, str]] = Field(default=None, alias="_id")
    name: str
    brand: str
    category: str
    price: float
    match_score: float

    model_config = {
        "populate_by_name": True
    }

def bg_seed_database(products: list[ProductPayload]):
    global seeding_status
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        chunk_size = 500
        total_products = len(products)
        
        for i in range(0, total_products, chunk_size):
            chunk = products[i:i + chunk_size]
            
            # Batch embed
            texts_to_embed = [
                f"{p.Brand} {p.Product} {p.Category} {p.Sub_Category or ''} {p.Quantity or ''}".strip()
                for p in chunk
            ]
            embeddings = model.encode(texts_to_embed).tolist()
            
            # Prepare rows
            product_data = []
            for idx, p in enumerate(chunk):
                product_data.append((
                    p.parsed_id,
                    p.Product,
                    p.Brand,
                    p.Category,
                    p.Price,
                    embeddings[idx]
                ))
            
            # Batch upsert
            from psycopg2.extras import execute_values
            execute_values(
                cur,
                """
                INSERT INTO products (id, name, brand, category, price, embedding)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET 
                    name = EXCLUDED.name, brand = EXCLUDED.brand, category = EXCLUDED.category, price = EXCLUDED.price, embedding = EXCLUDED.embedding;
                """,
                product_data,
                template="(%s, %s, %s, %s, %s, %s::vector)"
            )
            conn.commit()
            
            seeding_status["processed"] += len(chunk)
            print(f"Seeded {seeding_status['processed']}/{total_products} products...")
            
        cur.close()
        conn.close()
        seeding_status["status"] = "completed"
    except Exception as e:
        seeding_status["status"] = "failed"
        seeding_status["error"] = str(e)
        print(f"Seeding failed: {e}")

# --- 3. The SEED Endpoint (For easy local testing) ---
@app.post("/seed", status_code=202)
def seed_database(products: list[ProductPayload], background_tasks: BackgroundTasks):
    global seeding_status
    if seeding_status["status"] == "seeding":
        return JSONResponse(
            status_code=409,
            content={"message": "Seeding is already in progress. Please check status at /seed/status."}
        )
    
    seeding_status["status"] = "seeding"
    seeding_status["processed"] = 0
    seeding_status["total"] = len(products)
    seeding_status["error"] = None
    
    background_tasks.add_task(bg_seed_database, products)
    return {"message": "Seeding started in the background", "total": len(products)}

@app.get("/seed/status")
def get_seeding_status():
    return seeding_status

@app.post("/find-substitute", response_model=list[SubstituteResult])
def find_substitute(req: ProductPayload):
    # 1. Embed the missing product
    text_to_embed = f"{req.Brand} {req.Product} {req.Category} {req.Sub_Category or ''} {req.Quantity or ''}".strip()
    embedding = model.encode(text_to_embed).tolist()

    conn = get_db_connection()
    cur = conn.cursor()
    
    # Clean and lowercase the category filter
    category_clean = req.Category.lower().strip() if req.Category else ""
    
    # 2. Vector Search using Cosine Distance (<=>)
    # Attempt 1: Search within same category (case-insensitive)
    cur.execute("""
        SELECT id, name, brand, category, price, 1 - (embedding <=> %s::vector) AS semantic_sim
        FROM products 
        WHERE LOWER(category) = %s AND id != %s
        ORDER BY embedding <=> %s::vector ASC
        LIMIT 10;
    """, (embedding, category_clean, req.parsed_id, embedding))
    
    candidates = cur.fetchall()
    
    # Attempt 2: Fallback to global search if fewer than 3 candidates found in the category
    if len(candidates) < 3:
        cur.execute("""
            SELECT id, name, brand, category, price, 1 - (embedding <=> %s::vector) AS semantic_sim
            FROM products 
            WHERE id != %s
            ORDER BY embedding <=> %s::vector ASC
            LIMIT 10;
        """, (embedding, req.parsed_id, embedding))
        
        fallback_candidates = cur.fetchall()
        
        # Merge avoiding duplicate IDs
        seen_ids = {c[0] for c in candidates}
        for fc in fallback_candidates:
            if fc[0] not in seen_ids:
                candidates.append(fc)
                seen_ids.add(fc[0])
                if len(candidates) >= 10:
                    break
    
    cur.close()
    conn.close()

    # 3. Apply Probabilistic Rules
    results = []
    for row in candidates:
        c_id, c_name, c_brand, c_category, c_price, semantic_sim = row
        
        # Rule Weights
        brand_score = 1.0 if c_brand.lower() == req.Brand.lower() else 0.0
        price_diff = abs(float(c_price) - req.Price) / req.Price if req.Price > 0 else 0
        price_score = max(0.0, 1.0 - price_diff)
        
        # Final Score: 50% Semantic, 30% Price, 20% Brand
        final_score = (semantic_sim * 0.60) + (price_score * 0.30) + (brand_score * 0.10)
        
        results.append(SubstituteResult(
            id=c_id,
            id_obj={"$oid": c_id},
            name=c_name, brand=c_brand, category=c_category, price=float(c_price), 
            match_score=round(final_score * 100, 2)
        ))

    results.sort(key=lambda x: x.match_score, reverse=True)
    return results[:10]

class SearchQuery(BaseModel):
    query: str

@app.post("/search", response_model=list[SubstituteResult])
def search_products(req: SearchQuery):
    # Title-case the query to improve semantic matching against Title Cased product names
    query_text = req.query.title()
    embedding = model.encode(query_text).tolist()
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 1. Keyword Exact Matches (using ILIKE)
    query_pattern = f"%{req.query}%"
    cur.execute("""
        SELECT id, name, brand, category, price, 1 - (embedding <=> %s::vector) AS semantic_sim
        FROM products 
        WHERE name ILIKE %s OR brand ILIKE %s OR category ILIKE %s
        ORDER BY semantic_sim DESC
        LIMIT 30;
    """, (embedding, query_pattern, query_pattern, query_pattern))
    keyword_matches = cur.fetchall()

    # 2. Semantic Vector Matches
    cur.execute("""
        SELECT id, name, brand, category, price, 1 - (embedding <=> %s::vector) AS semantic_sim
        FROM products 
        ORDER BY embedding <=> %s::vector ASC
        LIMIT 30;
    """, (embedding, embedding))
    semantic_matches = cur.fetchall()
    
    cur.close()
    conn.close()

    seen_ids = set()
    candidates = []

    # Process Keyword Matches (Boost score by +0.5 to prioritize direct hits)
    for row in keyword_matches:
        if row[0] not in seen_ids:
            c_id, c_name, c_brand, c_category, c_price, semantic_sim = row
            candidates.append((c_id, c_name, c_brand, c_category, c_price, semantic_sim + 0.5))
            seen_ids.add(c_id)

    # Process Semantic Matches
    for row in semantic_matches:
        if row[0] not in seen_ids:
            c_id, c_name, c_brand, c_category, c_price, semantic_sim = row
            candidates.append((c_id, c_name, c_brand, c_category, c_price, semantic_sim))
            seen_ids.add(c_id)

    # Sort by combined score
    candidates.sort(key=lambda x: x[5], reverse=True)
    top_candidates = candidates[:20]

    results = []
    for row in top_candidates:
        c_id, c_name, c_brand, c_category, c_price, final_score = row
        results.append(SubstituteResult(
            id=c_id,
            id_obj={"$oid": c_id},
            name=c_name, brand=c_brand, category=c_category, price=float(c_price), 
            match_score=round(final_score * 100, 2)
        ))

    return results

class CategorySearchQuery(BaseModel):
    category: str

@app.post("/search-category", response_model=list[SubstituteResult])
def search_by_category(req: CategorySearchQuery):
    query_text = req.category.title()
    embedding = model.encode(query_text).tolist()
    category_pattern = f"%{req.category}%"
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, brand, category, price, 1 - (embedding <=> %s::vector) AS semantic_sim
        FROM products 
        WHERE category ILIKE %s
        ORDER BY RANDOM()
        LIMIT 500;
    """, (embedding, category_pattern))
    
    semantic_matches = cur.fetchall()
    cur.close()
    conn.close()

    results = []
    for row in semantic_matches:
        c_id, c_name, c_brand, c_category, c_price, final_score = row
        results.append(SubstituteResult(
            id=c_id,
            id_obj={"$oid": c_id},
            name=c_name, brand=c_brand, category=c_category, price=float(c_price), 
            match_score=round(final_score * 100, 2)
        ))
    return results
