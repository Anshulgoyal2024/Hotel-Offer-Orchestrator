
const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check API
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Hotel Offer Orchestrator is running"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
