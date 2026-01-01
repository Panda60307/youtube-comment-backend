import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyze.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200 // 針對舊版瀏覽器或特定雲端負載平衡器
}));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'YouTube Comment Analyzer Backend (Gemini 3 Flash) is running' });
});

// Mount Analyze Routes
app.use('/api', analyzeRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
