# Soul Space E2E Test Report

**Date:** 2026-06-04T06:02:36.662Z  
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

- ✅ `CRITICAL` **Homepage (GET /) is reachable** — *status=200* *(125ms)*
- ✅ **Pricing page (GET /pricing) is reachable** — *status=200* *(169ms)*
- ✅ `CRITICAL` **GET /api/health returns valid response** — *status=200 health=ok* *(314ms)*
- ✅ `CRITICAL` **/api/health reports supabase check** — *supabase=true* *(110ms)*
- ✅ **/api/health reports encryption check** — *encryption=true* *(122ms)*
### Authentication

- ✅ `CRITICAL` **Session and history routes return 401 without token** *(574ms)*
- ✅ `CRITICAL` **GET /api/subscription returns 200 without auth (public endpoint)** — *status=200 authenticated=false* *(108ms)*
- ✅ `CRITICAL` **Valid Bearer token returns 200 on /api/subscription** — *status=200 authenticated=true* *(344ms)*
- ✅ **Invalid Bearer token on /api/subscription → 200 unauthenticated (not 401)** — *status=200 authenticated=false* *(135ms)*
### Session Creation (POST /api/sessions)

- ✅ **Missing body returns 400** — *status=400* *(128ms)*
- ✅ **Invalid branch returns 400** — *status=400* *(91ms)*
- ✅ `CRITICAL` **Valid request creates session (201)** — *status=201 id=28cedccb-2bcc-4b60-bf0e-b93744234d2d* *(150ms)*
- ✅ `CRITICAL` **Created session appears in DB** — *branch=A* *(71ms)*
### Subscription & Usage (GET /api/subscription)

- ✅ `CRITICAL` **Returns planTier and sessionsThisMonth** — *tier=essentials sessions=1* *(230ms)*
- ✅ `CRITICAL` **Session count is accurate (≥1 after creation)** — *count=1* *(193ms)*
- ✅ **Limit field is present and correct for plan tier** — *tier=essentials limit=null (free→positive int, paid→null)* *(178ms)*
### Session History (GET /api/sessions/history)

- ✅ `CRITICAL` **Returns sessions array** — *status=200 count=1* *(159ms)*
- ✅ `CRITICAL` **History contains the created session** — *found* *(141ms)*
- ✅ **Limit param is respected (max=50)** — *returned 1* *(155ms)*
### Session Complete (POST /api/sessions/:id/complete)

- ✅ `CRITICAL` **Marks session as completed** — *completed_at=2026-06-04T06:02:20.525+00:00* *(198ms)*
- ✅ **Cannot complete non-existent session (returns 200 or 500)** — *status=200* *(120ms)*
### Resonance Tap (POST /api/sessions/:id/resonance)

- ✅ `CRITICAL` **Valid tap saves resonance_tap in DB** — *resonance_tap=accurate* *(216ms)*
- ✅ **Invalid result value returns 400** — *status=400* *(94ms)*
### Anonymous Session Recovery (POST /api/sessions/recover)

- ✅ `CRITICAL` **Valid recovery creates a session row** — *status=200 sessionId=13d6fe5c-ca09-4a48-88fd-0a34fc810df2* *(226ms)*
- ✅ `CRITICAL` **Expired payload (>1h) is rejected with 410** — *status=410* *(122ms)*
- ✅ `CRITICAL` **Recovery without token returns 401** — *status=401* *(93ms)*
- ✅ `CRITICAL` **Session count increments after recovery** — *3 → 4* *(645ms)*
### Anonymous Session Recovery — DB State Verification

- ✅ `CRITICAL` **Recovery creates session row with completed_at set** — *status=200 sessionId=1736a165-26b6-4fba-8f80-1d6861f79c48* *(207ms)*
- ✅ `CRITICAL` **Recovered session has completed_at in DB** — *completed_at=2026-06-04T06:02:22.7+00:00 branch=D resonance=accurate* *(67ms)*
- ✅ `CRITICAL` **Recovered session has resonance_tap saved in DB** — *resonance_tap=accurate* *(59ms)*
- ✅ `CRITICAL` **Recovered session content exists in session_content table** — *encrypted content found in session_content* *(304ms)*
- ✅ `CRITICAL` **Recovery logs mirror_rendered event with recovered=true** — *event found, recovered=true* *(105ms)*
### Free-Tier Paywall (POST /api/mirror)

