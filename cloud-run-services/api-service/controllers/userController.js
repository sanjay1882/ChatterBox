import UserPreferences from "../models/UserPreferences.js";
import GeneratedContent from "../models/GeneratedContent.js";

export const getUserPreferences = async (req, res) => {
    try {
        const email = req.params.email;
        if (!email) return res.status(400).json({ error: "Email required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized" });

        let prefs = await UserPreferences.findOne({ email });
        if (!prefs) {
            return res.json({ theme: 'dark' });
        }
        res.json(prefs);
    } catch (error) {
        console.error("Error fetching preferences:", error);
        res.status(500).json({ error: "Failed to fetch preferences" });
    }
};

export const updateUserPreferences = async (req, res) => {
    try {
        const { email, ...updates } = req.body;
        if (!email) return res.status(400).json({ error: "Email required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized" });

        const prefs = await UserPreferences.findOneAndUpdate(
            { email },
            { $set: updates },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json(prefs);
    } catch (error) {
        res.status(500).json({ error: "Failed to save preferences" });
    }
};

export const getUserGallery = async (req, res) => {
    try {
        const email = req.params.email;
        if (!email) return res.status(400).json({ error: "Email required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized" });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const totalImages = await GeneratedContent.countDocuments({ email });
        const images = await GeneratedContent.find({ email })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('prompt imageBase64 createdAt sessionId');

        res.json({
            images,
            currentPage: page,
            totalPages: Math.ceil(totalImages / limit),
            totalImages,
            hasNextPage: page * limit < totalImages
        });
    } catch (error) {
        console.error("Error fetching gallery:", error);
        res.status(500).json({ error: "Failed to fetch gallery" });
    }
};
