// server.js
// Simple Express server to serve the HTML form and handle Oura data fetch requests

const express = require('express');
const path = require('path');
const { fetchAndSaveOuraData } = require('./oura_data_service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/fetch', async (req, res) => {
  const { token, start, end } = req.body;
  if (!token || !start || !end) {
    return res.json({ success: false, error: 'Missing required fields.' });
  }
  try {
    await fetchAndSaveOuraData({ token, startDate: start, endDate: end });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oura Data Fetcher server running at http://localhost:${PORT}`);
});