- ⏭️ **Mirror paywall enforcement** — *skipped — plan=essentials*
### Welcome Email (POST /api/user/welcome)

- ✅ `CRITICAL` **Returns 401 without auth token** — *status=401* *(0ms)*
- ✅ `CRITICAL` **Returns 200 for authenticated user (skipped for returning users)** — *status=200 sent=true skipped=undefined reason=* *(501ms)*
- ✅ **Idempotent — second call skips (user now has sessions)** — *skipped=true reason=already_sent* *(188ms)*
### Notification Banner Data (GET /api/subscription)

- ✅ `CRITICAL` **Response includes all banner-required fields** — *tier=essentials sessions=5 limit=null* *(264ms)*
- ✅ **subscription field is present (null for no active subscription)** — *subscription=null (no active sub — expected)* *(188ms)*
- ✅ `CRITICAL` **sessionsThisMonth is a non-negative integer** — *sessionsThisMonth=5* *(205ms)*
- ✅ `CRITICAL` **limit field is correct for plan tier** — *planTier=essentials limit=null (free→integer, paid→null)* *(229ms)*
### Notification Digest Endpoints (POST & GET /api/notifications/digest)

- ✅ `CRITICAL` **POST without cron secret returns 401** — *status=401* *(94ms)*
- ✅ `CRITICAL` **POST with wrong cron secret returns 401** — *status=401* *(91ms)*
- ✅ `CRITICAL` **GET without secret param returns 401** — *status=401* *(98ms)*
- ✅ **GET with wrong secret param returns 401** — *status=401* *(90ms)*
- ⏭️ **GET /api/notifications/digest health check** — *skipped — no CRON_SECRET*
- ⏭️ **POST digest mode=admin_digest** — *skipped — no CRON_SECRET*
- ⏭️ **POST digest mode=user_digest** — *skipped — no CRON_SECRET*
- ⏭️ **POST digest mode=all** — *skipped — no CRON_SECRET*
### Admin Users — gender and age columns (GET /api/admin/users)

- ✅ `CRITICAL` **GET /api/admin/users without cookie → 401** — *status=401* *(89ms)*
- ⏭️ **Users response includes dob field** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Users response includes gender field** — *skipped — ADMIN_SECRET not set*
- ⏭️ **Test user row has gender=prefer_not_to_say after profile save** — *skipped — ADMIN_SECRET not set*
- ⏭️ **calcAge helper: test user age is a positive integer** — *skipped — ADMIN_SECRET not set*
### Admin Portal Auth (all /api/admin/* require admin cookie)

- ✅ `CRITICAL` **All admin GET routes return 401 without cookie** — *11/11 deployed routes all returned 401* *(1133ms)*
- ✅ `CRITICAL` **Admin routes also reject Bearer token (not admin cookie)** — *Bearer token correctly rejected on 11 admin routes* *(1573ms)*
- ✅ `CRITICAL` **POST /api/admin/auth with wrong password returns 401 or 503** — *status=401* *(95ms)*
- ✅ **DELETE /api/admin/auth (logout) returns 200** — *status=200* *(101ms)*
### Stripe Route Security

- ✅ `CRITICAL` **POST /api/stripe/checkout requires auth (returns 401)** — *status=401* *(111ms)*
- ✅ `CRITICAL` **POST /api/stripe/portal requires auth (returns 401)** — *status=401* *(89ms)*
- ✅ `CRITICAL` **POST /api/stripe/webhook without stripe-signature returns 400** — *status=400* *(88ms)*
- ✅ **POST /api/stripe/checkout with auth but invalid plan returns 400** — *status=400* *(113ms)*
### Admin Digest (POST /api/notifications/digest)

- ✅ `CRITICAL` **Missing cron secret returns 401** — *status=401* *(0ms)*
### User Profile API (GET & POST /api/user/profile)

