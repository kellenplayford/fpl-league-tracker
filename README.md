# FPL League Tracker

Tracks two Fantasy Premier League classic leagues:

- Sexy Pickford — league ID `37546`
- The Battle Continues — league ID `118082`

The site stores one official snapshot per calendar day at approximately **23:30 UK time** and keeps historical manager data including league position, FPL points, overall rank, captain, squad, chip, transfers, team value, and bank where the public FPL API exposes it.

## Day 1

21 August 2026 is seeded as a confirmed historical leader record:

- Sexy Pickford: Kellen Playford / Jogo Bonito — 29 points
- The Battle Continues: Kellen Playford / Jogo Bonito — 29 points

Only the Day 1 leader is treated as historically certain. A full 23:30 league snapshot was not archived that evening.

## First-time setup

1. Upload **all files and folders in this package** to the root of the GitHub repository.
2. Open the repository on GitHub.
3. Go to **Actions**.
4. Open **Collect FPL snapshot**.
5. Choose **Run workflow** and leave the mode as `test`.
6. Wait for a green tick.
7. Open `data/test/latest-test.json`. If it contains both leagues and their managers, the collection pipeline is working.
8. Run the workflow again with mode `official` if you want to save a live snapshot immediately. Otherwise the first official automatic snapshot is scheduled for 23:30 UK time.
9. Go to **Settings → Pages**.
10. Under **Build and deployment**, choose **Deploy from a branch**.
11. Branch: `main`, folder: `/ (root)`, then Save.

GitHub will provide the public Pages address after deployment.

## Automation

GitHub Actions cron uses UTC. The workflow runs at both 22:30 and 23:30 UTC, while the Python collector checks Europe/London local time and only creates an official snapshot during the UK 23:00 hour. This handles BST/GMT changes without manual intervention.

## Data captured per manager

- Manager name
- Team name
- FPL entry ID
- League position
- Previous league position
- Gameweek points
- Total points
- Overall rank
- Gameweek rank
- Points on bench
- Transfers
- Transfer cost / hits
- Team value
- Bank
- Active chip
- Captain
- Vice-captain
- Automatic substitutions
- Full 15-player squad
- Individual live player points

The raw daily JSON snapshots are deliberately retained so more statistics can be derived later without changing the collection process.
