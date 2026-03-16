# OTT Marketplace

Full-stack OTT subscription marketplace with 3D UI, React + Three.js + Node.js + MongoDB.

## Quick Start

### 1. Start MongoDB
Make sure MongoDB is running locally on port 27017.

### 2. Backend
```bash
cd backend
npm install
npm run seed      # Seeds DB with 12 products + admin/user accounts
npm run dev       # Starts on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev       # Starts on http://localhost:5173
```

## Features
- 3D orbiting subscription cards (Three.js / R3F)
- Glassmorphism dark UI with neon gradients
- JWT auth with role-based access (user/admin)
- Wallet system with top-up simulation
- Real-time ticket support (Socket.io)
- Admin panel with full CRUD
- PrimeReact DataTables for orders/users/tickets
- GSAP + Framer Motion animations
