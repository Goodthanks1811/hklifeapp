# HK Life — Chrome Extension

Bold red/black popup showing your Notion Life tasks with quick-add.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (MV3) |
| `popup.html` | Popup shell |
| `popup.css` | All styles + animations |
| `popup.js` | Notion API calls + all logic |
| `icons/` | icon16.png, icon48.png, icon128.png (add your own) |

## Install (local dev)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `chrome-extension/` folder
4. Click the HK icon in the toolbar
5. Open Settings (⚙) → paste your Notion API key → Save

## Notion API Key

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create an integration → copy the `secret_xxx` key
3. **Important**: make sure the integration is connected to your Life database
   (open the database in Notion → ··· menu → Add connections → your integration)

## Icons

Drop three PNG files into `chrome-extension/icons/`:
- `icon16.png` — 16×16
- `icon48.png` — 48×48  
- `icon128.png` — 128×128
