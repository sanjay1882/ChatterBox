import mongoose from "mongoose";

const UserPreferencesSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    theme: {
        type: String,
        default: 'dark'
    },
    voice: {
        type: String,
        default: ''
    },
    gender: {
        type: String,
        default: ''
    },
    ageGroup: {
        type: String,
        default: ''
    },
    language: {
        type: String,
        default: ''
    },
    culture: {
        type: String,
        default: ''
    },
    defaultModel: {
        type: String,
        default: 'gemini-2.0-flash'
    },
    writingStyle: {
        type: String,
        default: ''
    },
    creativityLevel: {
        type: String,
        default: ''
    },
    interests: {
        type: String,
        default: ''
    },
    customRules: {
        type: String,
        default: ''
    },
    heatwaveMode: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});


UserPreferencesSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const UserPreferences = mongoose.model("UserPreferences", UserPreferencesSchema);

export default UserPreferences;