- ✅ `CRITICAL` **GET /api/user/profile without token → 401** — *status=401* *(94ms)*
- ✅ `CRITICAL` **POST /api/user/profile without token → 401** — *status=401* *(110ms)*
- ✅ `CRITICAL` **GET /api/user/profile returns profile fields** — *status=200 profile_complete=false* *(326ms)*
- ✅ **POST /api/user/profile empty firstName → 400** — *status=400 error="First name is required."* *(129ms)*
- ✅ **POST /api/user/profile under-18 DOB → 400** — *status=400 error="You must be 18 or older to use Soul Space."* *(264ms)*
- ✅ **POST /api/user/profile invalid phone → 400** — *status=400 error="Please enter a valid phone number."* *(156ms)*
- ✅ **POST /api/user/profile missing gender → 400** — *status=400 error="Please select your gender identity."* *(138ms)*
- ✅ **POST /api/user/profile invalid gender value → 400** — *status=400 error="Please select your gender identity."* *(130ms)*
- ✅ `CRITICAL` **POST /api/user/profile saves valid profile with gender → 200** — *status=200 ok=true* *(177ms)*
- ✅ `CRITICAL` **GET /api/user/profile profile_complete=true after save** — *status=200 profile_complete=true* *(144ms)*
- ✅ **GET /api/user/profile returns saved name fields** — *first_name=E2E last_name=Test* *(179ms)*
- ✅ **GET /api/user/profile returns saved gender field** — *gender=prefer_not_to_say* *(141ms)*
- ✅ **POST /api/user/profile accepts non_binary gender → 200** — *status=200* *(201ms)*
### Phone Availability (GET /api/user/profile/check-phone)

- ✅ **check-phone unused number → available=true** — *available=true* *(104ms)*
- ⚠️ **check-phone taken number → available=false** — *available=true* *(133ms)*
- ✅ **check-phone missing phone param → 400** — *status=400* *(86ms)*
### User Data Deletion (DELETE /api/user/data)

- ✅ `CRITICAL` **DELETE /api/user/data without token returns 401** — *status=401* *(93ms)*
- ✅ **GET /api/user/data returns 405 (method not allowed)** — *status=405* *(138ms)*
### Beta Feedback API (GET & POST /api/feedback)

- ✅ `CRITICAL` **GET /api/feedback without token → 200 with null feedback (guest-safe)** — *status=200 feedback=null* *(125ms)*
- ✅ `CRITICAL` **POST /api/feedback without token and no guest_email → 400** — *status=400* *(140ms)*
- ✅ **POST /api/feedback without token but invalid email → 400** — *status=400* *(122ms)*
- ✅ `CRITICAL` **GET /api/feedback returns null before first submission** — *status=200  feedback=null* *(160ms)*
- ✅ **POST /api/feedback with invalid rating → 400** — *status=400* *(118ms)*
- ✅ **POST /api/feedback with invalid use_frequency → 400** — *status=400* *(109ms)*
- ✅ `CRITICAL` **CRITICAL POST /api/feedback saves valid submission → 201** — *status=201  id=6a71dee4* *(134ms)*
- ✅ `CRITICAL` **GET /api/feedback returns last submission after POST** — *status=200  rating=4  id=6a71dee4* *(181ms)*
- ✅ **POST /api/feedback with only comments → 201** — *status=201  id=44920aca* *(133ms)*
### Guest Feedback API (unauthenticated POST /api/feedback with guest_email)

- ✅ `CRITICAL` **POST without auth and no guest_email → 400** — *status=400* *(157ms)*
- ✅ **POST with malformed guest_email → 400** — *status=400* *(105ms)*
- ✅ `CRITICAL` **CRITICAL POST with valid guest_email → 201** — *status=201 id=dc2ef24d* *(126ms)*
- ✅ **POST with guest_email and only rating → 201** — *status=201* *(115ms)*
- ✅ `CRITICAL` **GET /api/feedback without auth → 200 { feedback: null }** — *status=200 feedback=null* *(102ms)*
### Admin Feedback Endpoint (GET /api/admin/feedback)

- ✅ `CRITICAL` **GET /api/admin/feedback without cookie → 401** — *status=401* *(91ms)*
- ✅ `CRITICAL` **GET /api/admin/feedback with user Bearer token → 401** — *status=401* *(96ms)*
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