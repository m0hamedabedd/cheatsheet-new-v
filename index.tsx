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

const actionsArea = document.getElementById('actionsArea') as HTMLDivElement;
const downloadPdfButton = document.getElementById('downloadPdfButton') as HTMLButtonElement;
const pdfButtonText = downloadPdfButton.querySelector('.pdf-button-text') as HTMLSpanElement;
const pdfSpinner = downloadPdfButton.querySelector('.pdf-spinner') as HTMLSpanElement;

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
        text: `Write a one-page cheat sheet for this lecture in an HTML file. Take care of:\n-Follow a left-to-right or top-to-bottom flow\n-make each section has a unique color in a box-style layout\n-Summarize only the most essential information\n-Use visuals and layout to enhance memory and clarity\n-Short phrases, keywords, or bullet points\n-Avoid full sentences unless needed for clarity\n-Prioritize clarity over completeness\n-Divide your page into logical sections or boxes\n-handle equations using 'MathJax' syntax embedded LaTeX-style math equations (e.g., \(ax^2+bx+c=0\) or $E=mc^2$)\n-Use headings, subheadings, and bold titles\n\nAdd Visual Elements\n-Icons or emojis\n-Charts, diagrams but not a schematic to be a real made one\n-Color-coding: Assign colors for categories or topics\n-Tables for comparisons or structured data\n-**CRITICAL:** The entire content MUST fit on a single A4 page when printed. Adjust font sizes, line spacing, and element sizes as needed to ensure compactness and readability within A4 dimensions. Ensure the HTML output is self-contained and uses Tailwind CSS classes for styling. Do not include any <style> tags or external CSS files apart from what's needed for MathJax. The entire content should be within the body tags.`,
      };
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
    /* Print-specific styles for A4 */
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      body {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-size: 10pt; /* Adjust base font size for print */
        line-height: 1.3; /* Adjust line height for compactness */
      }
      /* Ensure elements don't break across pages */
      h1, h2, h3, h4, h5, h6, p, ul, ol, table, img, svg, .section, div[class*="box"], div[style*="border"] {
        page-break-inside: avoid !important;
      }
      /* Force background colors and images to print */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
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
    // Create a temporary, off-screen container for the HTML content
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm'; // A4 width
    container.innerHTML = generatedHtmlContent;
    document.body.appendChild(container);

    // Use html2canvas to render the container
    const canvas = await html2canvas(container, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      logging: false,
    });

    // Remove the temporary container
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;
    const imgWidth = pdfWidth;
    const imgHeight = imgWidth / ratio;

    // Check if the content exceeds the page height
    if (imgHeight > pdfHeight) {
        console.warn("Content might be too long for a single page.");
    }

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save('cheatsheet.pdf');


    userMessageArea.textContent = 'Cheatsheet PDF downloaded!';
    userMessageArea.className = 'mt-4 text-center p-2 text-sm text-green-600 dark:text-green-400';

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
        themeTogg