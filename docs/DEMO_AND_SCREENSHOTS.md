# Demo and Screenshot Checklist

Use this order for a smooth faculty demonstration and for collecting report/PPT screenshots.

## Recommended live demo

1. **Login and RBAC:** show member login, then attempt a librarian-only request in Postman to demonstrate `403 Forbidden`.
2. **Catalog:** search by title, filter a category, and filter by availability.
3. **Borrowing rule:** borrow an available title, then try the same title again to show the duplicate-loan `409` response.
4. **Membership limit:** explain that the plan controls `maxBooks`, `loanDays`, `finePerDay`, and `graceDays`.
5. **Return and fine:** use Postman to supply a future `returnDate`, then show `overdueDays`, `assessedAmount`, and `paymentStatus`.
6. **Payment:** sign in as librarian and record a partial or full fine payment.
7. **Hold queue:** make a book unavailable, place a member hold, return a good copy, and show the ready hold notification.
8. **Inventory:** mark one copy damaged, then repair it and show the count changes.
9. **Reports:** open the most-borrowed, overdue, inventory health, and fine summary views.
10. **Admin:** create a librarian, edit settings, and show membership plans.

## Screenshots to capture

- Member registration success with generated membership ID.
- Login success and JWT variable saved in Postman.
- Catalog search result.
- Book creation response.
- Successful issue response with calculated due date.
- Out-of-stock or duplicate-loan `409` error.
- Return response with a fine.
- Fine payment and updated balance.
- Hold queue with position.
- Hold-ready notification.
- Inventory health report.
- Most borrowed report.
- Admin membership plans/settings.
- Responsive browser screens for member, librarian, and admin.

Never include the real `.env`, database URI, JWT secret, or real passwords in a screenshot.
