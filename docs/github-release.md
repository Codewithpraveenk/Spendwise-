# Prepare SpendWise for GitHub

Brevo configuration is deferred by user choice. This step prepares source control and automated checks; it does not publish the app or configure live email. Local SMTP configuration remains untouched.

## What was added

`.github/workflows/release-checks.yml` installs both dependency sets on Node 24, runs the release checks with disposable databases and builds the container. It runs on pushes, pull requests and manual dispatch. It uses read-only repository permissions and needs no Atlas, Google or email secrets. No deployment runs automatically.

This workflow has not run on GitHub yet. Local release checks passed in the previous phase; the container build still needs Docker or the first GitHub Actions run.

## 1. Create an empty repository

Sign in to GitHub and create an empty repository named `spendwise`. Start private while reviewing the project. Do not initialize a README, license or gitignore because the local project already contains source files. Copy the repository HTTPS URL.

## 2. Initialize locally from VS Code

Open `C:\Users\Praveen\Documents\Spendwise` as the VS Code folder. In its terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
git init -b main
git check-ignore server/.env server/production.env node_modules dist .release-check.log
git add .
git diff --cached --name-only
```

Check the staged list before committing. It must not include real env files, private keys, dependencies, generated builds, personal backups or logs. Example env files contain placeholders and should be included. Gitignore prevents new matching files from being added; it does not remove files previously tracked in another repository.

If a private env file is staged, unstage it with `git rm --cached -- server/.env` and inspect again. Never paste private configuration into a README or terminal output shared in chat. Replace previously exposed credentials before public deployment; deleting a secret from the latest file does not remove it from Git history.

After reviewing the staged files:

```powershell
git commit -m "Build SpendWise finance manager"
git remote add origin YOUR_REPOSITORY_HTTPS_URL
git push -u origin main
```

Replace YOUR_REPOSITORY_HTTPS_URL with the real URL. Authenticate through GitHub's browser/credential-manager flow; do not paste a token in chat or put it in the URL. If Git asks for your identity, set your own name and email for this repository before committing.

## 3. Check Actions

Open the repository's Actions tab and inspect Release checks. Wait for both tests/build and the container build to pass. If Actions is disabled, enable it using the repository's settings. Do not interpret a local green check as proof the Linux workflow passed.

## 4. Deployment after this step

The free Render blueprint currently requires Brevo credentials. Since email setup is deferred, it is not ready for a complete public deployment. We can finish repository/CI work without those credentials. Before deployment, configure email or explicitly design a limited email-disabled preview with truthful UI; do not supply dummy secrets to bypass startup checks.

Then follow `docs/deployment.md`: connect the repository to hosting, configure real private variables, Google origins and Atlas access, and test the public HTTPS app. Email verification, account/session controls, monitoring, backup restore and production acceptance checks remain outstanding.
