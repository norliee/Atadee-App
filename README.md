# atadeɛ — MVP prototype

A working full-stack prototype of the atadeɛ marketplace: customer search,
designer profiles with real photos, an Explore Styles feed, guided
measurements with reusable MyFit profiles, diaspora ordering, and order
tracking through to a designer dashboard.

## Run it

```
npm install
node server.js
```

Then open http://localhost:3000 in your browser. You'll see a small
"SQLite is an experimental feature" warning on startup — that's expected
and harmless (see note at the bottom).

The SQLite database (`sewfind.db`) is created and seeded automatically on
first run with 8 sample designers and photo-illustrated portfolio pieces
across Wedding, Corporate, Traditional, Kids, and Casual categories.

## What's implemented

1. **Browse & search** (`/index.html`) — filter designers by category,
   location, price range, and rating. Warm ivory/forest/gold boutique
   theme with cute line icons (mannequin, tape measure, needle & thread).
2. **Explore Styles** (`/explore.html`) — a Pinterest-style masonry feed of
   real looks across all designers, filterable by garment type. Tapping
   "Make this" jumps straight into ordering that exact style.
3. **Designer profile** (`/designer.html`) — real cover photo, visual
   portfolio grid, and a garment picker to start an order.
4. **Guided measurement engine** (`/order.html`) — asks only for the
   measurements each garment needs, shows plain-language "how to measure"
   guidance under every field, a live fill-progress bar, and a live
   estimated-size preview as you type.
5. **MyFit profiles** (`/myfit.html`) — save reusable body-measurement
   profiles (e.g. "Me", "Mum") and apply them to any order in one click.
   Stored locally in the browser for now — see note below.
6. **Diaspora ordering** — every order asks "who is this for?" (yourself,
   or someone else in Ghana with their own delivery address) and "ordering
   from" (Ghana or abroad), so customers overseas can order for family
   back home.
7. **In-app messaging with quote cards** (`/messages.html`) — an
   order-scoped chat thread between customer and designer. Designers can
   send a structured quote (itemized breakdown, ready-by date) that
   renders as a proper quote card; customers can Accept or Decline right
   in the thread, which updates the order's status and price
   automatically. Polls for new messages every few seconds.
8. **Order tracking with photo progress updates** (`/track.html`) —
   designers upload real photos (fabric received, cutting, finished
   piece) from the messages composer; customers see them in a dedicated
   "Progress updates" strip on their tracking page, no digging through
   chat required.
9. **Designer dashboard analytics** — a "Good [morning/evening], [name]"
   greeting plus live stat cards (revenue this month from completed
   orders, active orders, orders due within 7 days based on turnaround
   time, new requests), computed from real order data.
10. **Reviews with verified purchases** (`/review.html`) — customers can
    rate a completed order across six categories (quality, fit,
    communication, accuracy, value, on-time delivery), say whether
    they'd reorder, and leave a comment. Reviews are only possible on
    orders you actually completed on the platform (enforced server-side,
    one review per order), so every review carries a "Verified Purchase"
    badge. The designer's overall rating updates automatically as
    reviews come in.
11. **Trust badges** — designer profiles show specific verification
    badges (Phone, Identity, Business, Portfolio) instead of one generic
    "Verified" pill, plus a Track Record card showing real completion
    rate, on-time rate, and verified review count computed from order
    history.
12. **Designer dashboard** (`/dashboard.html`) — incoming orders with
    one-tap status updates and a direct link into each order's message
    thread, plus a real photo upload tool (cover photo + portfolio
    pieces) backed by an actual file-upload endpoint.
13. **Group orders** — an organizer starts a group order (wedding party,
    church group, uniforms) from a designer's profile and gets a
    shareable 6-character join code. Each participant follows the link,
    enters their own measurements, and joins independently — the
    organizer sees everyone's status on one page in real time.
14. **Appointment booking** (`/appointment.html`) — customers request a
    consultation, measurement, fitting, fabric selection, or collection
    slot, choosing studio or home visit (with address). Designers see
    requests on the dashboard and confirm or decline with one tap.
15. **Ready-to-wear shop** (`/shop.html`) — designers list already-made
    pieces (size, price, stock) customers can buy immediately without a
    bespoke wait. Buying decrements stock and creates a trackable order
    at the listed price, skipping the measurement step entirely.
