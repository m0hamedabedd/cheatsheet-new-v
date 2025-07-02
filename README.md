# AI Cheatsheet Generator

This application leverages the Gemini AI to transform your lecture notes or documents into concise, well-structured, and visually appealing HTML cheat sheets. It's designed to help students and educators quickly create study aids.

## Features

*   **AI-Powered Summarization:** Upload `.txt`, `.md`, or `.pdf` files, and the AI will generate a summarized HTML cheat sheet.
*   **Structured & Readable Output:** The generated cheat sheets are designed for optimal readability, featuring:
    *   Logical sections with unique background colors.
    *   Clear headings, subheadings, and bullet points.
    *   Integration of icons, emojis, and simple diagrams.
    *   Support for LaTeX-style mathematical equations via MathJax.
*   **Dark Mode Toggle:** Switch between light and dark themes for comfortable viewing.
*   **HTML Output:** Generates a self-contained HTML file that can be viewed directly in any web browser.

## Run Locally

**Prerequisites:**
*   Node.js (LTS version recommended)
*   npm (Node Package Manager)

**Steps:**

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <repository_url>
    cd ai-cheatsheet-generator
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set your Gemini API Key:**
    Create a `.env.local` file in the root directory of the project (if it doesn't exist) and add your Gemini API key:
    ```
    VITE_GEMINI_API_KEY='YOUR_GEMINI_API_KEY'
    ```
    Replace `YOUR_GEMINI_API_KEY` with your actual key.
4.  **Run the application:**
    ```bash
    npm run dev
    ```
    This will start a development server, and you can access the application in your web browser (usually at `http://localhost:5173`).

## Technologies Used

*   **Frontend:** HTML, CSS (Tailwind CSS), TypeScript
*   **Framework:** Vite
*   **AI Integration:** Google Gemini API
*   **Libraries:**
    *   `@google/genai`
    *   `MathJax` (for rendering equations)

## Contact

For feedback or suggestions, please contact m0hamedabedd52@gmail.com.