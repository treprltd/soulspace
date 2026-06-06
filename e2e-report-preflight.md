# Soul Space E2E Test Report

**Date:** 2026-06-05T17:45:52.926Z  
**Target:** https://soulspacehealth.org  
**Mirror tests:** enabled  
**Digest tests:** skipped (no CRON_SECRET)

## Summary

| Result | Count |
|--------|-------|
| ✅ Passed   | 86 |
| ❌ Failed   | 1 |
| ⏭️ Skipped  | 19 |
| **Total**  | **106** |

> ✅ All critical tests passed — safe to deploy.

## Results

### Public Pages & Health Check

- ✅ `CRITICAL` **Homepage (GET /) is reachable** — *status=200* *(79ms)*
- ✅ **Pricing page (GET /pricing) is reachable** — *status=200* *(24ms)*
- ✅ `CRITICAL` **GET /api/health returns valid response** — *status=200 health=ok* *(149ms)*
- ✅ `CRITICAL` **/api/health reports supabase check** — *supabase=true* *(134ms)*
- ✅ **/api/health reports encryption check** — *encryption=true* *(135ms)*
### Authentication

- ✅ `CRITICAL` **Session and history routes return 401 without token** *(522ms)*
- ✅ `CRITICAL` **GET /api/subscription returns 200 without auth (public endpoint)** — *status=200 authenticated=false* *(152ms)*
- ✅ `CRITICAL` **Valid Bearer token returns 200 on /api/subscription** — *status=200 authenticated=true* *(264ms)*
- ✅ **Invalid Bearer token on /api/subscription → 200 unauthenticated (not 401)** — *status=200 authenticated=false* *(154ms)*
### Session Creation (POST /api/sessions)

- ✅ **Missing body returns 400** — *status=400* *(115ms)*
- ✅ **Invalid branch returns 400** — *status=400* *(124ms)*
- ✅ `CRITICAL` **Valid request creates session (201)** — *status=201 id=f42171f7-2ad0-403a-a4d0-235592d804eb* *(179ms)*
- ✅ `CRITICAL` **Created session appears in DB** — *branch=A* *(69ms)*
### Subscription & Usage (GET /api/subscription)

- ✅ `CRITICAL` **Returns planTier and sessionsThisMonth** — *tier=essentials sessions=1* *(392ms)*
- ✅ `CRITICAL` **Session count is accurate (≥1 after creation)** — *count=1* *(248ms)*
- ✅ **Limit field is present and correct for plan tier** — *tier=essentials limit=null (free→positive int, paid→null)* *(225ms)*
### Session History (GET /api/sessions/history)

- ✅ `CRITICAL` **Returns sessions array** — *status=200 count=1* *(176ms)*
- ✅ `CRITICAL` **History contains the created session** — *found* *(187ms)*
- ✅ **Limit param is respected (max=50)** — *returned 1* *(169ms)*
### Session Complete (POST /api/sessions/:id/complete)

- ✅ `CRITICAL` **Marks session as completed** — *completed_at=2026-06-05T17:45:37.234+00:00* *(240ms)*
- ✅ **Cannot complete non-existent session (returns 200 or 500)** — *status=200* *(157ms)*
### Resonance Tap (POST /api/sessions/:id/resonance)

- ✅ `CRITICAL` **Valid tap saves resonance_tap in DB** — *resonance_tap=accurate* *(244ms)*
- ✅ **Invalid result value returns 400** — *status=400* *(212ms)*
### Anonymous Session Recovery (POST /api/sessions/recover)

- ✅ `CRITICAL` **Valid recovery creates a session row** — *status=200 sessionId=8de30305-0090-4708-91f0-ab1375219708* *(254ms)*
- ✅ `CRITICAL` **Expired payload (>1h) is rejected with 410** — *status=410* *(136ms)*
- ✅ `CRITICAL` **Recovery without token returns 401** — *status=401* *(116ms)*
- ✅ `CRITICAL` **Session count increments after recovery** — *3 → 4* *(685ms)*
### Anonymous Session Recovery — DB State Verification

- ✅ `CRITICAL` **Recovery creates session row with completed_at set** — *status=200 sessionId=479a0dfb-41ce-4cf3-92d9-e7a3752df3a0* *(232ms)*
- ✅ `CRITICAL` **Recovered session has completed_at in DB** — *completed_at=2026-06-05T17:45:39.654+00:00 branch=D resonance=accurate* *(67ms)*
- ✅ `CRITICAL` **Recovered session has resonance_tap saved in DB** — *resonance_tap=accurate* *(60ms)*
- ✅ `CRITICAL` **Recovered session content exists in session_content table** — *encrypted content found in session_content* *(178ms)*
- ✅ `CRITICAL` **Recovery logs mirror_rendered event with recovered=true** — *event found, recovered=true* *(76ms)*
### Free-Tier Paywall (POST /api/mirror)