16. **Style requests marketplace** (`/style-request-new.html`) — combines
    the PDR's "photo-based style requests" and "who can make this"
    reverse matching into one flow. A customer uploads a reference photo
    (optional), checks off what should change (fabric, sleeves,
    neckline, colour, fit, embroidery), and posts it with a budget and
    location. Any designer in a matching category can browse it from
    their dashboard and submit a quote — no need to pick a designer
    first. When the customer accepts a quote, they land directly in the
    guided order flow for that designer with their reference photo and
    notes carried over automatically.
17. **Find My Designer quiz** (`/find-designer.html`) — a short
    questionnaire (garment, budget, timeframe, location, style) scored
    against real designer data — budget overlap, turnaround vs. your
    deadline, location match, rating, verification, and current
    availability all factor into a match percentage with visible
    reasons ("Fits your budget," "Currently fully booked," etc.),
    ranked from best to worst fit.
18. **Near Me map** (`/map.html`) — an interactive map (Leaflet +
    OpenStreetMap, no API key needed) showing every designer's real
    approximate location in Ghana, filterable by category and
    availability, with an optional "use my location" button that
    filters by distance radius using the browser's geolocation API.
19. **In-app payments** (`/payment.html`) — pay by card, mobile money
    (MTN / AirtelTigo / Telecel), or PayPal, in full or as a 50%
    deposit with the balance tracked and payable later. **This is
    simulated** — there's no live payment processor connected, so no
    real money moves; it's built to the same UX shape a real
    integration (Paystack, Stripe, Flutterwave) would slot into.
    Payment status (unpaid / partial / paid) shows on the order
    tracking page with a running balance.
20. **Smart availability** — designers set their status (accepting /
    limited / fully booked) plus a free-text capacity note from the
    dashboard; it shows directly on their public profile next to their
    other stats.
21. **Designer calendar** — a "Today & upcoming" agenda on the dashboard
    merging appointment slots and order due-dates (estimated from
    order date + turnaround time) into one chronological, date-grouped
    view.
22. **Simple CRM** — a "Customers" section on the dashboard grouping a
    designer's orders by customer, showing order count, total spent,
    favorite garment, and flagging anyone with more than one order as
    a "Repeat customer."
23. **Designer onboarding** (`/designer-onboarding.html`) — a 4-step
    progressive wizard (personal details → business details → location
    → pricing) that actually creates a new, real designer record —
    they immediately appear in search, the map, and the dashboard
    selector, same as the seeded designers.
24. **Structured service menu** — designers list starting prices by
    garment (e.g. "Kaftan — from GH₵350") from the dashboard; it shows
    as a clean price list on their public profile so customers stop
    asking "how much?" before even messaging.
25. **Designer stories** — designers post quick photo updates (new
    designs, fabric arrivals, behind-the-scenes) from the dashboard;
    recent posts show as a horizontal strip at the top of their public
    profile.

## Order details visible to designers & simplified chat (latest round)

- **Designers can now see everything a customer submitted with an
  order** — measurements, budget range, notes, an inspiration photo if
  one was uploaded, and full delivery details when the order is for
  someone else. This was always saved to the database; it just wasn't
  shown anywhere on the dashboard before. Each order row now has a
  "View details ▾" toggle that expands to show all of it inline,
  without cluttering the row for the common case where you just want
  to glance at the order list.
- **Removed the "send a quote" feature from chat** — pricing already
  has a clear, single home (the "Set price" field directly on the
  order row), so having a second, more complex way to send a price via
  chat was redundant. The designer's message composer is back down to
  two things: a text box and a camera icon for progress photos —
  replacing the old needle icon, which didn't read as "upload a
  photo" the way an actual camera icon does.

- **"Anything to change from your inspiration photo?" now lives only
  on the order form**, not duplicated on "Find a Designer" too — since
  that page doesn't create a real order (just a matching request and,
  optionally, an open request other designers can quote on), the
  detailed change-preferences belong with the actual order where a
  specific designer will act on them, not the initial matching step.

## New logo — an original Pempamsie-inspired mark (latest round)

The nav logo (the badge next to "atadeɛ") now uses an original icon
inspired by Pempamsie, a traditional Akan Adinkra symbol representing
readiness and steadfastness — a fitting theme for a marketplace about
being prepared and reliable.

