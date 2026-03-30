# Zendesk Escalation Rater (Chrome Extension)

## What this extension does

This extension is for **Support Engineers** who work with Zendesk Tickets. It adds a **Rate Escalation** button on ticket pages so you can give quick feedback on how an escalation was handled.

When you submit a rating, the extension sends:

- **Ticket URL** — the Zendesk ticket you are viewing  
- **Rating** — Bad, Okay, or Good  
- **Escalator** — chosen from people who appear in the ticket conversation 
- **Comment** — optional (may require a comment for certain ratings)  
- **SE name** and **Product area** — pulled from the page when the layout allows  

Data is stored in a Google Sheet.

---

## For support engineers — how to install and use (after you download it)

### 1. Download/clone the extension

- Unzip the download if needed. You should have a folder that contains `manifest.json` at the top level (along with `content.js`, `popup.html`, etc.).  
- **Keep this folder** where Chrome can read it (for example your Documents folder). Do not delete it after installing; Chrome loads the extension from this folder.

### 2. Install in Chrome (load unpacked)

1. Open **Google Chrome**.  
2. Go to `chrome://extensions` (paste into the address bar).  
3. Turn **Developer mode** **ON** (top right).  
4. Click **Load unpacked**.  
5. Select the **extension folder** (the one that contains `manifest.json`).  
6. You should see **Zendesk Escalation Rater** in the list with the extension enabled.

### 3. Configure the Apps Script URL (one time)

You should have a **Google Apps Script web app URL** (it usually looks like `https://script.google.com/macros/s/.../exec`).

1. Click the **puzzle icon** in Chrome → **Zendesk Escalation Rater** (pin it if you want quick access).  
2. Paste that URL into **Google Apps Script URL**.  
3. Click **Save Configuration**.  

You can use **Rating history** and **view all ratings** (if enabled by your team’s script) to confirm things are working.

### 4. How to use on Zendesk

1. Open a ticket 
2. When the page loads, find **Rate Escalation** (within the sidebar).  
3. Click it, pick **Bad**, **Okay**, or **Good**, choose an **escalator**, add a **comment** if needed, then **Submit Rating**.  
4. Wait for the success message. The row is written to your team’s Google Sheet.
