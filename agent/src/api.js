const axios = require('axios');
const fs = require('fs');

/**
 * Sends heartbeat ping to server
 */
const sendHeartbeat = async (serverUrl, agentKey) => {
  const res = await axios.post(
    `${serverUrl}/api/agent/heartbeat`,
    {},
    {
      headers: { 'x-agent-key': agentKey },
      timeout: 10000
    }
  );
  return res.data;
};

/**
 * Fetches the next QUEUED job from the server
 */
const fetchNextJob = async (serverUrl, agentKey) => {
  const res = await axios.get(`${serverUrl}/api/agent/jobs/next`, {
    headers: { 'x-agent-key': agentKey },
    timeout: 10000
  });
  return res.data;
};

/**
 * Downloads document file stream from server to a target local path
 */
const downloadFile = async (serverUrl, downloadUrl, targetFilePath, agentKey) => {
  const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${serverUrl}${downloadUrl}`;
  const response = await axios({
    method: 'GET',
    url: fullUrl,
    headers: { 'x-agent-key': agentKey },
    responseType: 'stream',
    timeout: 30000
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(targetFilePath);
    response.data.pipe(writer);

    writer.on('finish', () => resolve(targetFilePath));
    writer.on('error', (err) => {
      writer.close();
      reject(err);
    });
  });
};

/**
 * Reports job result back to server: 'PRINTING', 'PRINTED', or 'FAILED'
 */
const reportJobResult = async (serverUrl, agentKey, jobId, status, error = null) => {
  const res = await axios.post(
    `${serverUrl}/api/agent/jobs/${jobId}/result`,
    { status, error },
    {
      headers: { 'x-agent-key': agentKey },
      timeout: 10000
    }
  );
  return res.data;
};

module.exports = {
  sendHeartbeat,
  fetchNextJob,
  downloadFile,
  reportJobResult
};
