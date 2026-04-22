require('dotenv').config();
const express = require('express');
const cors = require('cors');
const otpRoutes = require('./route');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/otp', otpRoutes);

app.get('/', (req, res) => {
    res.send('ICC InnovoApp Backend is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
