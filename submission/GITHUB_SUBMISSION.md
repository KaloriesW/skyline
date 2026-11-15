# GitHub and hackathon submission

## What is prepared

`skyline-terrain/` is the final, self-contained repository folder. Use that folder's **contents as the repository root**. It includes the app, tested U-Net, the one-page PDF, demo script, credits and evaluation evidence. It does not include local chats, caches, API secrets, monitoring state or the large experimental YOLO weights.

No GitHub repository has been created or pushed by this preparation step. The existing teammate repository is `https://github.com/KaloriesW/special-octo-enigma`; its current remote contents/access were not authenticated. Do not claim that an older remote copy contains this release.

## Upload with GitHub Desktop (simplest)

1. Open GitHub Desktop and choose **File → Add Local Repository**; select the `skyline-terrain` folder. If it is not a repository, use the offered create-repository option for this folder.
2. Review the included files, create the initial commit and **Publish repository**. Make it public so judges can access it. Choose the final repository name with your team.
3. If updating your friend's existing repository, use its actual local Git checkout and merge this folder on a branch. Do not overwrite newer teammate work. The bundled `skyline/` snapshot is intentionally used so the tested version stays consistent.
4. Open the published repository while signed out. Confirm README, PDF, credits, `models/unet13.pt` are visible.

GitHub's browser uploader has a 25 MiB file limit. Our checkpoint is approximately 93.48 MiB, below Git's 100 MiB hard limit but above the browser limit. Use **GitHub Desktop or Git CLI**, not a browser drag-and-drop of the checkpoint or ZIP. A Git large-file warning above 50 MiB is expected; no file in this prepared repository exceeds 100 MiB. Do not add virtual environments or the ZIP to the repository.

## Git CLI alternative

Run from the prepared `skyline-terrain/` directory. Create an EMPTY public GitHub repository first (no generated README or license), copy its HTTPS remote URL, then:

```bash
git init -b main
git add .
git status --short
git commit -m "Submit Skyline Terrain Watch hackathon project"
git remote add origin YOUR_PUBLIC_REPOSITORY_HTTPS_URL
git push -u origin main
```

Replace the uppercase URL with the actual repository URL; it is not a literal command-ready address. Use your own GitHub authentication. Do not paste a token into repository files. If the remote already contains work, use a branch/merge workflow instead of force-pushing.

## Form checklist

- Track: **Climate**.
- Code link: the public GitHub repository containing this final release.
- Write-up: `one-page-writeup.pdf` (upload directly), or the public README if preferred.
- Credits: `CREDITS.md`, linked from README.
- Team: every teammate's full name, email and school, plus confirmation each contributed. Enter these in the form; no personal details were invented here.
- Optional recommended video: an unlisted YouTube or publicly viewable Drive link, **no more than two minutes**. The prepared script is not a video.
- Verify every shared link in a signed-out/private window.

Deadline: **Monday 16 November 2026, 12:59 PM Asia/Taipei** (Sunday 15 November, 11:59 PM Eastern Time). Aim to submit by 11:30 AM Taipei. The organizer permits resubmission before the deadline and judges the latest version.

Official requirements: https://highschoolhackathon.org/briefs
GitHub file limits: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
