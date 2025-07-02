/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';

// Declare html2pdf globally if using CDN
declare const html2pdf: any;

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

const actionsArea = document.getElementById('actionsArea') as HTMLDivElement;
const downloadPdfButton = document.getElementById('downloadPdfButton') as HTMLButtonElement;
const pdfButtonText = downloadPdfButton.querySelector('.pdf-button-text') as HTMLSpanElement;
const pdfSpinner = downloadPdfButton.querySelector('.pdf-spinner') as HTMLSpanElement;

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

  // Reset UI elements for PDF download
  actionsArea.style.display = 'none';
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
    actionsArea.style.display = 'none';
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
      actionsArea.style.display = 'none';
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
        text: `Write a one-page cheat sheet for this lecture in a whole HTML file. Take care of:
-Follow a left-to-right or top-to-bottom flow
-make each section has a unique color in a box-style layout
-Summarize only the most essential information
-Use visuals and layout to enhance memory and clarity
-Short phrases, keywords, or bullet points
-Avoid full sentences unless needed for clarity
-Prioritize clarity over completeness
-Divide your page into logical sections or boxes
-handle equations using 'MathJax' syntax embedded LaTeX-style math equations (e.g., \\(ax^2+bx+c=0\\) or $$E=mc^2$$)
-Use headings, subheadings, and bold titles
-make it in orgaized and structured way for better readability
-use suitable and nice fonts and styling for the output page  

Add Visual Elements
-Icons or emojis
-Charts, diagrams but not a schematic to be a real made one
-Color-coding: Assign colors for categories or topics
-Tables for comparisons or structured data
-keep the design compacted in A4 page size you can change font size to fit a one A4 page as to be ready for printing. Ensure the HTML output is self-contained and does not require external CSS files apart from what's needed for MathJax. The entire content should be within the body tags.`,
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
  <style>
    body { 
      font-family: 'Inter', 'Noto Sans', sans-serif; 
      margin: 10mm; /* A4-like margins */
      line-height: 1.5; 
      background-color: #ffffff; /* White background for PDF */
      color: #000000; /* Black text for PDF */
      width: 210mm; /* A4 width */
      box-sizing: border-box;
      -webkit-print-color-adjust: exact; /* Important for html2pdf to respect colors */
      print-color-adjust: exact;
    }
    .section, div[class*="box"], div[style*="border"] { /* Target sections from LLM */
      border: 1px solid #cccccc; 
      margin-bottom: 10px; 
      padding: 10px; 
      border-radius: 6px; 
      background-color: #f8f8f8; 
      page-break-inside: avoid;
    }
    h1, h2, h3, h4, h5, h6 { 
      color: #111111; 
      page-break-after: avoid;
      margin-top: 1.2em;
      margin-bottom: 0.6em;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 10px; 
      page-break-inside: avoid;
    }
    th, td { 
      border: 1px solid #dddddd; 
      padding: 6px; 
      text-align: left; 
    }
    th { 
      background-color: #eeeeee; 
    }
    img, svg { max-width: 100%; height: auto; } /* Responsive images/SVGs */
    /* Ensure colors defined by the LLM (e.g., for sections) are maintained for PDF */
    /* This can be tricky if LLM uses inline styles with !important, but html2pdf tries its best */
  </style>
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
        actionsArea.style.display = 'flex'; // Show PDF download button area
      } else {
        userMessageArea.textContent =
          'Failed to generate cheatsheet or received an empty response. The model might have had trouble with the content. Please try a different file or try again.';
        userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
        actionsArea.style.display = 'none';
      }
    } catch (error: unknown) {
      console.error('Error generating content or processing file:', error);
      const detailedError =
        (error as Error)?.message || 'An unknown error occurred';
      userMessageArea.textContent = `An error occurred: ${detailedError}. Please check the console for more details.`;
      userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
      actionsArea.style.display = 'none';
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
    actionsArea.style.display = 'none';
  };

  reader.readAsArrayBuffer(file);
});

downloadPdfButton.addEventListener('click', async () => {
  if (!generatedHtmlContent) {
    userMessageArea.textContent = 'No content available to generate PDF.';
    userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
    return;
  }

  pdfButtonText.textContent = 'Converting...';
  pdfSpinner.style.display = 'inline-block';
  downloadPdfButton.disabled = true;

  try {
    const opt = {
      margin:       [10, 10, 10, 10], // Margin in mm (top, left, bottom, right)
      filename:     'cheatsheet.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // If MathJax is expected, give it a moment to render in the html2pdf iframe
    // This is a common pattern, html2pdf creates an iframe for rendering.
    // A small delay can help ensure scripts like MathJax complete.
    // More robust solutions involve waiting for specific MathJax signals if possible from within html2pdf's context.
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s delay for MathJax

    await html2pdf().from(generatedHtmlContent).set(opt).save();

    userMessageArea.textContent = 'Cheatsheet PDF downloaded!';
    userMessageArea.className = 'mt-4 text-center p-2 text-sm text-green-600 dark:text-green-400'; // Keep success message

  } catch (pdfError: unknown) {
    console.error('Error generating PDF:', pdfError);
    const detailedError = (pdfError as Error)?.message || 'Unknown PDF generation error';
    userMessageArea.textContent = `Error generating PDF: ${detailedError}`;
    userMessageArea.className = 'mt-4 text-center p-2 text-sm text-red-600 dark:text-red-400';
  } finally {
    pdfButtonText.textContent = 'Download as PDF';
    pdfSpinner.style.display = 'none';
    downloadPdfButton.disabled = false;
  }
});


clearFileButton.addEventListener('click', () => {
  fileInput.value = ''; // Clear the file input
  fileNameDisplay.textContent = '';
  clearFileButton.style.display = 'none';
  fileStatusArea.style.display = 'none';
  userMessageArea.textContent = '';
  userMessageArea.className = 'mt-4 text-center p-3 text-sm rounded-md dark:text-slate-300';
  actionsArea.style.display = 'none'; // Hide PDF button
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
