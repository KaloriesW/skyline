# Final GitHub submission checklist

The integrated app is in [`submission/`](https://github.com/KaloriesW/special-octo-enigma/tree/main/submission) on the **main** branch of [KaloriesW/special-octo-enigma](https://github.com/KaloriesW/special-octo-enigma). The original teammate source remains in `ui/`; run the integrated app from `submission/`.

## Open the final app

```bash
git clone https://github.com/KaloriesW/special-octo-enigma.git
cd special-octo-enigma/submission
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python check_setup.py --inference
python run.py
```

Open http://127.0.0.1:8765/skyline/. The local landslide map is at http://127.0.0.1:8765/terrain/. The teammate also lists a hosted demo in the README; its deployed version must be checked separately. The tested environment is macOS Apple Silicon with Python 3.14.4. See [README](README.md) for optional Qwen setup. No API key is required for manual satellite scans. A new installation has no saved scans or simulated data.

The repository contains the trained U-Net, 22 city air-quality models, setup checks, one-page write-up, recording script and evaluation evidence. It excludes runtime conversations, scan histories, monitoring state, environments and experimental YOLO weights. The retained checkpoint is below GitHub's 100 MiB per-file limit; clone with Git/GitHub Desktop rather than uploading it through the browser.

## Required before submitting

1. **Code access:** verify the repository opens while signed out. The unauthenticated check on 16 November returned HTTP 404. Uploading commits does not change repository visibility. An owner must make this repository public, or publish a reviewed public submission copy; then repeat the signed-out check. Do not submit a private-only link.
2. **Track:** Climate.
3. **Write-up:** upload [one-page-writeup.pdf](one-page-writeup.pdf), or provide the public README. Only one write-up format is required.
4. **Credits:** include/link [CREDITS.md](CREDITS.md).
5. **Team:** enter every contributing teammate's full name, email and school accurately in the form.
6. **Optional video:** record the [two-minute script](two-minute-demo-script.txt), upload to unlisted YouTube or viewable-by-link Drive, and test access while signed out. A script is not a recorded video; no recording link is bundled.
7. Submit through the [official form linked here](https://highschoolhackathon.org/briefs). A GitHub push alone does not submit the project to the hackathon.

Deadline: **Monday 16 November 2026 at 12:59 PM Asia/Taipei** (Sunday 15 November at 11:59 PM Eastern Time). Aim to submit early. The organizer permits resubmission before the deadline and judges the latest version.

The team confirmed that the teammate's Skyline contribution was built during this hackathon. Review the organizer's timing and contribution rules and ensure the final form accurately describes the team's work.

## Final checks

Use [evidence/final-readiness.json](evidence/final-readiness.json) for the latest audit and [MODEL_CARD.md](MODEL_CARD.md) for results and limitations. Automated checks establish application behavior and reproducibility of the bundled smoke sample, not independent live landslide accuracy. Monitoring stays off until a user selects an area and enables it.

Sources: [organizer requirements](https://highschoolhackathon.org/briefs); [GitHub file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
