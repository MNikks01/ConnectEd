# Runbook — Rotating the access-token signing key

`Status: Accepted` · `Last updated: 2026-08-02`

Implements the rotation described in `ADR-0014`. Planned maintenance, not an incident — unless you are here
because a key leaked, in which case skip to [Emergency rotation](#emergency-rotation).

## When

- **On schedule**, every 90 days.
- **Immediately**, if the private key may have been exposed: a leaked secret store, a key pasted anywhere it
  should not be, an operator leaving with access.

## What makes this safe

Access tokens live for 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`). A rotation therefore only has to keep the old
key verifiable for that long, plus a margin. Refresh tokens are opaque and unsigned, so sessions survive the
rotation untouched — a user whose access token was signed with the old key simply refreshes and gets one signed
with the new.

## Planned rotation

1. **Generate the new pair.**

   ```bash
   openssl genpkey -algorithm ed25519 -out jwt-private-new.pem
   openssl pkey -in jwt-private-new.pem -pubout -out jwt-public-new.pem
   ```

2. **Set the new pair, keeping the old public key.** In the secret manager:

   | Variable                  | Value                         |
   | ------------------------- | ----------------------------- |
   | `JWT_PRIVATE_KEY`         | new PKCS#8 PEM                |
   | `JWT_PUBLIC_KEY`          | new SPKI PEM                  |
   | `JWT_KEY_ID`              | new id, e.g. `access-2026-11` |
   | `JWT_PREVIOUS_PUBLIC_KEY` | **old** SPKI PEM              |
   | `JWT_PREVIOUS_KEY_ID`     | old id, e.g. `access-2026-08` |

3. **Deploy.** From this moment new tokens carry the new `kid`; tokens already out there still verify against
   the previous key.

4. **Check JWKS publishes both.**

   ```bash
   curl -s https://<api-host>/.well-known/jwks.json | jq '.keys[].kid'
   # "access-2026-11"
   # "access-2026-08"
   ```

5. **Wait out the overlap** — one access-token TTL plus a margin. **One hour** is comfortable for a 15-minute
   TTL.

6. **Drop the previous key.** Unset `JWT_PREVIOUS_PUBLIC_KEY` and `JWT_PREVIOUS_KEY_ID`, deploy, and confirm
   JWKS lists only the new `kid`. Destroy the old private key.

## Emergency rotation

The overlap exists to avoid logging people out. **If the old private key is compromised, that is exactly what
you want to happen** — a leaked key can mint tokens for any account until it stops being trusted.

1. Set the new pair as above, and **do not set** `JWT_PREVIOUS_PUBLIC_KEY`.
2. Deploy. Every token signed with the old key is refused on its next request.
3. Clients refresh automatically; the visible effect is one failed request, then normal service. Anything
   holding a stolen token is out.
4. Follow [`incident-response.md`](./incident-response.md) for the disclosure and audit side.

## Verifying

```bash
# A fresh login carries the new key id.
curl -s -X POST https://<api-host>/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"...","password":"..."}' |
  jq -r .accessToken | cut -d. -f1 | base64 -d | jq .kid
```

## If it goes wrong

**Symptom: every request 401s after a deploy.** The private and public keys do not match, or the PEM lost its
newlines in the secret store. The API refuses to start with only one of the pair set, so a boot loop points at
the key material rather than at a mismatch.

**Symptom: some requests 401 and some do not.** Instances are running different configurations — a partial
rollout. Finish it.

**Rollback** is putting the previous pair back as `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`. Tokens signed with the
new key then fail, so add the new public key as `JWT_PREVIOUS_PUBLIC_KEY` while doing it.
