# Live Deployment Framework — school by nexxbit.io

This framework provides step-by-step instructions to initialize a local Git repository, link it to GitHub, push the code, and launch it live on Railway with a PostgreSQL database.

---

## 💻 Part 1: Push Local Code to GitHub

Open **terminal (PowerShell or Git Bash)** in your workspace directory (`e:\Google Drive\My Drive\1_Coding\school-nexxbit-v1`) and run the following commands:

### 1. Initialize Git & Add Files
```bash
# Initialize a fresh git repository
git init

# Add all files to the staging area (ensures node_modules is ignored via .gitignore)
git add .

# Create the initial commit
git commit -m "feat: initial release of school by nexxbit.io with pdpa legal files and rate limiting"
```

### 2. Link to a New GitHub Repository
1. Go to [github.com](https://github.com/) and click **New Repository**.
2. Name the repository (e.g., `school-nexxbit`). Keep it **Private** or Public, and **do not** check "Add a README" or ".gitignore" (since they already exist in your workspace).
3. Copy the remote URL (e.g., `https://github.com/your-username/school-nexxbit.git`).
4. Run these commands in your terminal:
```bash
# Rename the default branch to main
git branch -M main

# Link the local repository to your GitHub repo
git remote add origin https://github.com/your-username/school-nexxbit.git

# Push the code to GitHub
git push -u origin main
```

---

## ☁️ Part 2: Deploy to Railway

### 1. Create a New Railway Project
1. Log in to [railway.app](https://railway.app/).
2. Click **New Project** -> Select **Deploy from GitHub repo**.
3. Choose your `school-nexxbit` repository.
4. Click **Deploy Now**.

### 2. Add Managed PostgreSQL Database
1. Inside your Railway project dashboard, click **+ Add** (or **+ New**) -> select **Database** -> select **Add PostgreSQL**.
2. Railway will spin up a fresh PostgreSQL database.
3. Once created, click on the **Postgres** service inside the dashboard, go to the **Variables** tab, and copy the **`DATABASE_URL`** connection string (it looks like `postgresql://johndoe:...`).

### 3. Configure Server Environment Variables
Click on your Node.js application service in Railway, go to the **Variables** tab, and add the following keys:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Sets server to production execution. |
| `PORT` | `8080` | Tell Express which port to bind to. |
| `JWT_SECRET` | *[Your Secret Hash]* | Enter a strong secure string (e.g. `UjangVeelaiSecretToken2026!`). |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Connects your Node server to the PostgreSQL database. |

> [!TIP]
> In Railway, you can simply type `${{Postgres.DATABASE_URL}}` as the value for `DATABASE_URL` to automatically link the database connection details.

---

## ⚡ Part 3: Live Verification Checklist

Once Railway finishes building and deploying the service:
1. Railway will provide a public URL (e.g., `school-nexxbit-production.up.railway.app`). You can link your custom domain (`school.nexxbit.io`) under the service **Settings** tab.
2. The server will detect `DATABASE_URL`, execute the database schema migrations dynamically, and seed the initial users.
3. Test your live login at your Railway URL using:
   * **Username / Email**: `admin` / `mohar.studio@gmail.com`
   * **Password**: `#UjangVeelai00#`
