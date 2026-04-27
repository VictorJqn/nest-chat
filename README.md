# nest-chat

Chat en temps réel. Backend NestJS + Socket.IO + Prisma (SQLite), frontend React + Vite.

## Lancer le projet

### Backend

```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

Le serveur tourne sur `http://localhost:3000`.

### Frontend

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev
```

Le front est dispo sur `http://localhost:5173`.
