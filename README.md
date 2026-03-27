# PokéDex Backend (BFF)

A Node.js/Express 5 Backend-For-Frontend (BFF) that proxies the PokéAPI, handles authentication, and manages user data with MongoDB Atlas.

## Tech Stack

- **Node.js** + **Express 5**
- **MongoDB Atlas** + **Mongoose**
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT authentication
- **Native `fetch`** (Node 18+) — PokeAPI requests with in-memory caching

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3001
MONGODB_URI=your_mongodb_atlas_uri/pokedex_app
JWT_SECRET=your_secret_key
POKEAPI_BASE=https://pokeapi.co/api/v2
```

## Local Development

```bash
npm install
npm run dev      # node --watch (auto-restart)
```

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register (username, email, password) |
| POST | `/api/auth/login` | No | Login → returns JWT |
| GET | `/api/auth/me` | Yes | Get current user |

### Pokémon (BFF → PokéAPI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pokemon?limit=20&offset=0` | Paginated list |
| GET | `/api/pokemon/:id` | Pokémon details |
| GET | `/api/pokemon/:id/species` | Species info |
| GET | `/api/pokemon/:id/evolution` | Evolution chain |
| GET | `/api/pokemon/:id/moves` | Available moves |
| GET | `/api/types` | All types |
| GET | `/api/types/:name` | Pokémon by type |
| GET | `/api/generations` | All regions |
| GET | `/api/generations/:name` | Pokémon by region |

### Favorites (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/favorites` | Get favorites |
| POST | `/api/favorites/:pokemonId` | Add favorite |
| DELETE | `/api/favorites/:pokemonId` | Remove favorite |

### Teams (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | Get all teams |
| POST | `/api/teams` | Create team |
| PUT | `/api/teams/:id` | Update team |
| DELETE | `/api/teams/:id` | Delete team |
| POST | `/api/teams/:id/pokemon` | Add Pokémon to team |
| DELETE | `/api/teams/:id/pokemon/:pokemonId` | Remove from team |

### Social (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/search?q=` | Search users |
| GET | `/api/social/friends` | Friends list |
| POST | `/api/social/friends/request` | Send friend request |
| GET | `/api/social/friends/requests` | Get requests |
| POST | `/api/social/friends/accept/:id` | Accept request |
| POST | `/api/social/friends/reject/:id` | Reject request |
| DELETE | `/api/social/friends/:id` | Remove friend |

### Battles (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/battles/challenge` | Challenge a friend |
| GET | `/api/battles/pending` | Pending challenges |
| POST | `/api/battles/:id/accept` | Accept & start battle |
| POST | `/api/battles/:id/reject` | Reject challenge |
| POST | `/api/battles/:id/turn` | Submit move |
| GET | `/api/battles/:id` | Get battle state |
| GET | `/api/battles` | Battle history |

## Battle Mechanics

Damage = `((2*50/5+2) * Power * (Atk/Def)) / 50 + 2) * STAB * TypeEffectiveness * Random`

- **STAB**: 1.5× if move type matches attacker type  
- **Type Effectiveness**: Full 18-type chart (super effective, not very effective, immune)  
- **Turn Order**: Speed stat determines who attacks first  
- **Win Condition**: All opponent Pokémon reach 0 HP  

## Deployment to Railway

1. Push code to GitHub
2. Create a new Railway project and connect the repo
3. Add environment variables in Railway's dashboard:
   - `MONGODB_URI` = your Atlas URI
   - `JWT_SECRET` = a strong random secret
   - `PORT` = (Railway sets this automatically)
4. Railway auto-deploys on every push to `main`

## MongoDB Atlas Setup

1. Create a free cluster at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create a database user with read/write access
3. Whitelist `0.0.0.0/0` (allow all IPs) for Railway deployment
4. Copy the connection string and add `/pokedex_app` before `?`
