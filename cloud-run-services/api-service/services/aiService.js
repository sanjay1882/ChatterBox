import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { Groq } from 'groq-sdk';
import dotenv from "dotenv";

dotenv.config();

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy_key" });
