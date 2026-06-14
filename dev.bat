@echo off
echo Starting Docker containers (Postgres with pgvector, Redis, RabbitMQ)...
docker-compose up -d

echo Starting Go Server...
start cmd /k "cd Server && go run main.go"

echo Starting ML Engine...
start cmd /k "cd ml_engine && .\venv\Scripts\python.exe -m uvicorn main:app --reload"

echo Starting React Client...
start cmd /k "cd Client && npm run dev"

echo All 3 servers triggered!

