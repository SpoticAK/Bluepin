# Applicant referral code API

The `bluepin.in` applicant form uses this endpoint to receive a referral code
and link. The portal does not read or write Firestore directly.

## Endpoint

```http
POST https://app.bluepin.in/api/referrals/applicant
Content-Type: application/json
```

No authentication is required. The endpoint is rate-limited per IP.

### Request

```json
{
  "applicantName": "Priya Sharma",
  "applicantEmail": "priya@example.com",
  "applicantAge": 29,
  "applicantLinkedinUrl": "https://www.linkedin.com/in/priya-sharma"
}
```

`name` / `email` are also accepted as aliases for convenience. Age and
LinkedIn are optional for backwards compatibility, but the applicant form
collects them. When supplied:

- `applicantAge` must be an integer between 13 and 120.
- `applicantLinkedinUrl` must be a LinkedIn profile (`linkedin.com/in/...` or
  `linkedin.com/pub/...`). A missing protocol is accepted and normalized to
  `https://`.

### Response

```json
{
  "success": true,
  "code": "PRIYASHARM7K2P",
  "referralUrl": "https://app.bluepin.in/?ref=PRIYASHARM7K2P",
  "isActive": true,
  "created": true,
  "reused": false,
  "applicantName": "Priya Sharma",
  "applicantEmail": "priya@example.com",
  "applicantAge": 29,
  "applicantLinkedinUrl": "https://www.linkedin.com/in/priya-sharma"
}
```

- `created: true` means a new code was generated.
- `reused: true` means the email already had a code (including codes imported
  by the CSV seeder or created in the admin panel).
- Submitting the same email again, in any case or with surrounding whitespace,
  returns the same code.
- New codes are active immediately, have zero counters, and appear in the
  existing admin dashboard without any sync step.
- A re-submission never resets counters and never re-activates a code an admin
  has paused. In that case the response has `isActive: false`.

### Common errors

| Status | Meaning |
| --- | --- |
| `400` | Missing/invalid name, email, age, or LinkedIn URL; or a disposable email domain |
| `429` | Too many requests from this IP; retry after the window |
| `500` | Server/Firestore failure |

## Portal example

```js
const API_URL = "https://app.bluepin.in/api/referrals/applicant";
const STORAGE_KEY = "bluepin_referral";

async function registerApplicant(applicantName, applicantEmail, applicantAge, applicantLinkedinUrl) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicantName,
      applicantEmail,
      applicantAge,
      applicantLinkedinUrl,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not create referral link");
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      code: data.code,
      referralUrl: data.referralUrl,
      applicantEmail: data.applicantEmail,
    }),
  );

  return data;
}

function loadSavedReferral() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved?.referralUrl ? saved : null;
  } catch {
    return null;
  }
}
```

On page load, call `loadSavedReferral()` first so a reload keeps showing the
same link. If the applicant registers again with the same email, the API
returns the same code even if `localStorage` was cleared.

## Notes for the portal

- Do not use the Firebase client SDK against `referral_codes`; Firestore rules
  deny all client access.
- Do not build the link with `window.location.origin`; it must point at the
  main app (`https://app.bluepin.in`), not the portal.
- The applicant endpoint uses a CORS allowlist: `bluepin.in`,
  `www.bluepin.in`, `app.bluepin.in`, the `APP_URL` host, and localhost
  outside production. Add preview/custom hosts with `CORS_ALLOWED_ORIGINS`.
  Other API routes keep their previous permissive CORS behaviour.
- The returned link is intentionally short:
  `https://app.bluepin.in/?ref=CODE`. UTM parameters are not added.
- The applicant is not a referred user, so this endpoint does not create a
  `referral_events` document.
