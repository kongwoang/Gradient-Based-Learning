# Website setup

The static app is in `docs/`, published by GitHub Pages from `main`.

- Run locally: `npm run preview`.
- Refresh the paper catalog after adding repository papers: `npm run catalog`.
- Run data and sync checks: `npm test`.

Supabase uses `gradient_workspaces`, one private row per user with RLS.
The SQL file records the applied schema; it is only needed for a new project.
`docs/config.js` contains the project URL and public publishable key. Never put a secret key there.

Allow `https://kongwoang.github.io/Gradient-Based-Learning/` in Auth redirect URLs.
Sign in to sync across devices. Guest notes stay in the browser; JSON backups can be imported and notes exported as Markdown. The website does not update `papers/COMMENTS.md` automatically.
