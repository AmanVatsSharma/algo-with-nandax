# Auth Module

Authentication uses JWT access tokens plus refresh tokens with hashed persistence.

## Current security model

- Access token returned in response body.
- Refresh token:
  - stored hashed in DB,
  - issued as `httpOnly` cookie (`refreshToken`) on login/register/refresh,
  - rotated on each refresh.
- Legacy refresh body payload remains supported for compatibility.

## Refresh flow

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API Auth Controller
  participant S as Auth Service
  participant U as Users Service

  C->>A: POST /auth/refresh (cookie refreshToken)
  A->>S: refreshTokensWithToken(refreshToken, userIdHint?)
  S->>S: Verify JWT refresh token signature
  S->>U: findById(payload.sub)
  U-->>S: user + hashed refresh token
  S->>S: bcrypt compare(refreshToken, stored hash)
  S->>S: Generate new access+refresh tokens
  S->>U: update hashed refresh token
  S-->>A: new tokens
  A-->>C: accessToken body + rotated refreshToken cookie
```

## Cookie settings

- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: true` in production
- path: `/`

## Frontend note

Frontend should avoid persisting refresh token in browser storage and rely on cookie-based rotation.