**Worth knowing:** the image originally shared for this was a
watermarked Dreamstime stock photo, which isn't something either of
us has the rights to use — so rather than using it directly, this is
a new, original icon drawn from scratch in the app's existing gold
line-art style (matching the other icons in the nav), inspired by the
traditional symbol's interlocking, linked-strength visual quality
rather than a copy of any specific artwork. The Adinkra symbol concept
itself is centuries-old Akan cultural heritage, not owned by anyone —
what's original here is this specific rendering of it.

**Update:** the first version was too abstract to read clearly at nav
size — redrawn to match the traditional symbol's real structure
(stacked scroll/hook pairs connected by a center spine) after being
shown a reference photo of an actual Pempamsie pendant. Checked
visually at both full size and actual nav-badge size before
finalizing, since the first draft looked fine large but lost its
shape once shrunk down.

## Requested changes on orders, and the sizing investigation (latest round)

- **"Anything to change from your inspiration photo?"** now exists on
  the actual order form, not just the separate "Find a Designer" quiz
  page — the same preset chips (different fabric, longer sleeves,
  different colour, etc.) plus a free-text box for describing it in
  your own words, on both pages now. Whatever's selected is saved with
  the order and shown to the designer on the order detail page as
  readable pills plus the custom note — not buried in the general
  notes field as unstructured text like it briefly was as a stopgap.
- **Customer name** was already collected on the order form and
  already shown to the designer (both on the dashboard order list and
  the order detail page) — confirmed this was already working
  correctly rather than assuming it needed building.
- **On the "always shows XS" sizing report:** tested extensively —
  the size-calculation function in isolation, the actual API endpoint
  directly, and a full browser simulation typing into the real form
  fields (including rapid multi-field typing to rule out a timing
  issue) — every test correctly computed the right size for the given
  measurements. Could not reproduce the reported bug. Did find and fix
  one real defensive gap regardless: the live size preview had no
  protection against a slow, out-of-order network response
  overwriting a newer, correct one — now fixed with request
  sequencing, even though it's not confirmed to be the actual cause.
  If this is still happening, the specific garment and measurement
  values used would help track it down precisely.

## Order details page, verified designer onboarding & naming (latest round)

