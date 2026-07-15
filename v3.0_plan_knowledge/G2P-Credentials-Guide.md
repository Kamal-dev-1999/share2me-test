# G2P Credentials & Secrets Setup Guide

To finalize the G2P implementation, you need to provide real credentials for the Database, Cloudflare R2, and Authentication. 

For local development, you should add these to a `.env` file in your `backend/` directory. For production, these must be added to your AWS SSM Parameter Store and ECS Task Definition.

---

## 1. Supabase PostgreSQL
This is where all requests, files, and vendor metadata are stored.

* **Environment Variable:** `DATABASE_URL`
* **File Reference:** `backend/g2p/lib/db.js` (Line 4)
* **How to get it:**
  1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
  2. Create a new project (or open an existing one).
  3. Go to **Project Settings** (gear icon) ➔ **Database**.
  4. Scroll down to **Connection String** ➔ **URI**.
  5. Copy the string. Make sure to replace `[YOUR-PASSWORD]` with the actual database password you set during project creation.
  6. *Example:* `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## 2. Shared JWT Secret
Because Next.js and Express run separately, they both need this exact same secret to sign and verify Vendor logins securely.

* **Environment Variable:** `AUTH_JWT_SECRET`
* **File Reference:** `backend/g2p/lib/auth.js` (Line 4)
* **How to get it:**
  1. Open your terminal and run this command to generate a highly secure random string:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
  2. Copy the output.
  3. **CRITICAL:** You must place this exact same string in **both** the backend and the frontend.
     * **Backend:** `AUTH_JWT_SECRET=your_string_here`
     * **Frontend (Next.js):** `AUTH_SECRET=your_string_here` (This will be used by Auth.js in Phase 2).

---

## 3. Cloudflare R2 (Storage)
This is where the actual files (PDFs, images) are uploaded directly by the students.

### A. Bucket Name
* **Environment Variable:** `R2_BUCKET_NAME`
* **File Reference:** `backend/g2p/lib/storage.js` (Line 4)
* **How to get it:**
  1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) ➔ **R2**.
  2. Click **Create bucket**. Name it something like `share2me-g2p-prod` (or `-dev`).
  3. Use that exact name for the variable.

### B. Account ID
* **Environment Variable:** `R2_ACCOUNT_ID`
* **File Reference:** `backend/g2p/lib/storage.js` (Line 8)
* **How to get it:**
  1. On the main Cloudflare R2 dashboard, look at the right side of the screen.
  2. You will see **Account ID**. Copy this 32-character string.

### C. Access Keys
* **Environment Variables:** `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
* **File Reference:** `backend/g2p/lib/storage.js` (Lines 10 & 11)
* **How to get them:**
  1. On the main Cloudflare R2 dashboard, click **Manage R2 API Tokens** (top right).
  2. Click **Create API token**.
  3. Give it a name (e.g., "Share2Me G2P Backend").
  4. For **Permissions**, select **Object Read & Write**.
  5. Select the specific bucket you created earlier to lock it down securely.
  6. Click **Create API Token**.
  7. Copy the **Access Key ID** and **Secret Access Key**. *(Note: You will only be shown the secret key once!)*

---

## Example `.env` File (`backend/.env`)

```env
# Supabase
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-xxx.pooler.supabase.com:6543/postgres

# Auth
AUTH_JWT_SECRET=a8b3c4d...

# Cloudflare R2
R2_BUCKET_NAME=share2me-g2p-dev
R2_ACCOUNT_ID=abc123xyz...
R2_ACCESS_KEY_ID=def456uvw...
R2_SECRET_ACCESS_KEY=ghi789rst...
```
