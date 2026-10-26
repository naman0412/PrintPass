const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');
const { sendHeartbeat, fetchNextJob, downloadFile, reportJobResult } = require('./api');
const { buildPrintArgs, printPdf, secureDeleteFile } = require('./printer');
const { splitPdfByColor } = require('./splitter');

let isRunning = true;
let backoffDelay = 1000;
const MAX_BACKOFF = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runAgentCycle = async () => {
  const { SERVER_URL, AGENT_KEY, PRINTER_NAME, DRY_RUN } = config;

  if (!AGENT_KEY) {
    console.error('[Agent Error] AGENT_KEY is not defined in environment! Set AGENT_KEY in .env');
    await sleep(10000);
    return;
  }

  // 1. Send Heartbeat
  try {
    const hb = await sendHeartbeat(SERVER_URL, AGENT_KEY);
    // Reset backoff on successful server contact
    backoffDelay = 1000;
    if (hb.shopName) {
      // Periodic log or silent heartbeat
    }
  } catch (hbErr) {
    console.warn(`[Agent Heartbeat Failed] ${hbErr.message}. Backing off for ${backoffDelay / 1000}s`);
    await sleep(backoffDelay);
    backoffDelay = Math.min(MAX_BACKOFF, backoffDelay * 2);
    return;
  }

  // 2. Fetch Next Job
  let nextJobData;
  try {
    nextJobData = await fetchNextJob(SERVER_URL, AGENT_KEY);
  } catch (fetchErr) {
    console.warn(`[Agent Fetch Error] ${fetchErr.message}`);
    return;
  }

  if (!nextJobData.job) {
    // Queue is empty, wait normal poll interval
    return;
  }

  const { job, downloadUrl } = nextJobData;
  console.log(`\n========================================`);
  console.log(`[Job Found] ID: ${job.id}`);
  console.log(`[File] ${job.originalFilename} (${job.pageCount} pages)`);
  console.log(`[Options] Color: ${job.options.color}, Duplex: ${job.options.duplex}, Copies: ${job.options.copies}`);
  console.log(`[Mode] DRY_RUN = ${DRY_RUN}`);

  // Create temporary directory for download
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-agent-'));
  const tempFilePath = path.join(tempDir, `job_${job.id}.pdf`);

  try {
    // 3. Mark PRINTING on server
    await reportJobResult(SERVER_URL, AGENT_KEY, job.id, 'PRINTING');

    // 4. Download file using 2-minute signed URL
    console.log(`[Downloading] Fetching document from server...`);
    await downloadFile(SERVER_URL, downloadUrl, tempFilePath, AGENT_KEY);
    console.log(`[Downloaded] File saved temporarily for printing.`);

    // 5. Check if mixed color/BW printing is required
    const printTasks = await splitPdfByColor(tempFilePath, job.options);

    console.log(`[Printing] Executing ${printTasks.length} print task(s)...`);

    for (const task of printTasks) {
      const taskOptions = {
        ...job.options,
        monochrome: task.monochrome
      };

      const printArgs = buildPrintArgs(taskOptions, PRINTER_NAME);
      await printPdf(task.filePath, printArgs, DRY_RUN);

      // Clean up split sub-file if it was created
      if (task.isSplit && task.filePath !== tempFilePath) {
        secureDeleteFile(task.filePath);
      }
    }

    // 6. Report SUCCESS / PRINTED
    await reportJobResult(SERVER_URL, AGENT_KEY, job.id, 'PRINTED');
    console.log(`[Success] Job ${job.id} printed and reported to server.`);
  } catch (err) {
    console.error(`[Print Error] Failed processing job ${job.id}:`, err.message);
    try {
      await reportJobResult(SERVER_URL, AGENT_KEY, job.id, 'FAILED', err.message);
    } catch (repErr) {
      console.error(`[Report Error] Failed to report failure:`, repErr.message);
    }
  } finally {
    // 7. CRITICAL PRIVACY: Securely delete the temporary file and remove temp folder
    console.log(`[Privacy] Securely scrubbing temporary files from disk...`);
    secureDeleteFile(tempFilePath);
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore
    }
    console.log(`[Privacy] Local document completely removed.\n========================================`);
  }
};

const startAgent = async () => {
  console.log(`\n========================================`);
  console.log(`     PrintPass Autonomous Print Agent    `);
  console.log(`========================================`);
  console.log(`Server URL:   ${config.SERVER_URL}`);
  console.log(`Printer:      ${config.PRINTER_NAME || '(Default System Printer / Dry Run)'}`);
  console.log(`Poll Rate:    Every ${config.POLL_SECONDS}s`);
  console.log(`DRY_RUN Mode: ${config.DRY_RUN ? 'ENABLED (Safe emulation)' : 'DISABLED (Real hardware)'}`);
  console.log(`========================================\n`);

  while (isRunning) {
    try {
      await runAgentCycle();
    } catch (err) {
      console.error('[Agent Unexpected Loop Error]', err.message);
    }
    await sleep(config.POLL_SECONDS * 1000);
  }
};

if (require.main === module) {
  startAgent();
}

module.exports = {
  runAgentCycle,
  startAgent
};