- **"atadeɛ Service & Protection fee"** replaces "service fee" everywhere
  it's shown to customers and in admin. **"atadeɛ Sustainability"**
  replaces "atadeɛ Circular" as the displayed name (the URL stays
  `/circular.html` for stability — only what's shown changed).
- **A real order detail page for designers** (`/order-detail.html`),
  replacing the old cramped inline dropdown on the dashboard. Every
  measurement the customer submitted shows as a large, bold card (not
  small text in a list), and the inspiration photo is genuinely
  openable and zoomable — click to view it large, click again to zoom
  to ~1.9x, click outside or the × to close.
- **Designer onboarding now verifies designers before they can go
  live.** Three new steps were added after pricing: upload at least
  one photo of your work, upload a photo of your actual workplace, and
  (optionally) connect a mobile money payout account right there
  during signup instead of having to find that setting later. The
  designer's shop record is now created partway through onboarding
  (right after the pricing step) rather than at the very end, since
  the photo and payout steps need a real designer ID to attach photos
  and accounts to.
- **Admin approval is now genuinely gated on those photos** — enforced
  server-side (`PATCH /api/admin/designers/:id/approval` rejects the
  request with a clear error if either photo is missing), not just a
  UI suggestion. The admin Designers tab shows exactly what's missing
  per pending designer (✓/✗ for work photos and workplace photo, with
  a link to view the workplace photo) and visibly disables the
  Approve button until both are present — tested with one designer
  missing both, one missing one, and one with both, confirming the
  button and the server both agree at every stage.

## Tiered commission & service fee (latest round — replaces the flat-rate version below)

Both the designer commission and the customer service fee are now
**tiered lookup tables**, not single flat rates — editable in admin →
Finance, where each shows as an actual editable table rather than one
number. This came out of a real back-and-forth about fairness: a flat
10% commission on a GH₵5,000 order takes GH₵500, which can be a much
bigger bite out of a designer's actual profit margin than the same
10% on a GH₵300 order where materials are a smaller share of the
total. Tiers let smaller, more common orders keep a gentler rate while
big orders — which can comfortably absorb a smaller percentage in
absolute terms — still contribute meaningfully.

**How a tier applies:** the order's *total* value picks one bracket,
and that bracket's rate (or flat fee) applies to the whole order —
cliff-style, like the existing bracket picks a single rate rather than
taxing each slice differently. Simpler to explain to designers than a
marginal/bracket calculation, at the cost of a small rate "dip" right
at each boundary (a GH₵499 order nets a higher commission than a
GH₵500 order) — considered and accepted as a reasonable tradeoff for
the simplicity.

**Default commission tiers** (designer's side, taken from a split
payment):
| Order value | Commission |
|---|---|
| GH₵0–499 | 7% |
| GH₵500–999 | 6% |
| GH₵1,000–1,999 | 5% |
| GH₵2,000+ | 4% |

**Default service fee tiers** (flat GH₵, customer-facing, charged
**once per order** — not once per payment, so a deposit followed by a
balance payment isn't charged twice):
| Order value | Fee |
|---|---|
| Under GH₵300 | GH₵5 |
| GH₵300–699 | GH₵10 |
| GH₵700–1,499 | GH₵15 |
| GH₵1,500+ | GH₵20 |

**Important: the flat fee is not meant to fully cover Paystack's own
~1.95% processing cost on its own** — on a large order, 1.95% can
exceed a flat GH₵20 fee by a wide margin. The commission is the real
financial safety net, since it scales proportionally with order size
the same way Paystack's own fee does; the flat fee is just a small,
predictable, additional amount that happens to feel familiar to
Ghanaian mobile money users (MTN MoMo's own transfer fees are
presented the same tiered-flat way).

Both tables are fully live-editable from admin → Finance — add/remove
rows aren't supported yet (fixed at 4 tiers each), but every rate,
fee, and bracket boundary is. Verified end-to-end: tier lookups return
the correct rate/fee at every boundary, the one-time fee genuinely
only charges once across a real deposit-then-balance payment sequence
(confirmed via a live test: GH₵750 deposit + GH₵20 fee, then GH₵750
balance with **no** second fee), and editing a tier through the actual
admin UI persists and is immediately reflected in new lookups.

The admin Overview page's "commission earned" stat is now computed by
summing each order's actual tier against what's actually been paid on
it — a real calculation, not a single rate multiplied against total
revenue (which stopped being meaningful once rates vary by order
size).

## Customer service fee (superseded by the tiered version above)

Customers now pay a small fee on top of the order price — set in
admin → Finance → "Customer service fee (%)" (defaults to 5%). This
exists specifically to cover Paystack's own processing cost (currently
~1.95%) plus general overhead, without cutting into the designer's
share or your commission.

**How the money actually splits**, using a GH₵300 order with a 10%
commission and 5% service fee as an example:

- Customer pays: **GH₵315** (GH₵300 order + GH₵15 fee) — shown as a
  clear line-item breakdown on the payment page before they pay,
  never hidden or bundled in silently.
- Designer receives: **GH₵270** — their full 90% of the *order* price,
  completely untouched by the fee. Always. Every time.
- Platform receives: **GH₵45** (GH₵30 commission + GH₵15 fee), out of
  which Paystack's own ~1.95% processing fee is deducted — so the
  platform absorbs that cost, not the designer. This is the real
  reason the fee exists: instead of the Paystack cost eating into
  either your commission or the designer's earnings, this new revenue
  line is specifically what covers it.

This required reversing the previous round's change — designers had
briefly been set to absorb the Paystack fee themselves
(`bearer: 'subaccount'`); that's now removed, since the service fee
makes the platform the more sensible place for that cost to land. The
order's own price (`quoted_price` / `amount_paid`) is never inflated
by the fee — only the actual amount charged through Paystack is; the
fee itself is recorded as a separate `platform_fee` line in the
payments table (visible in admin → Finance → Transactions) so it's
always auditable separately from what customers paid toward their
order.

Applies the same way whether a designer has connected a payout account
or not, and on both the real Paystack mobile money flow and the
simulated card/PayPal/demo-momo flow, so the fee behaves identically
everywhere on the platform.

## Message inbox & customer service fee (latest round)

- **Designers absorbed the Paystack processing fee for one round, now
  they don't** — see the next section below for the current, final
  design (the platform absorbs it instead, funded by the new customer
  service fee).
- **A real message inbox**, not just per-order chat links buried in
  order details. Customers get a "Messages" link in the nav (shows an
  unread badge) linking to `/messages-inbox.html` — every conversation
  across all their orders in one place, sorted by most recent, with a
  preview of the last message ("📷 Sent a photo", "💰 Sent a quote",
  or the message text) and a per-conversation unread count. Designers
  get the same thing as a new "Messages" section on their dashboard
  Overview tab. Opening a conversation marks it read. Notifications for
  new messages and photos were already wired in from an earlier round
  and needed no changes — this just makes those conversations
  discoverable in one place instead of only reachable from a specific
  order.
- Caught a real ordering bug while building this: two messages sent
  within the same second have identical timestamps at the precision
  SQLite stores them, so "most recent message" was occasionally
  picking the wrong one. Fixed by breaking ties with the message's row
  ID, which always reflects true insertion order — confirmed by
  reproducing the exact scenario (two messages one second apart) and
  checking it resolved correctly both before and after the fix.

## Automatic payment splitting (latest round)

Designers can now connect their own mobile money account from their
dashboard (Overview tab → **Payout account**). Once connected, every
payment for their orders automatically splits inside Paystack — the
designer's share lands directly in their own account, and only the
platform's commission (whatever rate is currently set in the admin
Finance tab) reaches yours. No manual transfers, and no need to
recalculate anything if you change the commission rate later — the
split uses whatever rate is active at the moment of each payment, not
whatever it was when the designer connected.

