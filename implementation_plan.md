# Implementation Plan — Live Deployment to GitHub & Railway

This plan outlines the steps required to push **school by nexxbit.io** online from your local Google Drive folder.

---

## ⚡ Proposed Steps

### Step 1: Initialize Git and Create Local Commit
Run the following commands in your terminal inside `e:\Google Drive\My Drive\1_Coding\school-nexxbit-v1`:
```bash
# 1. Initialize local Git repository
git init

# 2. Add all project files (node_modules is excluded by .gitignore)
git add .

# 3. Create the initial release commit
git commit -m "feat: release version 1.0.0 with PDPA legal files, signup safety, and rate-limiting"
```

---

### Step 2: Push code to GitHub
1. Open [github.com](https://github.com/) and click **New Repository**.
2. Set the repository name to `school-nexxbit` and make it **Private**.
3. **Important**: Do NOT check "Add a README" or ".gitignore" options.
4. Run these terminal commands to link and push your code:
```bash
# Rename default branch to main
git branch -M main

# Link local git repository to GitHub
git remote add origin https://github.com/your-username/school-nexxbit.git

# Push the main branch to GitHub
git push -u origin main
```

---

### Step 3: Spin up Node.js Container & Database on Railway
1. Log in to [railway.app](https://railway.app/).
2. Click **New Project** -> Select **Deploy from GitHub repo** -> Choose your `school-nexxbit` repository.
3. Click **Deploy Now**.
4. In the Railway dashboard, click **+ Add** -> **Database** -> **Add PostgreSQL**.

---

### Step 4: Configure Production Environment Variables
Click on your Node.js application service in Railway, go to the **Variables** tab, and add the following keys:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Sets server execution to production. |
| `PORT` | `8080` | Port Express binds to. |
| `JWT_SECRET` | `UjangVeelaiSecretToken2026!` | Enforces secure signature validation on tokens. |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Connects your Node server to the live PostgreSQL instance. |

---

## 🧪 Verification Plan

### Automated Checks
* Once deployed, verify that the Railway public URL displays the login card correctly.
* Verify that the database schema is automatically created by checking tables via the Admin Database Explorer.

### Manual Testing
* Register a new student and parent account at the live URL.
* Check that **Terms of Service** and **Privacy Policy** documents load correctly and the Back to Portal button returns to the home page.
