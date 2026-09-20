# Getting the kerjo.id source code into your own repository

## What you asked
"Can I get the source code and move it into my own repository?"

## Short answer
Yes. The full source code of your kerjo.id app (frontend, backend, and config) is
yours and can be moved to your own GitHub repository. This is a built‑in platform
capability, not something that needs to be coded or built.

## The two ways to get your code

### Option A — Push to GitHub (recommended)
- Use the **"Save to GitHub" / "Push to GitHub"** action in the top‑right menu of the workspace.
- You connect (authorize) your GitHub account once, choose or create a repository, and
  the entire codebase is pushed there.
- After the first push, you can keep pushing updates to the same repo as you make changes.
- This keeps a normal Git repository you fully own and can clone, branch, and self‑host.

### Option B — Download the code
- The workspace also lets you **download the project** as an archive of all source files,
  which you can then push into any repository (GitHub, GitLab, Bitbucket, self‑hosted Git, etc.).

## What you receive
- The complete Expo (React Native) frontend and Go backend source.
- Configuration files needed to run it yourself.
- Note: environment values (Google OAuth client IDs and database URL)
  are environment configuration. When you run the code elsewhere, you supply your own
  values for these — the code reads them from environment variables.

## Things to decide / be aware of
1. **Where it goes** — a brand‑new empty repo (cleanest) vs. an existing repo.
2. **Public vs. private** — for an app with user data and keys, a **private** repo is recommended.
3. **Running it yourself** — you are responsible for hosting the backend, PostgreSQL,
   uploaded-photo storage, and Google OAuth client IDs.
4. **Cost** — exporting/pushing the code itself does not add app‑store fees. Any hosting
   costs after you move it depend on where you choose to run it.

## No build work required
This request does not require any code changes to the app. It is done through the
workspace's GitHub / download actions. If you hit an issue connecting GitHub or exporting,
consult your Git hosting provider's documentation.

## Assumption
Assuming you want the standard route: push the existing codebase to a new **private**
GitHub repository that you own. If instead you want a download archive or a specific
existing repo, say so.