This uses Paystack's real Subaccounts + Transaction Splitting feature
(their own documented mechanism for exactly this — marketplaces paying
vendors automatically). Under the hood: connecting an account calls
Paystack's `/subaccount` endpoint, which registers the designer's
mobile money number and returns a `subaccount_code`. From then on, the
charge request includes that code plus a `transaction_charge` (the
commission amount for that specific payment) — Paystack does the actual
splitting; this app never touches or holds the designer's share at any
point.

**A few things worth knowing:**

- **Designers without a connected payout account are unaffected** —
  their payments still work exactly as before (100% to the platform,
  same as if this feature didn't exist), so nothing breaks for anyone
  who hasn't set this up.
- **The account name gets verified automatically.** When a designer
  connects their number, Paystack resolves and returns the real name
  on that account — shown right there so they can catch a mistyped
  number before it's used for real payouts.
- **This needs the same `.env` setup as the mobile money payments
  above** — if Paystack isn't configured, the dashboard shows a plain
  message explaining that instead of a broken form.
- I verified the exact request/response shape against Paystack's live
  documentation for every endpoint involved (creating a subaccount,
  listing banks, and adding the split to a charge), but — same as the
  mobile money payments themselves — I can't complete an actual live
  connection or split from this environment, since it has no access to
  `api.paystack.co`. Worth testing yourself with a real (or test) momo
  number before relying on it for real designer payouts.

## Real mobile money payments via Paystack (latest round)

The Mobile Money option on the payment page can now charge a real MTN,
AirtelTigo, or Telecel account through your own Paystack account — this
is a genuine integration against Paystack's documented Charge API, not
a simulation. Card and PayPal on that same page are still the earlier
simulated flow (Paystack card payments need a different, popup-based
flow — a reasonable follow-up if you want it, but out of scope here).

### Setup

1. Copy `.env.example` to a new file named `.env` in the project root
   (same folder as `server.js`).
2. In your [Paystack dashboard](https://dashboard.paystack.com),
   go to **Settings → API Keys & Webhooks** and copy your **Secret Key**.
   Start with the **test** key (starts `sk_test_...`) — it lets you
   exercise the whole flow without moving real money. Paste it into
   `.env` as `PAYSTACK_SECRET_KEY=sk_test_...`.
3. Restart the server (`node server.js`). If the key is set, the
   payment page automatically switches from the demo mobile money flow
   to the real one — nothing else to configure for local testing.
4. When you're ready to accept real money, switch to your **live**
   secret key (`sk_live_...`) the same way.

### Two important things about how this actually works

- **Mobile money is asynchronous.** The customer gets a prompt on their
  phone to enter their PIN, so the charge doesn't complete instantly —
  Paystack gives them up to 180 seconds. The payment page shows a
  "check your phone" screen and polls for the result automatically, so
  this works correctly even without a webhook configured.
- **Webhooks need a public HTTPS URL — `localhost` can't receive them.**
  This app also has a webhook handler ready
  (`POST /api/paystack/webhook`, with real signature verification) for
  when you deploy somewhere public — add that URL under **Settings →
  API Keys & Webhooks** in your Paystack dashboard once you do. Until
  then, the polling fallback above is what actually confirms payments
  during local development, and it keeps working after you deploy too.

Never commit `.env` or share your secret key with anyone — treat it
like a password. `.env.example` is safe to share; your real `.env`
is not.

## Admin system (latest round)

Staff sign in through the same `/login.html` used by customers — the
only difference is their account has a staff `role` instead of
`customer`, and logging in redirects to `/admin.html`. Four seeded
accounts, one per role (**change these passwords in any real
deployment**):

| Role | Email | Password | Can access |
|---|---|---|---|
| Admin | admin@atadee.com | admin123 | Everything |
| Support | support@atadee.com | support123 | Overview, Trust & Safety, Orders, Support, Users |
| Finance | finance@atadee.com | finance123 | Overview, Orders, Finance |
| Moderator | moderator@atadee.com | moderator123 | Overview, Designers, Trust & Safety, Platform |

Role checks happen **server-side** on every admin endpoint (a
`requireRole()` middleware), not just in which tabs the frontend shows
— a support account calling a finance-only endpoint directly gets a
real 403, confirmed by testing it directly against the API rather than
just hiding the button.

Covers all 21 requested areas, grouped into coherent sections:
- **Overview** — real platform stats (designers, customers, orders,
  gross transaction value, revenue this month, commission earned,
  open reports/disputes/tickets), not placeholders.
- **Designers** — approvals (new signups start `pending` and are
  invisible in public search until approved), identity/business
  verification badges, portfolio moderation, featured listings, plan.
- **Trust & Safety** — reported profiles, disputes & refunds (delivery
  issues are a dispute category), rule-based suspicious-activity flags
  (designers with 2+ open reports, orders paid but stuck 14+ days,
  customers with repeated disputes), review moderation.
- **Orders & Transactions** — platform-wide order and payment
  visibility.
- **Finance** — platform commission rate, coupons/promotions.
- **Support** — customer support tickets with staff replies.
- **Users** — customer account suspension (blocks login immediately
  and signs them out everywhere).
- **Platform** — category management and Circular-page content
  management are now genuinely live: adding a category here actually
  appears in designer onboarding's dropdown, and editing a content
  block here actually changes what shows on `/circular.html` — neither
  was just admin-side decoration. Measurement standards are shown
  read-only (a full editable size-chart system would need moving
  `garments.js`'s charts into the database, flagged as a larger change
  than this pass covers).

Refunds actually move numbers: issuing one through a dispute reduces
the order's `amount_paid`, updates its payment status, and records a
negative transaction for the audit trail — tested end-to-end (paid
GH₵400, refunded GH₵100, confirmed the order correctly shows GH₵300
paid afterward).

## Nav cleanup, notifications & pretty dropdowns (latest round)

- **Simplified nav** — removed "Styles" (redundant with browsing into a
  designer's own portfolio) and "Find a Designer" (already a prominent
  button on the home page, right below the search bar) from the main
  navigation. Down to 5 clean links plus the account slot.
- **In-app notifications** — a bell icon (customer nav + designer
  dashboard) with an unread badge and dropdown, covering order status
  changes ("Ama Serwaa Couture confirmed your order! 🎉"), messages,
  and payments. Deliberately **not** browser push notifications — no
  service worker, no permission popup on first visit, nothing that
  could be a nuisance. Just a light 20-second poll to keep the badge
  current while a page is open, and everything only shows once you
  actually click the bell. Customer-side requires an account (so
  notifications land on the right person); designer-side is scoped to
  whichever designer is selected on the dashboard.
- **Pretty dropdowns everywhere** — every native `<select>` site-wide
  (filters, garment pickers, country selects, the designer switcher,
  appointment types, and more) is now a custom-styled dropdown with a
  matching icon, gold hover states, a floating option panel, and a
  checkmark on the current selection — instead of the browser's plain
  default. This runs off one reusable component with a
  `MutationObserver`, so dropdowns populated later by page scripts
  (most of them, since their options load from the API) get styled
  automatically without needing to touch each page individually.

## Accounts, orders tracking & privacy (latest round)

- **Real customer accounts** (`/login.html`) — email/password signup and
  sign-in with genuine security: passwords hashed with scrypt (Node's
  built-in crypto, no plaintext, no extra dependency), session tokens
  stored as SHA-256 hashes server-side (not the raw token — a database
  leak alone doesn't hand out valid sessions), HttpOnly cookies.
  **"Continue with Google" is a real integration**, not a demo — it
  uses Google's own Identity Services library and a real OAuth client
  ID, and the server verifies every sign-in against Google's tokeninfo
  endpoint (checking the token is genuinely from Google, issued for
  this exact app, and carries a verified email) before trusting it.
  Currently configured for `http://localhost:3000` — if you ever
  deploy this to a real domain, add that domain under "Authorized
  JavaScript origins" for the same OAuth client in Google Cloud
  Console, or sign-in will fail there. If the Google script can't load
  (no internet, or it's blocked), the page falls back to a clear
  message instead of breaking — the rest of the page still works.
- **Real password reset** — secure random token, 30-minute expiry,
  single-use, all hashed at rest. The only simulated part is email
  delivery (no mail server here) — the reset link is shown directly on
  screen with an honest explanation instead of pretending an email was
  sent, and using it signs the account out everywhere for safety.
- **My Orders** (`/my-orders.html`) — a real order history for signed-in
  customers, styled like tracking a parcel: Active/Completed tabs, a
  progress bar per order, expected completion date, tap through to a
  vertical checklist (✓ done, ● current, ○ upcoming) instead of the
  old horizontal timeline — reads much better on a phone. Guest
  checkout (no account) still works exactly as before; those orders
  just don't show in anyone's My Orders.
- **Settings & Privacy** (`/settings.html`) — account info, change
  password, **devices & sessions** (see and revoke any active session,
  not just the current one), **who has your measurements** (a real
  log of which designer received your measurements and for which
  order — not every designer, just the ones you actually shared with),
  **recent account activity** (a genuine audit log — login, password
  changes, consent grants), **data export** (download your account +
  order history as JSON), and **delete account** (removes your login
  and unlinks your order history — past orders stay in the designer's
  records, as any real marketplace keeps transaction records, but no
  longer show under your name). The page ends with an honest note
  about what's simplified for a prototype (no enforced HTTPS, no
  database-file encryption at rest, no real fraud monitoring).
- **Explicit measurement consent** — using a saved MyFit profile on an
  order now asks "Share [profile]'s measurements with [designer] for
  this order only?" before applying it, matching the exact pattern
  requested: measurements were already only ever sent to the specific
  designer for a specific order (never broadcast to everyone), and now
  that's made visible and explicit rather than just being true
  silently in the background.

## Simpler language & mobile-friendly dashboard (latest round)

- **Plainer customer-facing language** — the order button now says
  "Place order" instead of "Request quote," and order status labels
  are in plain English ("Order Placed," "Price Set," "In Progress,"
  "Ready for Pickup") instead of jargon. Designer-side status buttons
  read as real actions too ("Confirm Price," "Start Work," "Mark Ready
  for Pickup") instead of a generic "Mark X."
- **Reorganized designer dashboard** — split from one long "Business
  tools" scroll into four focused tabs: **Overview** (availability,
  today's schedule, orders, appointments, open requests — daily-use
  items), **Catalog** (photos, service menu, stories, shop),
  **Community** (group orders, customers, sustainability profile,
  fabric marketplace), and **Analytics** (see below). The header also
  stacks cleanly on narrow screens instead of cramming the title and
  designer picker onto one line.
- **Designer analytics** (new Analytics tab) — real tracked metrics,
  not placeholders: profile views, story views and likes per post,
  messages received, orders, appointment requests, quotes sent, and
  fabric requests. Views are recorded once per browser session (not
  once per page refresh) so the numbers can't be trivially inflated.
  Likes are toggleable from the public profile and update live.
- **Designer QR code** (in the Analytics tab) — generates a scannable
  QR code linking straight to the designer's public profile, with
  download and copy-link buttons. Needs a live internet connection to
  load the QR library (shows a friendly fallback message instead of
  breaking if that fails, same pattern as the map).

## Sustainability & Circular Fashion

- **Verified sustainability profiles** — designers check off which of 7
  specific practices they actually follow (fabric offcuts, recycled/
  reclaimed textiles, deadstock/surplus fabric, upcycled garments,
  locally sourced materials, low-waste cutting, repair & alteration
  services) from their dashboard. This is deliberately specific rather
  than a single vague "eco-friendly" toggle — designer profiles show
  only the practices actually checked, e.g. "✓ Uses fabric offcuts,
  ✓ Offers alterations & repairs," not a blanket claim.
- **Sustainable Designer badge** — automatically awarded once a
  designer has 3 or more verified practices checked. The dashboard
  shows live progress toward the badge and a toast the moment it's
  earned. Not manually granted, not for sale — purely threshold-based
  on what's actually checked.
- **🌿 Sustainable filter** — sits directly alongside price, rating,
  and category filters on the main browse page, not buried in an About
  tab.
- **SewFind Circular** (`/circular.html`) — a dedicated hub with: a
  live stats hero showing real badge count, practicing-designer count,
  and progress toward the stated 30%-of-designers goal; tabs for
  Sustainable Designers, Upcycled Fashion, Designs From Offcuts,
  Reworked & Redesigned pieces, and Repair & Alteration services; and
  four short educational cards on textile waste, deadstock, upcycling,
  and repair.
- **Waste-to-Value Fabric Marketplace** (`/fabric-marketplace.html`) —
  designers list leftover fabric, offcuts, and deadstock (photo,
  fabric type, quantity in metres, price) instead of discarding it.
  Other designers, fashion students, and craftspeople can browse and
  request it; the seller confirms and marks it handed over from their
  dashboard. One designer's waste becomes another creator's raw
  material — and a second, real revenue stream for designers.

## Trust, safety & polish (latest round)

- **Inspiration photo on every order** — the guided order form has an
  optional "Inspiration photo" upload right at the top, separate from
  the style-request marketplace's reference photo. It shows on the
  order tracking page too.
- **Anti-scam payment gating** — payment is only unlocked once an
  order has moved to "In progress" (or later) **and** the designer has
  sent at least one progress photo in the message thread. This is
  enforced server-side (`checkPaymentEligibility` in `server.js`), not
  just hidden in the UI, so it can't be bypassed by calling the API
  directly. Before that point, the tracking page explains why payment
  isn't available yet instead of showing a locked button with no
  context.
- **Rebuilt logo** — gold wordmark with a soft glow, sitting next to a
  circular badge holding the needle mark.
- **Decluttered designer dashboard** — split into two tabs: **Overview**
  (Availability, Orders, Appointments, Open style requests — daily-use
  items) and **Business tools** (Photos, Calendar, Group orders,
  Customers, Service menu, Stories, Shop). Much less overwhelming on
  mobile than one long scroll.
- **Near Me and MyFit moved to the footer** — freeing the main nav
  down to 5 links (Styles, Designers, Shop, Find a Designer, Designer
  dashboard).
- **Find a Designer + Post a Style Request merged into one flow**
  (`/find-designer.html`) — upload an inspiration photo, answer a few
  quick questions (garment, budget, timeframe, location, style,
  what to change from the photo), and submit. You instantly get ranked
  designer matches with real percentages and reasons ("Fits your
  budget," "Currently fully booked," etc.), **and** the request is
  quietly posted to the style-request marketplace at the same time so
  other designers can send quotes — with a "View incoming quotes" link
  to that thread. This isn't real image recognition — matching is
  based on garment type, category, and keyword overlap with designers'
  past portfolio work, not computer vision — but it's labeled honestly
  as such rather than overclaiming AI capability it doesn't have.

## Deliberately out of scope for this pass

Real authentication (the dashboard uses a designer picker instead of
login; MyFit profiles live in browser storage instead of an account),
a live payment processor connection (payments are simulated end-to-end
but no real money moves), a true designer calendar/slot picker for
appointments (currently a request-and-confirm flow rather than picking
from live availability), video posts (stories currently support photos
only), true image-recognition style matching (current matching is
keyword/category-based, not computer vision), and admin tooling — all
flagged as later-phase in the original product plan. Messaging polls
rather than using real-time sockets, which is fine for a prototype but
would want upgrading for production. The map needs a live internet
connection to load OpenStreetMap tiles (shows a friendly message
instead of crashing if that fails).

## Stack

- Backend: Node.js + Express + Node's built-in `node:sqlite` (no native
  compilation, no Python/build-tools needed) + Multer for photo uploads
- Frontend: vanilla HTML/CSS/JS (no build step — open and go)
- `garments.js` holds measurement fields, guide text, and size charts
- `db.js` holds the schema and seed data (designers, portfolio, orders)
- Uploaded photos are saved to `public/uploads/`

## Note on the database

Requires Node 22.5+. Uses `node:sqlite` instead of a third-party database
package specifically to avoid the native-compilation errors that come up
on machines without Python/Visual Studio Build Tools installed.

## Note on placeholder photos

Seed data uses real stock photos (via Picsum) as stand-ins until real
designers upload their own portfolio work through the dashboard's upload
tool — which is fully functional, not a mockup.
