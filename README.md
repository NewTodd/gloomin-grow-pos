# Gloomin Grow POS

Private salon POS system for nail salon service tickets, employee queue, checkout, Square Terminal payments, gift cards, owner reports, payroll tracking, backups, and audit records.

## Important

This repo is private and proprietary. Do not copy, sell, share, or reuse this software without written permission.

Never upload `.env`. It contains private Square payment settings.

## Main Files

- `index.html` - POS page
- `style.css` - POS design
- `script.js` - POS app logic and local records
- `square-bridge.js` - local Square Terminal bridge
- `start-square-bridge.ps1` - Square setup/start helper
- `SETUP-SQUARE-FOR-SALONS.md` - salon setup guide
- `square-settings-example.txt` - safe example settings

## Run The POS

1. Open this folder in VS Code.
2. Start Live Server for `index.html`.
3. Open the POS at `http://127.0.0.1:5500/index.html`.
4. For Square Terminal, start the bridge:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-square-bridge.ps1
```

## Square Settings

The Square bridge needs a local `.env` file. Do not commit or share it.

Use `square-settings-example.txt` as the safe example for team setup.

## Owner Records

Inside the POS:

- `Owner > Backup Records` exports all saved POS records.
- `Owner > Audit Log` shows and exports the action history.
- `Closed Ticket` shows paid and voided tickets.
- `Owner` reports support today, month, year, last year, and all-time ranges.

## Team Workflow

Use branches for changes:

- `feature/...` for new features
- `fix/...` for bugs
- `test/...` for testing experiments

Open a Pull Request before merging into `main`.

## License

This project is proprietary. All rights reserved. See `LICENSE.txt`.
