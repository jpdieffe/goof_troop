# Publish Goof Troop Online

Live site: **https://jpdieffe.github.io/goof_troop/**. This repository is already configured to publish through Actions; the steps below also describe how to set up another copy.

The repository includes `.github/workflows/pages.yml`. It builds and publishes only the browser app. The host picks a ROM from their computer; the guest connects to the host's stream.

1. Create a GitHub repository, for example `goof-troop-online`, with `main` as its default branch. On GitHub Free, use a public repository for Pages.
2. Push the application source and `.github/workflows/pages.yml` to it. The existing `.gitignore` excludes ROMs, ZIPs, installed dependencies, test screenshots, and build output. If uploading through GitHub's website instead of Git, **do not upload the ROM, `node_modules`, or `test-results`**; website uploads do not use `.gitignore`.
3. Open the repository's **Settings → Pages**. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Open **Actions → Publish game to GitHub Pages → Run workflow**. Future pushes to `main` publish updates automatically.
5. After deployment, open the site URL shown by the workflow or Pages settings, usually `https://YOUR-USERNAME.github.io/goof-troop-online/`.

On the published site, choose your local `Goof Troop.zip` or `.sfc`, create a room, and use **Copy invite link**. Your friend opens that HTTPS link and joins automatically. Neither player needs to run the `.bat` launcher when using the published site. The host must keep their browser tab open and computer awake.

The site's scripts, worker, styles, and invite URLs use relative paths so they work beneath a repository path. The ROM is loaded locally as a browser Blob, not uploaded to GitHub. Pages hosts the website; the public PeerJS service still handles connection discovery, and WebRTC carries gameplay directly between the players. Restrictive networks may still need a TURN relay in a future update.

Reference: [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
