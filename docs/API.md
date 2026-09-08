# REST API Reference

Base URL: `http://localhost:4000/api`

Protected endpoints require `Authorization: Bearer <token>`. Admin inherits librarian permissions wherever both roles are listed.

## Authentication

| Method | Endpoint | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | Public | `name`, `email`, `password`, `memberType`; optional `phone` |
| POST | `/auth/login` | Public | `email`, `password` |
| GET | `/auth/me` | Authenticated | Current account with membership plan |
| PUT | `/auth/me` | Authenticated | Optional `name`, `phone` |
| PUT | `/auth/change-password` | Authenticated | `currentPassword`, `newPassword` |

Registration example:

```json
{
  "name": "Ananya Rao",
  "email": "ananya@example.com",
  "password": "StrongPass123!",
  "memberType": "student",
  "phone": "9876543210"
}
```

## Books and inventory

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/books` | Public | Paginated catalog; accepts `q`, `title`, `author`, `category`, `available`, `sort`, `page`, `limit` |
| GET | `/books/search` | Public | Alias for the same search behavior |
| GET | `/books/categories` | Public | List unique categories |
| GET | `/books/:id` | Public | One active catalog record |
| POST | `/books` | Librarian | Add a title; `availableCopies` starts equal to `totalCopies` |
| PUT | `/books/:id` | Librarian | Update bibliographic details |
| PATCH | `/books/:id/inventory` | Librarian | Apply an inventory action |
| DELETE | `/books/:id` | Librarian | Archive a title if no active loan exists |

Create book:

```json
{
  "title": "Deep Learning",
  "author": "Ian Goodfellow",
  "isbn": "9780262035613",
  "category": "Artificial Intelligence",
  "totalCopies": 4,
  "publisher": "MIT Press",
  "publishedYear": 2016,
  "shelfLocation": "A-03"
}
```

Inventory update:

```json
{
  "action": "mark-damaged",
  "quantity": 1
}
```

## Transactions and returns

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/transactions/borrow` | Member | Self-borrow using `bookId` |
| POST | `/transactions/issue` | Librarian | Issue using `bookId`, `memberId`; optional ISO `dueDate` |
| GET | `/transactions/my` | Member | Own paginated history; optional `status` |
| GET | `/transactions` | Librarian | All; optional `status`, `memberId`, `bookId` |
| GET | `/transactions/:id` | Owner/Librarian | One transaction |
| PUT | `/transactions/:id/return` | Owner/Librarian | Optional `condition` and ISO `returnDate` |
| PUT | `/transactions/:id/waive-fine` | Librarian | Required `reason`; optional partial `amount` |

Issue:

```json
{
  "bookId": "{{bookId}}",
  "memberId": "{{memberId}}"
}
```

Return and force an evaluation date for demonstration:

```json
{
  "condition": "good",
  "returnDate": "2026-10-15T10:00:00.000Z"
}
```

The returned transaction includes `overdueDays`, embedded fine totals, and a virtual `fineBalance`.

## Holds

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/holds` | Member | Place a hold with `bookId` |
| GET | `/holds/my` | Member | Own holds; optional `status` |
| GET | `/holds` | Librarian | All holds; optional `status`, `bookId`, `memberId` |
| GET | `/holds/book/:bookId/queue` | Librarian | Active FIFO queue and positions |
| PUT | `/holds/:id/cancel` | Owner/Librarian | Cancel an active hold |
| PUT | `/holds/:id/status` | Librarian | Set waiting/ready/fulfilled/cancelled/expired |
| POST | `/holds/expire-ready` | Librarian | Expire elapsed ready windows and promote the queue |

## Membership plans

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/membership-plans` | Authenticated | Active plans; admin sees inactive plans too |
| POST | `/membership-plans` | Admin | Create plan |
| PUT | `/membership-plans/:id` | Admin | Update plan |
| DELETE | `/membership-plans/:id` | Admin | Delete only when no active member is assigned |

```json
{
  "key": "student-standard",
  "name": "Student Standard",
  "memberType": "student",
  "maxBooks": 4,
  "loanDays": 14,
  "finePerDay": 5,
  "graceDays": 1,
  "isActive": true
}
```

## Fine payments

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/fine-payments` | Librarian | Record full/partial payment |
| GET | `/fine-payments/my` | Member | Own payment audit history |
| GET | `/fine-payments` | Librarian | Paginated payments; optional `memberId`, `status` |
| PUT | `/fine-payments/:id/reverse` | Admin | Reverse a completed payment with `reason` |

```json
{
  "transactionId": "{{transactionId}}",
  "amount": 10,
  "method": "upi",
  "reference": "UPI-DEMO-001"
}
```

## Notifications

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/notifications/my` | Member | Own notifications; optional `status` |
| PUT | `/notifications/read-all` | Member | Mark all as read |
| PUT | `/notifications/:id/read` | Member | Mark one as read |
| POST | `/notifications/generate-overdue` | Librarian | Update overdue statuses and create daily reminder records |

## Members and history

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/members` | Librarian | Paginated directory; `q`, `memberType`, `active` |
| GET | `/members/:id` | Librarian | Member profile and plan |
| GET | `/members/:id/history` | Owner/Librarian | Profile, summary, and full borrowing timeline |

## Reports

All report routes require librarian/admin.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/reports/dashboard` | Counts for catalog, copies, loans, holds, and fine totals |
| GET | `/reports/most-borrowed?limit=10` | Popularity aggregation |
| GET | `/reports/overdue` | Active loans whose due date has passed |
| GET | `/reports/inventory-health` | Per-title available/borrowed/lost/damaged breakdown |
| GET | `/reports/fines` | Assessed/waived/paid/outstanding totals and payment methods |

`/admin/reports/...` is also supported as an alias to match the project brief.

## Admin accounts and settings

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/users` | Admin | Paginated users; optional `q`, `role`, `active` |
| POST | `/admin/users/staff` | Admin | Create librarian/admin |
| PUT | `/admin/users/:id/status` | Admin | Enable/disable account |
| PUT | `/admin/users/:id/role` | Admin | Change role |
| GET | `/settings` | Authenticated | Library name, currency, time zone, hold and self-service rules |
| PUT | `/settings` | Admin | Update settings |

## Error status guide

| HTTP status | Meaning |
|---:|---|
| 400 | Invalid body/query/date or failed schema validation |
| 401 | Missing, invalid, or expired JWT |
| 403 | Valid identity but insufficient role/ownership |
| 404 | Route or record does not exist |
| 409 | Business-rule conflict such as no stock, duplicate loan, queue priority, or excessive payment |
| 429 | Authentication rate limit exceeded |
| 500 | Unexpected server error with a safe generic production response |
