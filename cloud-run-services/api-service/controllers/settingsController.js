import UserPreferences from "../models/UserPreferences.js";

export const updateTheme = async (req, res) => {
    try {
        const { theme } = req.body;
        const email = req.user.email;
        if (!theme) return res.status(400).json({ error: "Theme required" });

        const prefs = await UserPreferences.findOneAndUpdate(
            { email },
            { $set: { theme } },
            { new: true, upsert: true }
        );
        res.json({ success: true, theme: prefs.theme });
    } catch (error) {
        res.status(500).json({ error: "Failed to update theme" });
    }
};

export const updateVoice = async (req, res) => {
    try {
        const { voiceEnabled, voice } = req.body;
        const email = req.user.email;
        
        const updates = {};
        if (voiceEnabled !== undefined) updates.voiceEnabled = voiceEnabled;
        if (voice !== undefined) updates.voice = voice;

        const prefs = await UserPreferences.findOneAndUpdate(
            { email },
            { $set: updates },
            { new: true, upsert: true }
        );
        res.json({ success: true, voiceEnabled: prefs.voiceEnabled, voice: prefs.voice });
    } catch (error) {
        res.status(500).json({ error: "Failed to update voice settings" });
    }
};

export const updateModel = async (req, res) => {
    try {
        const { defaultModel } = req.body;
        const email = req.user.email;
        if (!defaultModel) return res.status(400).json({ error: "Model required" });

        const prefs = await UserPreferences.findOneAndUpdate(
            { email },
            { $set: { defaultModel } },
            { new: true, upsert: true }
        );
        res.json({ success: true, defaultModel: prefs.defaultModel });
    } catch (error) {
        res.status(500).json({ error: "Failed to update model settings" });
    }
};
