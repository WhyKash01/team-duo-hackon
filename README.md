# Amazon Clone — Team Duo HackOn

A full-stack e-commerce application inspired by Amazon, built with a React (Vite) frontend and a Go (Gin) backend, backed by MongoDB.

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React 19, Vite 8, Redux Toolkit, Tailwind CSS 4 |
| Backend  | Go 1.25, Gin, MongoDB Driver v2                 |
| Database | MongoDB                                         |
| Auth     | JWT (access + refresh tokens)                   |

## Project Structure

```
├── Client/          # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # UI components (Header, Footer, Auth, Cart, Product)
│   │   ├── features/     # Redux slices (auth, cart)
│   │   └── app/          # Redux store
│   └── package.json
│
├── Server/          # Go backend (Gin)
│   ├── controllers/      # Route handlers
│   ├── models/           # MongoDB document models
│   ├── middleware/       # Auth & CORS middleware
│   ├── routes/           # API route definitions
│   ├── database/         # MongoDB connection
│   ├── config/           # Env config loader
│   ├── utils/            # JWT token utilities
│   └── main.go
│
└── README.md
```

## Prerequisites

- **Node.js** >= 22.12.0
- **Go** >= 1.25
- **MongoDB** running locally on port 27017 (or update `MONGODB_URI` in Server/.env)

## Setup & Run

### 1. Clone the repo

```bash
git clone <repo-url>
cd team-duo-hackon
```

### 2. Start MongoDB

Make sure MongoDB is running locally:

```bash
mongod
```

### 3. Run the Backend (Go server)

```bash
cd Server
go mod download
go run main.go
```

Server starts at **http://localhost:8080**

### 4. Run the Frontend (React client)

```bash
cd Client
npm install
npm run dev
```

Client starts at **http://localhost:5173**

## Environment Variables

### Server (`Server/.env`)

```env
PORT=8080
ENV=development
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=HackOn
```

### Client (`Client/.env`)

```env
VITE_API_URL=http://localhost:8080/api
```

## API Endpoints

### Public

| Method | Endpoint            | Description              |
| ------ | ------------------- | ------------------------ |
| GET    | /api/ping           | Health check             |
| POST   | /api/register       | Register a new user      |
| POST   | /api/login          | Login & get JWT tokens   |
| POST   | /api/refresh        | Refresh access token     |
| GET    | /api/products       | List products (paginated)|
| GET    | /api/products/:id   | Get product by ID        |

### Protected (requires JWT)

| Method | Endpoint                    | Description            |
| ------ | --------------------------- | ---------------------- |
| POST   | /api/logout                 | Logout user            |
| GET    | /api/cart                   | Get user's cart        |
| POST   | /api/cart/add               | Add item to cart       |
| POST   | /api/cart/update            | Update cart item qty   |
| DELETE | /api/cart/remove/:product_id| Remove item from cart  |
| DELETE | /api/cart/clear             | Clear entire cart      |

## Features

- User registration & login with JWT authentication
- Product catalog with pagination
- Product detail pages
- Cart management (add, update, remove, clear)
- Responsive Amazon-like UI with Tailwind CSS
- Redux state management for auth and cart

## Team

**Team Duo** — Built for HackOn