- ⏭️ **Mirror paywall enforcement** — *skipped — plan=essentials*
### Welcome Email (POST /api/user/welcome)

- ✅ `CRITICAL` **Returns 401 without auth token** — *status=401* *(0ms)*
- ✅ `CRITICAL` **Returns 200 for authenticated user (skipped for returning users)** — *status=200 sent=true skipped=undefined reason=* *(540ms)*
- ✅ **Idempotent — second call skips (user now has sessions)** — *skipped=true reason=already_sent* *(149ms)*
### Notification Banner Data (GET /api/subscription)

- ✅ `CRITICAL` **Response includes all banner-required fields** — *tier=essentials sessions=5 limit=null* *(218ms)*
- ✅ **subscription field is present (null for no active subscription)** — *subscription=null (no active sub — expected)* *(232ms)*
- ✅ `CRITICAL` **sessionsThisMonth is a non-negative integer** — *sessionsThisMonth=5* *(205ms)*
- ✅ `CRITICAL` **limit field is correct for plan tier** — *planTier=essentials limit=null (free→integer, paid→null)* *(265ms)*
### Notification Digest Endpoints (POST & GET /api/notifications/digest)

- ✅ `CRITICAL` **POST without cron secret returns 401** — *status=401* *(220ms)*
- ✅ `CRITICAL` **POST with wrong cron secret returns 401** — *status=401* *(148ms)*
- ✅ `CRITICAL` **GET without secret param returns 401** — *status=401* *(128ms)*
- ✅ **GET with wrong secret param returns 401** — *status=401* *(212ms)*
- ⏭️ **GET /api/notifications/digest health check** — *skipped — no CRON_SECRET*
- ⏭️ **POST digest mode=admin_digest** — *skipped — no CRON_SECRET*
- ⏭️ **POST digest mode=user_digest** — *skipped — no CRON_SECRET*
- ⏭️ **POST digest mode=all** — *skipped — no CRON_SECRET*
### Admin Users — gender and age columns (GET /api/admin/users)

- ✅ `CRITICAL` **GET /api/admin/users without cookie → 401** — *status=401* *(133ms)*
- ⏭️ **Users response includes dob field** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Users response includes gender field** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Test user row has gender=prefer_not_to_say after profile save** — *skipped — ADMIN_SECRET not set*
- ⏭️ **calcAge helper: test user age is a positive integer** — *skipped — ADMIN_SECRET not set*
### Admin Portal Auth (all /api/admin/* require admin cookie)

- ✅ `CRITICAL` **All admin GET routes return 401 without cookie** — *11/11 deployed routes all returned 401* *(1658ms)*
- ✅ `CRITICAL` **Admin routes also reject Bearer token (not admin cookie)** — *Bearer token correctly rejected on 11 admin routes* *(1367ms)*
- ✅ `CRITICAL` **POST /api/admin/auth with wrong password returns 401 or 503** — *status=401* *(111ms)*
- ✅ **DELETE /api/admin/auth (logout) returns 200** — *status=200* *(99ms)*
### Stripe Route Security

- ✅ `CRITICAL` **POST /api/stripe/checkout requires auth (returns 401)** — *status=401* *(144ms)*
- ✅ `CRITICAL` **POST /api/stripe/portal requires auth (returns 401)** — *status=401* *(106ms)*
- ✅ `CRITICAL` **POST /api/stripe/webhook without stripe-signature returns 400** — *status=400* *(107ms)*
- ✅ **POST /api/stripe/checkout with auth but invalid plan returns 400** — *status=400* *(148ms)*
### Admin Digest (POST /api/notifications/digest)

- ✅ `CRITICAL` **Missing cron secret returns 401** — *status=401* *(0ms)*
### User Profile API (GET & POST /api/user/profile)

