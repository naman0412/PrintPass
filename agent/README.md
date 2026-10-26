# PrintPass Desktop Print Agent

Autonomous, zero-click background print worker for Windows photocopy shop terminals.

## Overview
The PrintPass Print Agent runs locally on the shopkeeper's desktop. It periodically polls the PrintPass server for paid jobs in the shop's queue, downloads each job through a 2-minute signed URL, invokes the local Windows printer with the customer's specified print options (duplex, page ranges, copies, orientation, paper size), reports the result, and immediately scrubs the temporary file securely from disk.

The shopkeeper **never downloads, views, or manages files**. Everything prints automatically.

---

## 1. Prerequisites
- **Operating System:** Windows 10/11 (or Windows Server)
- **Node.js:** v20+ or v24+
- A configured Windows printer (USB, Network, or Virtual like "Microsoft Print to PDF")

---

## 2. Installation
```powershell
# Open PowerShell in the /agent directory
cd agent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

---

## 3. Configuration (.env)
Edit `.env` with your shop's credentials:

```ini
# PrintPass Backend URL
SERVER_URL=https://your-printpass-deployment.onrender.com

# Shop Agent Key (Obtain from Shop Settings > Show Agent Key in dashboard)
AGENT_KEY=pp_agent_demo_campus_central_2026

# Printer Name (Leave blank to use Default Windows Printer or find using step below)
PRINTER_NAME=Canon iR2525

# Polling Interval in seconds (default: 5)
POLL_SECONDS=5

# Set to true to test without sending real ink to paper
DRY_RUN=false
```

### Finding your Printer Name in PowerShell
Run:
```powershell
Get-Printer | Select-Object Name
```
Copy the exact name into `PRINTER_NAME`.

---

## 4. Testing with DRY_RUN Mode
Before printing on paper, verify network and agent credentials:
```powershell
# Enable DRY_RUN in .env
DRY_RUN=true

npm start
```
The agent will poll, receive jobs, log exactly what arguments would be sent to the printer, and report success without consuming physical paper.

---

## 5. Running Automatically on Windows Startup
To ensure the Print Agent starts whenever the photocopy computer boots without requiring shopkeeper intervention:

### Method A: Windows Startup Folder (Easiest)
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. In that folder, right-click and create a new Shortcut.
3. Target:
   ```cmd
   cmd.exe /c "cd /d C:\path\to\printpass\agent && npm start"
   ```
4. Click Next, name it `PrintPass Agent`, and Finish.

### Method B: Windows Task Scheduler (Recommended for 24/7 Counter Terminals)
1. Open **Task Scheduler** (`taskschd.msc`).
2. Click **Create Task** (not Basic Task).
3. Under **General**:
   - Name: `PrintPass Print Agent`
   - Check `Run with highest privileges`
   - Select `Run whether user is logged on or not` (optional)
4. Under **Triggers**:
   - New Trigger > **At log on** or **At startup**.
5. Under **Actions**:
   - Action: `Start a program`
   - Program/script: `node.exe`
   - Add arguments: `src/agent.js`
   - Start in: `C:\path\to\printpass\agent`
6. Under **Conditions**:
   - Uncheck `Start the task only if the computer is on AC power`.
7. Click **OK**.

---

## 6. Security & Privacy Guarantees
1. **Zero Document Retention:** Every document downloaded is processed in RAM and temporary storage, then securely overwritten with zero bytes and unlinked immediately after printing.
2. **2-Minute Time-To-Live:** Document download links expire after 120 seconds.
3. **Signed Heartbeat:** Protects queue access against tampering and provides live "Online/Offline" indicator on the counter dashboard.
