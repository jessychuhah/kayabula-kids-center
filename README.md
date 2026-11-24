# Kayabula Kids Centre

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set both Supabase URLs: `DATABASE_URL` to the transaction-mode pooler (port `6543`) for app queries, and `DIRECT_URL` to the session-mode pooler (port `5432`) for Prisma migrations. URL-encode special characters in the database password (for example, `@` as `%40`).
3. Configure distinct `OWNER_EMAIL` / `OWNER_PASSWORD` and `ADMIN_EMAIL` / `ADMIN_PASSWORD` values. Use passwords between 12 and 128 characters. Do not commit `.env`.
4. For a new, empty database, apply the migrations and generate the Prisma client:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. Start the website with `npm run dev`.

If the database already contains the original `ContactSubmission` and `Donation` tables but has no Prisma migration history, baseline the initial migration before deploying the account migration:

```bash
npx prisma migrate resolve --applied 20261121200000_initial
npx prisma migrate deploy
npx prisma generate
```

For an existing database with no Prisma migration history, baseline the initial migration before deploying the remaining migrations:

```bash
npx prisma migrate resolve --applied 20261121200000_initial
npx prisma migrate deploy
npx prisma generate
```

Once migrations have been applied, run `npm run seed:accounts` once to create the configured owner and administrator. The command refuses to overwrite accounts with those emails. Admin and owner registration is not available through the public account form. Staff can change their passwords from **Security** in their dashboard.

Create a regular account at `/account` to save a name, email, phone number, and location for checkout and account management. New members can use the website while awaiting approval; accounts still pending after five days are suspended. Guests can still donate without an account.

The `/admin` page requires an administrator session and displays persisted donation records. Payment checkout remains unavailable until the Pesapal credentials and callback settings in `.env` are configured.

## Account approval, support chat and public content

New member accounts can use the website immediately while awaiting administrator approval. Approval creates an in-app notification and queues an email through Resend. Set `RESEND_API_KEY` and a verified `EMAIL_FROM` address to deliver approval email. Vercel runs `/api/cron/pending-accounts` hourly to suspend accounts still awaiting approval after five days and retry queued approval emails; set `CRON_SECRET` in the deployment environment. Account access checks also enforce the five-day limit.

Staff can approve users, manage homepage impact figures and WhatsApp details, and manage advertisements at `/admin/users` and `/admin/content`. Administrators can upload multiple images or videos for an advertisement; each ad has its own display duration and active ads repeat continuously in the public homepage carousel. The owner can manage advertisement details but cannot upload advertising media.

Profile photos, advertising, team-channel, and member-update images are uploaded directly to Cloudflare R2. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and the HTTPS `R2_PUBLIC_BASE_URL` in `.env`. Configure R2 CORS to allow `PUT` from the production site origin (and `http://localhost:3000` for local development), with the `Content-Type` request header. Profile photos are limited to 5 MB per file, ad media to 100 MB, and communication images to 10 MB.

Signed-in members can open the floating support chat on the homepage. Administrators read and reply to conversations in `/admin/inbox`. Owners and administrators share a private team channel and can publish optional-image updates for signed-in members at `/admin/communications`; members can read the updates at `/updates`.

The homepage chat opens as a full-screen panel with a shared general channel, a private owner–member channel, and the existing support inbox. Owners can privately message members and contact online administrators from `/admin/communications`; admins are considered online after activity within five minutes, and messages sent with no admin online are queued for the next active admin. Administrators can also privately message other admins. Both admin and owner dashboards show donation trend and status charts.

The account sign-in page includes email-code password recovery. Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` sender to deliver the six-digit, ten-minute reset code. The account notification centre shows a delivery notice only; it never exposes the code.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
