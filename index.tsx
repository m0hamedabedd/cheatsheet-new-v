/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';

// New element selectors based on "Stitch Design"
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const selectFileButtonHero = document.getElementById(
  'selectFileButtonHero',
) as HTMLButtonElement;
const buttonText = selectFileButtonHero.querySelector('.button-text') as HTMLSpanElement;
const spinner = selectFileButtonHero.querySelector('.spinner') as HTMLSpanElement;

const userMessageArea = document.getElementById('userMessageArea') as HTMLDivElement;
const fileStatusArea = document.getElementById('fileStatusArea') as HTMLDivElement;
const fileNameDisplay = document.getElementById('fileNameDisplay') as HTMLSpanElement;
const clearFileButton = document.getElementById('clearFileButton') as HTMLButtonElement;





const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY});

let generatedHtmlContent: string | null = null;

// Helper function to convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Trigger hidden file input when the hero button is clicked
selectFileButtonHero.addEventListener('click', () => {
  if (!selectFileButtonHero.disabled) { // Only trigger if not already processing
      fileInput.click();
  }
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];

  generatedHtmlContent = null;

  if (!file) {
    fileNameDisplay.textContent = '';
    clearFileButton.style.display = 'none';
    fileStatusArea.style.display = 'none';
    return;
  }

  fileNameDisplay.textContent = `Selected: ${file.name}`;
  clearFileButton.style.display = 'inline-block';
  fileStatusArea.style.display = 'block';
  userMessageArea.textContent = ''; // Clear previous messages

  // Automatically start generation
  let mimeType = file.type;
  const fileNameLower = file.name.toLowerCase();
  if (fileNameLower.endsWith('.pdf')) {
    mimeType = 'application/pdf';
  } else if (fileNameLower.endsWith('.txt')) {
    mimeType = 'text/plain';
  } else if (fileNameLower.endsWith('.md')) {
    mimeType = 'text/markdown';
  }

  const supportedMimeTypes = ['application/pdf', 'text/plain', 'text/markdown'];
  if (!supportedMimeTypes.includes(mimeType)) {
    userMessageArea.textContent = `Unsupported file type. Please select a .txt, .md, or .pdf file. Detected: ${file.type || 'unknown'}`;
    userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
    fileInput.value = '';
    fileNameDisplay.textContent = '';
    clearFileButton.style.display = 'none';
    fileStatusArea.style.display = 'none';
    return;
  }

  userMessageArea.textContent = 'Preparing your cheatsheet...';
  userMessageArea.className = 'mt-4 text-center p-2 text-sm text-blue-600 dark:text-blue-400';
  buttonText.textContent = 'Generating...';
  spinner.style.display = 'inline-block';
  selectFileButtonHero.disabled = true;
  clearFileButton.disabled = true;

  const reader = new FileReader();

  reader.onload = async (event) => {
    if (!event.target?.result || !(event.target.result instanceof ArrayBuffer)) {
      userMessageArea.textContent = 'Error reading file data.';
      userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
      buttonText.textContent = 'Select Lecture File';
      spinner.style.display = 'none';
      selectFileButtonHero.disabled = false;
      clearFileButton.disabled = false;
      return;
    }

    try {
      const fileDataArrayBuffer = event.target.result;
      const base64EncodedFile = arrayBufferToBase64(fileDataArrayBuffer);

      const filePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64EncodedFile,
        },
      };

      const textPromptPart = {
        text: `Generate an **optimal HTML cheat sheet** from the provided lecture content. The goal is to create a highly effective, visually appealing, and easily digestible study aid. Prioritize clarity, conciseness, and intelligent organization.

**Cheat Sheet Design Principles:**
*   **Intelligent Summarization:** Extract and present only the most essential information. Use concise phrases, keywords, and bullet points. Avoid verbose sentences unless critical for understanding.
*   **Logical Structure:** Organize content with a clear, intuitive flow (e.g., left-to-right, top-to-bottom).
*   **Distinct Sections:** Divide the cheat sheet into visually distinct, logical sections or "boxes." Each section should have a unique, complementary background color to enhance readability and separation.
*   **Clear Hierarchy:** Utilize prominent headings, subheadings, and bold text to establish a clear information hierarchy.
*   **Visual Reinforcement:** Integrate relevant icons, emojis, or simple, illustrative diagrams (avoid complex schematics) to aid memory and comprehension.
*   **Mathematical Equations:** Render all mathematical equations using 'MathJax' syntax with standard LaTeX-style formatting (e.g., \(ax^2+bx+c=0\) or $E=mc^2$).
*   **Effective Color-Coding:** Employ color-coding strategically to highlight categories, topics, or key information.
*   **Structured Data:** Use tables for presenting comparative data or structured information where appropriate.

**Technical Requirements for HTML Output:**
*   **Self-Contained:** The entire HTML output must be self-contained within the `<body>` tags.
*   **Tailwind CSS:** Apply styling exclusively using Tailwind CSS utility classes. Do NOT include any `<style>` tags or external CSS files (except for the MathJax script).
*   **Readability:** Ensure the final HTML is clean, well-formatted, and easy to read.`,
      };
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17', // Updated model name
        contents: { parts: [filePart, textPromptPart] },
      });

      let rawResponseText = result?.text?.trim() ?? '';
      let extractedHtml = '';

      if (rawResponseText) {
        // Try to extract content from ```html ... ``` or ``` ... ``` blocks
        const fenceRegex = /^```(?:html)?\s*\n?([\s\S]*?)\n?\s*```$/s;
        const match = rawResponseText.match(fenceRegex);
        if (match && match[1]) {
          extractedHtml = match[1].trim();
        } else {
          // If no fences, or not a single fenced block, assume the raw response is the HTML.
          // This is fine if the model directly outputs HTML without conversational fluff.
          extractedHtml = rawResponseText;
        }
      }
      
      if (extractedHtml) {
        let finalHtml = extractedHtml;
        // Ensure the model output includes basic HTML structure if it doesn't already,
        // and add MathJax + print-friendly styles.
        if (!extractedHtml.toLowerCase().includes('<html')) {
            finalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Cheatsheet</title>
  <script type="text/javascript" id="MathJax-script" async
    src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js">
  </script>
</head>
<body>
  ${extractedHtml}
</body>
</html>`;
        }
        generatedHtmlContent = finalHtml; // Store for PDF generation

        const blob = new Blob([finalHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cheatsheet.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        userMessageArea.textContent = 'Cheatsheet HTML generated and downloaded!';
        userMessageArea.className = 'mt-4 text-center p-2 text-sm text-green-600 dark:text-green-400';
        
      } else {
        userMessageArea.textContent =
          'Failed to generate cheatsheet or received an empty response. The model might have had trouble with the content. Please try a different file or try again.';
        userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
      }
    } catch (error: unknown) {
      console.error('Error generating content or processing file:', error);
      const detailedError =
        (error as Error)?.message || 'An unknown error occurred';
      userMessageArea.textContent = `An error occurred: ${detailedError}. Please check the console for more details.`;
      userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
    } finally {
      buttonText.textContent = 'Select Lecture File';
      spinner.style.display = 'none';
      selectFileButtonHero.disabled = false;
      clearFileButton.disabled = false;
    }
  };

  reader.onerror = () => {
    userMessageArea.textContent = 'Error reading the file.';
    userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
    buttonText.textContent = 'Select Lecture File';
    spinner.style.display = 'none';
    selectFileButtonHero.disabled = false;
    clearFileButton.disabled = false;
  };

  reader.readAsArrayBuffer(file);
});




clearFileButton.addEventListener('click', () => {
  fileInput.value = ''; // Clear the file input
  fileNameDisplay.textContent = '';
  clearFileButton.style.display = 'none';
  fileStatusArea.style.display = 'none';
  userMessageArea.textContent = '';
  userMessageArea.className = 'mt-4 text-center p-3 text-sm rounded-md dark:text-slate-300';
  generatedHtmlContent = null;

  if (selectFileButtonHero.disabled) {
      buttonText.textContent = 'Select Lecture File';
      spinner.style.display = 'none';
      selectFileButtonHero.disabled = false;
  }
});

// Show/hide About section logic
const aboutLink = document.getElementById('aboutLink');
const mainContent = document.getElementById('mainContent');
const aboutSection = document.getElementById('aboutSection');

aboutLink?.addEventListener('click', (e) => {
  e.preventDefault();
  if (mainContent && aboutSection) {
    mainContent.style.display = 'none';
    aboutSection.style.display = 'block';
  }
});

// Optionally, clicking the logo/title can bring you back to main content
const logoTitle = document.querySelector('h2.text-lg.font-bold');
logoTitle?.addEventListener('click', () => {
  if (mainContent && aboutSection) {
    mainContent.style.display = 'block';
    aboutSection.style.display = 'none';
  }
});

const homeLink = document.getElementById('homeLink');
homeLink?.addEventListener('click', (e) => {
  e.preventDefault();
  if (mainContent && aboutSection) {
    mainContent.style.display = 'block';
    aboutSection.style.display = 'none';
  }
});

// Dark Mode Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

// Function to set the theme
const setTheme = (isDark: boolean) => {
    if (isDark) {
        document.documentElement.classList.add('dark');
        themeToggleLightIcon?.classList.remove('hidden');
        themeToggleDarkIcon?.classList.add('hidden');
        localStorage.setItem('color-theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        themeToggleLightIcon?.classList.add('hidden');
        themeToggleDarkIcon?.classList.remove('hidden');
        localStorage.setItem('color-theme', 'light');
    }
};

// Initial theme setup
const currentTheme = localStorage.getItem('color-theme');

if (currentTheme === 'dark' || (!currentTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    setTheme(true);
} else {
    setTheme(false);
}

// Toggle theme on button click
themeToggleBtn?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(!isDark);
});