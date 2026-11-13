# Awesome Adventure Tours Ticket Management

## Overview
The unified support module provides a customer-facing portal at `/support` and an admin workspace at `/admin/tickets`. Both use the same Supabase tables and RLS policies; the UI is not the security boundary.

## Ticket lifecycle
- New tickets receive a unique numeric sequence and display reference `KS-000001`.
- Customers can create tickets, link one of their own bookings, reply, and attach up to five private files per reply.
- Staff can work tickets allowed by their effective multi-role permissions, add private internal notes, update priority/status, and claim tickets when their role has assignment permission.
- A customer reply reopens a resolved ticket. Closed tickets cannot receive new replies.
- Status and assignment changes, priority changes, ticket creation, and message activity are recorded in an append-only event history.

## Statuses
`open`, `assigned`, `in_progress`, `waiting_customer`, `waiting_third_party`, `resolved`, `closed`, `reopened`.

## Priority and SLA defaults
| Priority | First response target | Resolution target |
| --- | ---: | ---: |
| Critical | 15 minutes | 4 hours |
| Urgent | 1 hour | 8 hours |
| High | 2 hours | 1 day |
| Normal | 4 hours | 2 days |
| Low | 4 hours | 2 days |

Targets are stored as UTC timestamps. Business-hours calendars, holidays, automated escalations and outbound email delivery can be layered onto the existing communication/notification infrastructure in a later iteration.

## Access model
- Customers can read and reply only to tickets they created. Internal notes and their audit events are hidden from customers.
- Staff can read tickets assigned to them where their role has `tickets.read_assigned`.
- Support agents and managers receive broader ticket queue access through `tickets.read` / `tickets.manage`.
- Ticket mutations are controlled by `tickets.create`, `tickets.reply`, `tickets.update`, `tickets.assign` and `tickets.internal_note`.
- Role grants are attached to the existing `access_roles` and `role_permissions` records; multiple roles continue to combine through the existing RBAC evaluator.
- Attachments use a private Storage bucket, ticket-scoped object paths, MIME allowlists, a 10 MB per-file limit and expiring signed download URLs.

## Database objects
- `support_tickets`: ticket identity, requester, customer/booking references, assignment, state and SLA timestamps.
- `support_ticket_messages`: public replies and private notes.
- `support_ticket_events`: append-only audit timeline.
- `support-ticket-attachments`: private Storage bucket.

The ticket creation trigger links the requester to their own CRM customer record where one exists and writes a concise activity to the CRM customer timeline without copying private message content.

## Deployment
Apply the migration `20261112090000_unified_ticket_management.sql` through the repository's normal Supabase migration workflow. Do not run the migration manually against production while the PR is under review. The pgTAP assertions in `supabase/tests/unified_ticket_management.test.sql` verify RLS, grants, permission seeds, private attachment configuration and trigger presence.
