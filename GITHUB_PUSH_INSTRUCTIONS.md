# How to Push to GitHub

## Option 1: Personal Access Token (Easiest)

1. **Create a Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name (e.g., "kaimaku-push")
   - Select scopes: Check `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token** (you won't see it again!)

2. **Push using the token:**
   ```bash
   git push -u origin main
   ```
   - When prompted for username: Enter your GitHub username (potverse-hub)
   - When prompted for password: **Paste the token** (not your password!)

## Option 2: GitHub CLI (if installed)

```bash
gh auth login
git push -u origin main
```

## Option 3: Update Git Credentials

If you need to change the account:

```bash
git config --global user.name "potverse-hub"
git config --global user.email "your-email@example.com"
```

Then use Option 1 to push.

## Quick Push Command (after getting token):

```bash
git push -u origin main
```

Enter your GitHub username and the Personal Access Token when prompted.

