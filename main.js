import { GoogleGenerativeAI } from "@google/generative-ai";
import Base64 from 'base64-js';
import MarkdownIt from 'markdown-it';
import { maybeShowApiKeyBanner } from './gemini-api-banner';
import './style.css';
import { RiRobot2Line } from "react-icons/ri";

let API_KEY = import.meta.env.VITE_API_KEY || 'EMPTY';

let form = document.querySelector('form');
let promptInput = document.querySelector('input[name="prompt"]');
let output = document.querySelector('.output');

// Array to store chat history
let chatHistory = [];

form.onsubmit = async (ev) => {
  ev.preventDefault();
  output.textContent = 'thinking...';

  try {
    const promptText = promptInput.value;
    let imageUrl = form.elements.namedItem('chosen-image').value;  // This will be the value of the selected image URL

    let contents;
    let imagePreviewHTML = '';

    // Check if an image is selected (either via the predefined images or uploaded custom image)
    if (imageUrl) {
      // If image is selected, fetch and encode the image
      const imageBase64 = await fetch(imageUrl)
        .then(r => r.arrayBuffer())
        .then(a => Base64.fromByteArray(new Uint8Array(a)));

      // If both text and image are provided, send both
      contents = [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            {
               text: promptText || ''
             }
          ]
        }
      ];

      imagePreviewHTML = `<img src="${imageUrl}" alt="Selected Image" style="width: 50px; height: 50px; margin-right: 8px; float:right;">`;

      // Add user's prompt (with or without image) to chat history
      chatHistory.push({ type: 'user', content: promptText, image: imagePreviewHTML });
    } else {
      // If no image is selected, just send the text prompt
      contents = [
        {
          role: 'user',
          parts: [
            { text: promptText }
          ]
        }
      ];

      // Add user's prompt (without image) to chat history
      chatHistory.push({ type: 'user', content: promptText, image: '' });
    }

    // Generate response from model
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    const result = await model.generateContentStream({ contents });

    let buffer = [];
    let md = new MarkdownIt();
    for await (let response of result.stream) {
      buffer.push(response.text());
    }

    const modelResponse = md.render(buffer.join(''));

    // Add model's response to chat history
    chatHistory.push({ type: 'model', content: modelResponse });

    // Display the entire chat history as Q&A pairs in individual boxes
    output.innerHTML = chatHistory
      .map((entry, index) => {
        if (entry.type === 'user') {
          const nextEntry = chatHistory[index + 1]; // Get the AI response
          if (nextEntry && nextEntry.type === 'model') {
            return `
              <div class="qa-box" style="border: 2px solid #007BFF; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                <strong>You:</strong> ${entry?.image ? entry?.image : ''} ${entry.content}
                <hr>
                <strong>AI:</strong> ${nextEntry.content}
              </div>
            `;
          }
        }
      })
      .join(''); // Join all the generated Q&A pairs into one string

    promptInput.value = ""; // Clear input after submission
  } catch (e) {
    output.innerHTML += `<hr><span style="color:red;">Error: ${e.message || e}</span>`;
  }
};

// Display API key reminder (if necessary)
maybeShowApiKeyBanner(API_KEY);