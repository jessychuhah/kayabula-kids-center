# Kayabula Kids Centre

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set both Supabase URLs: `DATABASE_URL` to the transaction-mode pooler (port `6543`) for app queries, and `DIRECT_URL` to the session-mode pooler (port `5432`) for Prisma migrations. URL-encode special characters in the database password (for example, `@` as `%40`).
3. Set `ADMIN_SETUP_TOKEN` to a long, random secret. Keep it private; it can only be used to create the first administrator.
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

Create a regular account at `/account` to save a name, email and phone number for checkout. Guests can still donate without an account. To activate the administrator dashboard, create the first account with the configured administrator setup token; later attempts to use that token are rejected.

The `/admin` page requires an administrator session and displays persisted donation records. Payment checkout remains unavailable until the Pesapal credentials and callback settings in `.env` are configured.

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
