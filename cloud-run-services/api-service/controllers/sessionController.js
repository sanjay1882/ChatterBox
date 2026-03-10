import ChatSession from "../models/ChatSession.js";

export const getSessions = async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const totalSessions = await ChatSession.countDocuments({
            email: req.params.email,
            isDeleted: false,
            isTemporary: { $ne: true }
        });

        const sessions = await ChatSession.find({
            email: req.params.email,
            isDeleted: false,
            isTemporary: { $ne: true }
        })
            .select("title updatedAt isWebSearchEnabled")
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            sessions,
            currentPage: page,
            totalPages: Math.ceil(totalSessions / limit),
            totalSessions,
            hasNextPage: page * limit < totalSessions
        });
    } catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ error: "Failed to fetch sessions", details: error.message });
    }
};

export const getSessionById = async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (error) {
        console.error("Error fetching session:", error);
        res.status(500).json({ error: "Failed to fetch session", details: error.message });
    }
};

export const softDeleteSession = async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const session = await ChatSession.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json({ message: "Session deleted successfully" });
    } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({ error: "Failed to delete session" });
    }
};

export const getPublicSession = async (req, res) => {
    try {
        const session = await ChatSession.findById(req.params.id);
        if (!session || !session.isShared || session.isDeleted) {
            return res.status(404).json({ error: "Shared session not found" });
        }
        res.json(session);
    } catch (error) {
        console.error("Error fetching public session:", error);
        res.status(500).json({ error: "Failed to fetch session" });
    }
};

export const toggleShareSession = async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });

        session.isShared = !session.isShared;
        await session.save();

        res.json({ isShared: session.isShared, shareUrl: `/share=${session._id}` });
    } catch (error) {
        console.error("Error sharing session:", error);
        res.status(500).json({ error: "Failed to share session" });
    }
};