- ✅ `CRITICAL` **GET /api/user/profile without token → 401** — *status=401* *(127ms)*
- ✅ `CRITICAL` **POST /api/user/profile without token → 401** — *status=401* *(98ms)*
- ✅ `CRITICAL` **GET /api/user/profile returns profile fields** — *status=200 profile_complete=false* *(186ms)*
- ✅ **POST /api/user/profile empty firstName → 400** — *status=400 error="First name is required."* *(133ms)*
- ✅ **POST /api/user/profile under-18 DOB → 400** — *status=400 error="You must be 18 or older to use Soul Space."* *(132ms)*
- ✅ **POST /api/user/profile invalid phone → 400** — *status=400 error="Please enter a valid phone number."* *(123ms)*
- ✅ **POST /api/user/profile missing gender → 400** — *status=400 error="Please select your gender identity."* *(124ms)*
- ✅ **POST /api/user/profile invalid gender value → 400** — *status=400 error="Please select your gender identity."* *(118ms)*
- ✅ `CRITICAL` **POST /api/user/profile saves valid profile with gender → 200** — *status=200 ok=true* *(194ms)*
- ✅ `CRITICAL` **GET /api/user/profile profile_complete=true after save** — *status=200 profile_complete=true* *(180ms)*
- ✅ **GET /api/user/profile returns saved name fields** — *first_name=E2E last_name=Test* *(206ms)*
- ✅ **GET /api/user/profile returns saved gender field** — *gender=prefer_not_to_say* *(158ms)*
- ✅ **POST /api/user/profile accepts non_binary gender → 200** — *status=200* *(185ms)*
### Phone Availability (GET /api/user/profile/check-phone)

- ✅ **check-phone unused number → available=true** — *available=true* *(154ms)*
- ⚠️ **check-phone taken number → available=false** — *available=true* *(167ms)*
- ✅ **check-phone missing phone param → 400** — *status=400* *(121ms)*
### User Data Deletion (DELETE /api/user/data)

- ✅ `CRITICAL` **DELETE /api/user/data without token returns 401** — *status=401* *(110ms)*
- ✅ **GET /api/user/data returns 405 (method not allowed)** — *status=405* *(125ms)*
### Beta Feedback API (GET & POST /api/feedback)

- ✅ `CRITICAL` **GET /api/feedback without token → 200 with null feedback (guest-safe)** — *status=200 feedback=null* *(125ms)*
- ✅ `CRITICAL` **POST /api/feedback without token and no guest_email → 400** — *status=400* *(95ms)*
- ✅ **POST /api/feedback without token but invalid email → 400** — *status=400* *(100ms)*
- ✅ `CRITICAL` **GET /api/feedback returns null before first submission** — *status=200  feedback=null* *(187ms)*
- ✅ **POST /api/feedback with invalid rating → 400** — *status=400* *(142ms)*
- ✅ **POST /api/feedback with invalid use_frequency → 400** — *status=400* *(136ms)*
- ✅ `CRITICAL` **CRITICAL POST /api/feedback saves valid submission → 201** — *status=201  id=7464e351* *(188ms)*
- ✅ `CRITICAL` **GET /api/feedback returns last submission after POST** — *status=200  rating=4  id=7464e351* *(207ms)*
- ✅ **POST /api/feedback with only comments → 201** — *status=201  id=23d31fdf* *(167ms)*
### Guest Feedback API (unauthenticated POST /api/feedback with guest_email)

- ✅ `CRITICAL` **POST without auth and no guest_email → 400** — *status=400* *(111ms)*
- ✅ **POST with malformed guest_email → 400** — *status=400* *(99ms)*
- ✅ `CRITICAL` **CRITICAL POST with valid guest_email → 201** — *status=201 id=6950cd7e* *(125ms)*
- ✅ **POST with guest_email and only rating → 201** — *status=201* *(121ms)*
- ✅ `CRITICAL` **GET /api/feedback without auth → 200 { feedback: null }** — *status=200 feedback=null* *(119ms)*
### Admin Feedback Endpoint (GET /api/admin/feedback)

- ✅ `CRITICAL` **GET /api/admin/feedback without cookie → 401** — *status=401* *(103ms)*
- ✅ `CRITICAL` **GET /api/admin/feedback with user Bearer token → 401** — *status=401* *(106ms)*
- ⏭️ **Admin login sets admin_session cookie** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Authenticated GET returns feedback array with stats** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Stats shape: avg_rating, total_responses, rating_counts, recommend_counts** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Test user feedback visible in admin list** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Rating filter (?rating=4) returns only matching rows** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Recommend filter (?recommend=yes_likely) returns only matching rows** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Each feedback row includes user_email and guest_email fields** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Guest submission visible in admin list with guest_email populated** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Pagination fields (page, pages, total) are present and numeric** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Admin logout clears session** — *skipped — ADMIN_SECRET not set*

---
*Generated by `scripts/e2e-test.js`*