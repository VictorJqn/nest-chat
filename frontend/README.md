# Frontend de test (Auth + Websocket)

Petit front React pour tester rapidement le backend Nest:

- register / login
- chargement des users/messages en HTTP
- chat websocket `general` (join + send + messages live)
- logs temps réel des events

## Lancer le front

```bash
npm install
npm run dev
```

Par défaut, Vite démarre sur `http://localhost:5173`.

## Pré-requis

- backend démarré (ex: `http://localhost:3000`)
- Node >= `20.19` (ou Node `22+`)

## Utilisation rapide

1. Démarrer le backend.
2. Démarrer le frontend.
3. Dans l’UI:
- register un user
- login avec ce user
- cliquer `Connect socket`
- cliquer `Join general`
- envoyer des messages dans le formulaire websocket
