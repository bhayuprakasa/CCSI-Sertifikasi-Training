const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/employees', require('./routes/employees'));
app.use('/api/competencies', require('./routes/competencies'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/training-needs', require('./routes/training-needs'));
app.use('/api/training-requests', require('./routes/training-requests'));
app.use('/api/training-attendance', require('./routes/training-attendance'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter(n => n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`CCSI Training API running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Network: http://${ip}:${PORT}`));
});
