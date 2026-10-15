# Community Store

A community marketplace built with React, Vite, and Supabase. Authentication, product data, wishlists, carts, orders, community posts, and listing photos use Supabase-hosted services; no local database installation or custom API server is needed.

## 1. Create and configure Supabase

1. Create a project in the Supabase dashboard.
2. In **Project Settings → API**, copy the Project URL and the publishable/anon key.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are browser-side project values; never put a service-role key in this app.
4. In **Authentication → Providers → Email**, enable email sign-in. To allow immediate local sign-in, disable email confirmation while testing; for a deployed app, configure Supabase email confirmation and SMTP.
5. Use **Table Editor → Create a new table** to add the tables below. Enable Row Level Security on each table.
6. In **Storage**, create a public bucket named `product-images`, allow JPG, PNG, WEBP, and GIF, and set the file-size limit to 5 MB.
7. Create the policies described below using the Supabase policy builder. Do not disable Row Level Security.
8. Import `supabase/starter-products.csv` into the `products` table using **Table Editor → Import data from CSV**. Do not add the optional `id`, `owner_id`, or `created_at` columns to the CSV import; their database defaults apply.

### Tables

Create each table with the listed columns. Mark `id` as the primary key and set its default to `gen_random_uuid()`; set timestamp defaults to `now()`. Use the Table Editor relationship picker for the foreign keys.

- **products**: `id` uuid; `title` text; `category` text; `price` numeric; `old_price` numeric nullable; `condition` text; `location` text; `seller` text; `initials` text; `rating` numeric default `5`; `reviews` integer default `0`; `image` text; `badge` text nullable; `description` text; `owner_id` uuid nullable, references `auth.users.id` with delete behavior `SET NULL`; `status` text default `active`; `created_at` timestamptz default `now()`.
- **wishlist_items**: `user_id` uuid references `auth.users.id`; `product_id` uuid references `products.id`; `created_at` timestamptz default `now()`. Use `(user_id, product_id)` as a composite primary key.
- **cart_items**: `user_id` uuid references `auth.users.id`; `product_id` uuid references `products.id`; `quantity` integer; `created_at` timestamptz default `now()`. Use `(user_id, product_id)` as a composite primary key.
- **community_posts**: `id` uuid; `title` text; `category` text; `body` text; `author` text; `owner_id` uuid references `auth.users.id`; `created_at` timestamptz default `now()`.
- **orders**: `id` uuid; `buyer_id` uuid references `auth.users.id`; `total` numeric; `status` text; `collection_option` text; `note` text; `items` jsonb; `created_at` timestamptz default `now()`.

Set required text/number fields to **NOT NULL**, except the nullable fields specifically marked above. Set `status` on products to `active`, and set `status` on orders to `Awaiting collection`. Set `orders.items` to an empty JSON array (`[]`) by default if the Table Editor offers a default-value field.

### Row Level Security policies

Add policies using the Supabase policy builder. These expressions are policy conditions, not a SQL setup script.

- **products**: allow `SELECT` to `anon` and `authenticated` when `status = 'active' OR auth.uid() = owner_id` so owners can also see their sold listings. Allow `INSERT` to `authenticated` when `auth.uid() = owner_id`. Allow `UPDATE` and `DELETE` to `authenticated` only when `auth.uid() = owner_id`.
- **wishlist_items** and **cart_items**: allow authenticated users to `SELECT`, `INSERT`, `UPDATE`, and `DELETE` only their own rows, with `auth.uid() = user_id` as the policy condition (and as the check condition for inserts/updates).
- **community_posts**: allow `SELECT` to `anon` and `authenticated`. Allow `INSERT` to `authenticated` only when `auth.uid() = owner_id`.
- **orders**: allow authenticated users to `SELECT` and `INSERT` only their own orders, with `auth.uid() = buyer_id` as the policy condition (and as the check condition for inserts).
- **Storage → product-images**: allow public `SELECT`. Allow authenticated `INSERT` and `DELETE` only when the first folder in the object path equals the signed-in user's ID. The app stores each upload under a folder named for that user's ID.

For the supplied sample listings, leave `owner_id` empty. To grant administrator dashboard access, promote a trusted user's `role` in **Authentication → Users → select the user → Edit user → App Metadata** by setting `role` to `Administrator`. Never allow public users to assign themselves that role.

## 2. Run the app

In PowerShell, from this project folder:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` with your Supabase Project URL and publishable/anon key, then start Vite:

```powershell
npm run dev
```

Open the local URL printed by Vite. Supabase services are hosted, so there is no local database or API process to start.

## Notes

- Listing image uploads are stored in the `product-images` bucket. Product cards display their public Storage URLs.
- The Supabase publishable/anon key is intended for browser use; security depends on correctly enabled Row Level Security and Storage policies.
- Online payments are not connected. Checkout saves an order, and the buyer arranges collection/payment with the seller.
