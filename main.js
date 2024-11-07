import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import Base64 from 'base64-js';
import MarkdownIt from 'markdown-it';
import { maybeShowApiKeyBanner } from './gemini-api-banner';
import './style.css';

let API_KEY = process.env.API_KEY
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
    let imageUrl = form.elements.namedItem('chosen-image').value;
    let contents;
    let imagePreviewHTML = '';

    if (imageUrl) {
      const imageBase64 = await fetch(imageUrl)
        .then(r => r.arrayBuffer())
        .then(a => Base64.fromByteArray(new Uint8Array(a)));

      contents = [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: promptText }
          ]
        }
      ];

      imagePreviewHTML = `<img src="${imageUrl}" alt="Selected Image" style="width: 50px; height: 50px; margin-right: 8px;">`;
    } else {
      contents = [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ];
    }

    // Add user's prompt to chat history
    chatHistory.push({ type: 'user', content: promptText, image: imagePreviewHTML });

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

    // Display the entire chat history
    output.innerHTML = chatHistory
      .map(entry => {
        if (entry.type === 'user') {
          return `<p><strong>You:</strong> ${entry.image || ''} ${entry.content}</p>`;
        } else {
          return `<p><strong>AI:</strong> ${entry.content}</p>`;
        }
      })
      .join('<hr>');

    promptInput.value = ""; // Clear input after submission
  } catch (e) {
    output.innerHTML += `<hr><span style="color:red;">Error: ${e.message || e}</span>`;
  }
};

// Display API key reminder (if necessary)
maybeShowApiKeyBanner(API_KEY);
