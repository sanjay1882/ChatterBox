// models/Chat.js
import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, unique: true, index: true }, 
  history: [
    {
      date: { type: String, required: true }, 
      sections: [
        {
          sectionId: { type: String, required: true }, 
          chats: [
            {
              role: { type: String, required: true }, 
              text: { type: String, default: "" },
              image: {
                data: String,    
                mimeType: String
              },
              timestamp: { type: Date, default: Date.now }
            }
          ]
        }
      ]
    }
  ]
}, {
  collection: "chat_histories"
});

export default mongoose.model("Chat", chatSchema);
